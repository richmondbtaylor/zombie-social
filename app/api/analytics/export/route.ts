import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthMember, canExport } from "@/lib/auth";
import { Problems } from "@/lib/problem";

export const dynamic = "force-dynamic";

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** GET /api/analytics/export?days=7|30|90 or &from=&to= */
export async function GET(req: Request) {
  const me = await getAuthMember();
  if (!me) return Problems.UNAUTHORIZED();
  if (!canExport(me.role)) return Problems.FORBIDDEN("Viewers cannot export analytics. Use the on-screen summary instead.");

  const { searchParams } = new URL(req.url);
  let from: Date, to: Date;
  const now = Date.now();
  to = new Date(now);
  if (searchParams.get("from")) {
    from = new Date(searchParams.get("from")!);
    if (Number.isNaN(from.getTime())) return Problems.BAD_REQUEST("Invalid from date.");
  } else {
    const days = Number(searchParams.get("days") ?? "30");
    if (![7, 30, 90].includes(days)) return Problems.BAD_REQUEST("days must be 7, 30 or 90.");
    from = new Date(now - days * 24 * 3600 * 1000);
  }
  if (searchParams.get("to")) {
    const t = new Date(searchParams.get("to")!);
    if (!Number.isNaN(t.getTime())) to = t;
  }

  const { data: posts } = await db()
    .from("posts")
    .select("id, text, channel_ids, status, scheduled_at, sponsored")
    .eq("workspace_id", me.workspaceId)
    .in("status", ["published", "partially_published", "partially_failed"])
    .gte("scheduled_at", from.toISOString())
    .lte("scheduled_at", to.toISOString());

  const postIds = (posts ?? []).map((p) => p.id);
  const { data: results } = postIds.length
    ? await db().from("post_results").select("*").in("post_id", postIds)
    : { data: [] };

  const { data: channels } = await db()
    .from("channels")
    .select("id, platform, handle")
    .eq("workspace_id", me.workspaceId);
  const channelName = new Map((channels ?? []).map((c) => [c.id, `${c.platform}:${c.handle}`]));

  const header = "Post Text,Channels,Published At,Impressions,Likes,Comments,Shares,Clicks";
  const rows: string[] = [header];
  for (const p of posts ?? []) {
    const rs = (results ?? []).filter((r) => r.post_id === p.id);
    const agg = {
      impressions: rs.reduce((n, r) => n + (r.impressions ?? 0), 0),
      likes: rs.reduce((n, r) => n + (r.likes ?? 0), 0),
      comments: rs.reduce((n, r) => n + (r.comments ?? 0), 0),
      shares: rs.reduce((n, r) => n + (r.shares ?? 0), 0),
      clicks: rs.reduce((n, r) => n + (r.clicks ?? 0), 0),
    };
    const chList = (p.channel_ids as string[]).map((id) => channelName.get(id) ?? id).join(" | ");
    rows.push(
      [
        csvEscape(p.text), csvEscape(chList), csvEscape(p.scheduled_at),
        agg.impressions, agg.likes, agg.comments, agg.shares, agg.clicks,
      ].join(","),
    );
  }

  const csv = rows.join("\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="analytics-${from.toISOString().slice(0, 10)}-to-${to.toISOString().slice(0, 10)}.csv"`,
    },
  });
}
