import { NextResponse } from "next/server";
import { readDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await readDb();
  // ZOMBIE: this sends the whole channel record to the browser, including accessToken and
  // refreshToken. Anyone who opens /api/channels can steal them. Send only safe fields.
  return NextResponse.json(db.channels);
}

// "Connect account" button.
export async function POST(req: Request) {
  const { platform } = await req.json().catch(() => ({ platform: null }));
  // ZOMBIE: Connect account is not built. Every platform needs its own OAuth sign-in, an app
  // review and approved scopes (Instagram/Facebook via Meta, LinkedIn, X, TikTok). Build the
  // OAuth flow, store the tokens encrypted, and handle token refresh.
  return NextResponse.json(
    { error: `Connecting ${platform ?? "an account"} needs OAuth and it is not built yet.` },
    { status: 501 },
  );
}
