import { NextResponse } from "next/server";
import { getAuthMember } from "@/lib/auth";
import { Problems } from "@/lib/problem";
import { computeAnalytics } from "@/lib/analytics";

export const dynamic = "force-dynamic";

/** GET /api/analytics — same aggregates as the server-rendered analytics page. */
export async function GET() {
  const me = await getAuthMember();
  if (!me) return Problems.UNAUTHORIZED();
  return NextResponse.json(await computeAnalytics(me.workspaceId));
}
