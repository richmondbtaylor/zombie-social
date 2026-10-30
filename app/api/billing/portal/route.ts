import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthMember, canManageBilling } from "@/lib/auth";
import { Problems } from "@/lib/problem";

export const dynamic = "force-dynamic";

/** Generates a short-lived Stripe Customer Portal URL for the workspace owner. */
export async function GET() {
  const me = await getAuthMember();
  if (!me) return Problems.UNAUTHORIZED();
  if (!canManageBilling(me.role)) return Problems.FORBIDDEN("Only the owner can access billing settings.");

  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecret) return Problems.INTERNAL("Stripe is not configured.");

  const { data: workspace } = await db()
    .from("workspaces")
    .select("stripe_customer_id")
    .eq("id", me.workspaceId)
    .single();
  if (!workspace?.stripe_customer_id) return Problems.NOT_FOUND("No billing account is linked to this workspace.");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const res = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${stripeSecret}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      customer: workspace.stripe_customer_id,
      return_url: appUrl,
    }),
  });
  if (!res.ok) {
    console.error("[portal] session create failed", await res.text());
    return Problems.INTERNAL("Could not create a billing portal session.");
  }
  const session = await res.json();
  return NextResponse.json({ url: session.url });
}
