import { NextResponse } from "next/server";
import { db, newId } from "@/lib/db";
import { BILLING_GRACE_PERIOD_DAYS, FREE_TIER_CHANNELS } from "@/lib/config";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-02-24.acacia" })
  : null;

/**
 * Stripe webhook: customer.subscription.created / updated / deleted.
 * - On active: clear pastDue, sync plan.
 * - On past_due: mark workspace pastDue with a grace period of BILLING_GRACE_PERIOD_DAYS (3).
 * - On deleted: freeze the most recently connected channels beyond the free-tier limit,
 *   mark the workspace past due permanently, and fail scheduled posts.
 */
export async function POST(req: Request) {
  if (!stripe) return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });

  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const body = await req.text();

  let event: Stripe.Event;
  try {
    if (!webhookSecret || !sig) throw new Error("Missing Stripe webhook secret or signature");
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: unknown) {
    console.error("[stripe-webhook] signature verification failed", err);
    return new NextResponse("Invalid signature", { status: 400 });
  }

  const sub = event.data.object as Stripe.Subscription;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  const { data: workspace } = await db()
    .from("workspaces")
    .select("*")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (!workspace) {
    return NextResponse.json({ received: true, detail: "No matching workspace." });
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const paid = sub.status === "active" || sub.status === "trialing";
      const pastDue = sub.status === "past_due";
      const updates: Record<string, unknown> = {
        plan: paid ? "creator" : "free",
        past_due: pastDue,
        past_due_at: pastDue ? new Date().toISOString() : null,
        stripe_subscription_id: sub.id,
      };
      await db().from("workspaces").update(updates).eq("id", workspace.id);
      // Past-due grace period: after BILLING_GRACE_PERIOD_DAYS the cron worker blocks
      // queue additions. We flag it here; enforcement lives in the scheduler.
      break;
    }

    case "customer.subscription.deleted": {
      const graceExpiresAt = new Date(
        Date.now() + BILLING_GRACE_PERIOD_DAYS * 24 * 3600 * 1000,
      ).toISOString();
      await db()
        .from("workspaces")
        .update({ plan: "free", past_due: true, past_due_at: graceExpiresAt })
        .eq("id", workspace.id);

      // Freeze the most recently connected channels beyond the free-tier limit,
      // keeping existing scheduled posts intact.
      const { data: channels } = await db()
        .from("channels")
        .select("id")
        .eq("workspace_id", workspace.id)
        .eq("connected", true)
        .order("created_at", { ascending: false });

      const excess = (channels ?? []).slice(FREE_TIER_CHANNELS);
      if (excess.length > 0) {
        await db()
          .from("channels")
          .update({ frozen: true })
          .in("id", excess.map((c) => c.id));
      }

      // After the grace period expires, scheduled posts become failed. The cron worker
      // enforces that; here we only stamp the workspace.
      await db().from("audit_log").insert({
        id: newId(),
        workspace_id: workspace.id,
        actor_id: null,
        action: "billing.subscription_deleted",
        entity_type: "workspace",
        entity_id: workspace.id,
        details: { frozen_channel_count: excess.length, grace_expires_at: graceExpiresAt },
      });
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
