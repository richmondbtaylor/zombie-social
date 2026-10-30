import { db } from "@/lib/db";
import { getAuthMember } from "@/lib/auth";
import type { ChannelPublic, Platform, Post } from "@/lib/db";
import CalendarClient from "@/components/CalendarClient";

export const dynamic = "force-dynamic";

function toChannel(c: Record<string, unknown>): ChannelPublic {
  return {
    id: c.id as string, workspaceId: c.workspace_id as string, platform: c.platform as Platform,
    name: c.name as string, handle: c.handle as string, followers: c.followers as number,
    connected: c.connected as boolean, frozen: c.frozen as boolean,
    tokenExpiresAt: (c.token_expires_at as string) ?? null,
    lastRateLimitReset: (c.last_rate_limit_reset as string) ?? null,
  };
}

export default async function CalendarPage() {
  const me = await getAuthMember();
  if (!me) {
    return <div className="card"><strong>Not signed in.</strong><p className="muted">Run with DEMO_MODE=1 for the demo workspace.</p></div>;
  }

  const [{ data: postsData }, { data: channelsData }] = await Promise.all([
    db().from("posts").select("*").eq("workspace_id", me.workspaceId).order("scheduled_at"),
    db().from("channels").select("*").eq("workspace_id", me.workspaceId).order("platform"),
  ]);

  const postIds = (postsData ?? []).map((p) => p.id as string);
  const { data: resultsData } = postIds.length
    ? await db().from("post_results").select("*").in("post_id", postIds)
    : { data: [] };

  const channels = (channelsData ?? []).map(toChannel);
  const posts: Post[] = (postsData ?? []).map((p) => ({
    id: p.id as string, workspaceId: p.workspace_id as string, text: p.text as string,
    channelIds: (p.channel_ids as string[]) ?? [], scheduledAtUtc: (p.scheduled_at as string) ?? null,
    timezone: p.timezone as string, status: p.status as Post["status"],
    imageUrl: p.image_url as string, videoUrl: (p.video_url as string) ?? null,
    sponsored: p.sponsored as boolean, inReview: p.in_review as boolean,
    lockedAt: (p.locked_at as string) ?? null, version: p.version as number,
    createdBy: p.created_by as string, createdAt: p.created_at as string, updatedAt: p.updated_at as string,
    results: (resultsData ?? []).filter((r) => r.post_id === p.id).map((r) => ({
      id: r.id as string, postId: r.post_id as string, channelId: r.channel_id as string,
      externalPostId: (r.external_post_id as string) ?? null, postUrl: (r.post_url as string) ?? null,
      status: r.status as "pending" | "success" | "failed" | "rate_limited",
      errorMessage: (r.error_message as string) ?? null,
      retryCount: (r.retry_count as number) ?? 0, nextRetryAt: (r.next_retry_at as string) ?? null,
      impressions: (r.impressions as number) ?? 0, likes: (r.likes as number) ?? 0,
      comments: (r.comments as number) ?? 0, shares: (r.shares as number) ?? 0, clicks: (r.clicks as number) ?? 0,
      extraMetrics: (r.extra_metrics as Record<string, unknown>) ?? null, syncedAt: (r.synced_at as string) ?? null,
    })),
  }));

  return <CalendarClient initialPosts={posts} initialChannels={channels} role={me.role} />;
}
