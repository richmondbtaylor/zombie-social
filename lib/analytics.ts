import { db } from "@/lib/db";
import type { Platform } from "@/lib/db";

export interface AnalyticsRow {
  channelId: string; platform: Platform; followers: number; posts: number;
  impressions: number; likes: number; comments: number; shares: number;
  clicks: number; engagementRate: number;
}

export interface AnalyticsData {
  totals: { impressions: number; likes: number; comments: number; shares: number; clicks: number; posts: number; avgImpressions: number };
  perChannel: AnalyticsRow[];
  topPost: { id: string; text: string } | null;
  sponsoredVsOrganic: { sponsored: number; organic: number };
}

/**
 * Analytics aggregates read from the post_results table (written by the analytics
 * sync worker or the seed script). Drafts, deleted and failed posts are excluded.
 * Shared by GET /api/analytics and the server-rendered analytics page.
 */
export async function computeAnalytics(workspaceId: string): Promise<AnalyticsData> {
  const { data: channels } = await db()
    .from("channels")
    .select("id, platform, name, handle, followers")
    .eq("workspace_id", workspaceId);

  const { data: publishedPosts } = await db()
    .from("posts")
    .select("id, text, status, sponsored")
    .eq("workspace_id", workspaceId)
    .in("status", ["published", "partially_published"]);

  const postIds = (publishedPosts ?? []).map((p) => p.id);
  const { data: results } = postIds.length
    ? await db().from("post_results").select("*").in("post_id", postIds)
    : { data: [] };

  const perChannel: AnalyticsRow[] = (channels ?? []).map((c) => {
    const rows = (results ?? []).filter((r) => r.channel_id === c.id);
    const impressions = rows.reduce((n, r) => n + (r.impressions ?? 0), 0);
    const likes = rows.reduce((n, r) => n + (r.likes ?? 0), 0);
    const comments = rows.reduce((n, r) => n + (r.comments ?? 0), 0);
    const shares = rows.reduce((n, r) => n + (r.shares ?? 0), 0);
    const clicks = rows.reduce((n, r) => n + (r.clicks ?? 0), 0);
    // Engagement rate uses impressions (reach) as the denominator, not followers.
    const engagementRate = impressions > 0 ? ((likes + comments + shares) / impressions) * 100 : 0;
    return {
      channelId: c.id as string, platform: c.platform as Platform, followers: c.followers as number,
      posts: rows.length, impressions, likes, comments, shares, clicks, engagementRate,
    };
  });

  const total = (k: "impressions" | "likes" | "comments" | "shares" | "clicks") =>
    perChannel.reduce((n, c) => n + c[k], 0);

  // Average impressions per published post (divides by posts, not channels).
  const publishedCount = (publishedPosts ?? []).length;
  const avgImpressions = publishedCount > 0 ? Math.round(total("impressions") / publishedCount) : 0;

  // Top post sums likes across ALL of its channel results, not just the first.
  const likesByPost = new Map<string, number>();
  for (const r of results ?? []) {
    likesByPost.set(r.post_id, (likesByPost.get(r.post_id) ?? 0) + (r.likes ?? 0));
  }
  const top = [...(publishedPosts ?? [])].sort((a, b) => (likesByPost.get(b.id) ?? 0) - (likesByPost.get(a.id) ?? 0))[0];

  // Sponsored vs organic split for the toggle.
  const sponsoredIds = new Set((publishedPosts ?? []).filter((p) => p.sponsored).map((p) => p.id));
  const splitResults = { sponsored: 0, organic: 0 };
  for (const r of results ?? []) {
    splitResults[sponsoredIds.has(r.post_id) ? "sponsored" : "organic"] += (r.impressions ?? 0);
  }

  return {
    totals: {
      impressions: total("impressions"),
      likes: total("likes"),
      comments: total("comments"),
      shares: total("shares"),
      clicks: total("clicks"),
      posts: publishedCount,
      avgImpressions,
    },
    perChannel,
    topPost: top ? { id: top.id as string, text: top.text as string } : null,
    sponsoredVsOrganic: splitResults,
  };
}
