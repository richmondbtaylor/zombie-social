import { NextResponse } from "next/server";
import { db, newId } from "@/lib/db";
import { getAuthMember, canManageBilling } from "@/lib/auth";
import { Problems } from "@/lib/problem";

export const dynamic = "force-dynamic";

// Plan → Stripe price IDs configured in env.
const PLAN_PRICES: Record<string, string | undefined> = {
  creator: process.env.STRIPE_PRICE_CREATOR,
  team: process.env.STRIPE_PRICE_TEAM,
};

export async function POST(req: Request) {
  const me = await getAuthMember();
  if (!me) return Problems.UNAUTHORIZED();
  if (!canManageBilling(me.role)) return Problems.FORBIDDEN("Only the workspace owner can manage billing.");

  const { plan } = await req.json().catch(() => ({ plan: "" }));
  const priceId = PLAN_PRICES[plan as string];
  if (!priceId) return Problems.BAD_REQUEST(`Unknown plan "${plan}".`);

  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecret) return Problems.INTERNAL("Stripe is not configured on this deployment.");

  const { data: workspace } = await db()
    .from("workspaces")
    .select("id, stripe_customer_id")
    .eq("id", me.workspaceId)
    .single();
  if (!workspace) return Problems.NOT_FOUND("Workspace not found.");

  // Metered quantity = active channel count.
  const { count: channelCount } = await db()
    .from("channels")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", me.workspaceId)
    .eq("connected", true);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${stripeSecret}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      mode: "subscription",
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": String(Math.max(1, channelCount ?? 1)),
      success_url: `${appUrl}/pricing?checkout=success`,
      cancel_url: `${appUrl}/pricing?checkout=cancelled`,
      client_reference_id: me.workspaceId,
      ...(workspace.stripe_customer_id ? { customer: workspace.stripe_customer_id } : { "customer_email": me.email }),
      allow_promotion_codes: "true",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[checkout] session create failed", body);
    return Problems.INTERNAL("Could not create a Stripe Checkout session.");
  }
  const session = await res.json();

  if (!workspace.stripe_customer_id && session.customer) {
    await db().from("workspaces").update({ stripe_customer_id: session.customer }).eq("id", me.workspaceId);
  }

  return NextResponse.json({ url: session.url });
}
