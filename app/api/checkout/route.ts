// ZOMBIE: Stripe is not connected. The pricing page posts here and gets a 501.
// To do: create a Stripe Checkout Session with STRIPE_SECRET_KEY, return its URL,
// and add a webhook route that marks the account as paid.
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { plan } = await req.json().catch(() => ({ plan: null }));
  return NextResponse.json(
    { error: `Stripe is not connected yet. Nobody can buy the ${plan ?? "unknown"} plan.` },
    { status: 501 },
  );
}
