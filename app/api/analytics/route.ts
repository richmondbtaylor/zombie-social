import { NextResponse } from "next/server";
import { readDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// The numbers come from the seed file. They are fake. Nothing is pulled from the platforms.
export async function GET() {
  const db = await readDb();
  const published = db.posts.filter((p) => p.status === "published");

  const perChannel = db.channels.map((c) => {
    const rows = published.flatMap((p) => (p.results ?? []).filter((r) => r.channelId === c.id));
    const impressions = rows.reduce((n, r) => n + r.impressions, 0);
    const likes = rows.reduce((n, r) => n + r.likes, 0);
    const comments = rows.reduce((n, r) => n + r.comments, 0);
    const shares = rows.reduce((n, r) => n + r.shares, 0);
    const clicks = rows.reduce((n, r) => n + r.clicks, 0);
    // ZOMBIE: engagement rate is divided by followers. The usual way is engagements divided by
    // impressions (reach). Pick one definition and say on the page which one it is.
    const engagementRate = rows.length ? ((likes + comments + shares) / c.followers) * 100 : 0;
    return { channelId: c.id, platform: c.platform, name: c.name, followers: c.followers, posts: rows.length, impressions, likes, comments, shares, clicks, engagementRate };
  });

  const total = (k: "impressions" | "likes" | "comments" | "shares" | "clicks") => perChannel.reduce((n, c) => n + c[k], 0);
  // ZOMBIE: "average impressions per post" divides by the number of channels, not posts.
  const avgImpressions = Math.round(total("impressions") / db.channels.length);

  const top = [...published].sort((a, b) => sum(b) - sum(a))[0];
  // ZOMBIE: "top post" ranks by the likes of the first channel result only, so a post that
  // went to two channels is ranked by part of its numbers.
  function sum(p: (typeof published)[number]) {
    return p.results?.[0]?.likes ?? 0;
  }

  return NextResponse.json({
    totals: { impressions: total("impressions"), likes: total("likes"), comments: total("comments"), shares: total("shares"), clicks: total("clicks"), posts: published.length, avgImpressions },
    perChannel,
    topPost: top ? { id: top.id, text: top.text } : null,
  });
}
