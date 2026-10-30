import { db, newId, type ChannelPublic, type Platform } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { CHANNEL_MIN_SPACING_MS } from "@/lib/config";

export interface PublishOutcome {
  channelId: string;
  status: "success" | "failed" | "rate_limited";
  externalPostId?: string;
  postUrl?: string;
  errorMessage?: string;
}

/**
 * Dispatch one post to one channel via the platform API.
 * Returns a structured outcome; never throws for expected platform errors.
 */
export async function publishToChannel(
  channel: { id: string; platform: Platform; accessTokenEnc: string },
  text: string,
  imageUrl: string,
  sponsored: boolean,
): Promise<PublishOutcome> {
  const token = decrypt(channel.accessTokenEnc);
  try {
    switch (channel.platform) {
      case "linkedin":
        return await publishLinkedIn(token, text);
      case "x":
        return await publishX(token, text);
      case "instagram":
        return await publishInstagram(token, text, imageUrl);
      case "facebook":
        return await publishFacebook(token, text, imageUrl);
      case "tiktok":
        return await publishTikTok(token, text, imageUrl);
      default:
        return { channelId: channel.id, status: "failed", errorMessage: `Unsupported platform ${channel.platform}` };
    }
  } catch (err: unknown) {
    return {
      channelId: channel.id,
      status: "failed",
      errorMessage: err instanceof Error ? err.message : "Unknown platform error",
    };
  }
}

async function publishLinkedIn(token: string, text: string): Promise<PublishOutcome> {
  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      author: "urn:li:person:", // resolved from token subject in real flow
      lifecycleState: "PUBLISHED",
      specificContent: { "com.linkedin.ugc.ShareContent": { shareCommentary: { text } } },
      visibility: "PUBLIC",
    }),
  });
  return outcome(res, "linkedin");
}

async function publishX(token: string, text: string): Promise<PublishOutcome> {
  const res = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  return outcome(res, "x");
}

async function publishInstagram(token: string, text: string, imageUrl: string): Promise<PublishOutcome> {
  const res = await fetch("https://graph.facebook.com/v21.0/me", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ caption: text, image_url: imageUrl }),
  });
  return outcome(res, "instagram");
}

async function publishFacebook(token: string, text: string, imageUrl: string): Promise<PublishOutcome> {
  const form = new URLSearchParams({ message: text, access_token: token });
  if (imageUrl) form.set("source", imageUrl);
  const res = await fetch("https://graph.facebook.com/v21.0/me/feed", { method: "POST", body: form });
  return outcome(res, "facebook");
}

async function publishTikTok(token: string, text: string, _imageUrl: string): Promise<PublishOutcome> {
  // TikTok requires the creator to review/approve before it goes live; we create an
  // upload session and mark it pending user confirmation rather than auto-publishing.
  const res = await fetch("https://open.tiktokapis.com/v2/post/publish/", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ title: text.slice(0, 2200), privacy_level: "SELF_ONLY", source_info: { source: "PULL_FROM_URL" } }),
  });
  return outcome(res, "tiktok");
}

async function outcome(res: Response, label: string): Promise<PublishOutcome> {
  const base = { channelId: "", status: "failed" as const };
  if (res.status === 429) {
    return { ...base, status: "rate_limited", errorMessage: `${label} rate limited` };
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ...base, errorMessage: `${label} returned ${res.status}: ${body.slice(0, 200)}` };
  }
  const data = await res.json().catch(() => ({}));
  const externalId = String(data.id ?? data.post_id ?? "");
  const url = String(data.url ?? data.permalink ?? "");
  return { ...base, status: "success", externalPostId: externalId || undefined, postUrl: url || undefined };
}

// ─── Aggregate overall status from per-channel outcomes ──────────────────────

export function aggregateStatus(outcomes: PublishOutcome[]): "published" | "partially_published" | "partially_failed" | "failed" {
  const ok = outcomes.filter((o) => o.status === "success").length;
  if (ok === outcomes.length) return "published";
  if (ok === 0) return "failed";
  return "partially_published";
}

// ─── Per-channel spacing guard ───────────────────────────────────────────────

export async function canDispatchToChannel(channelId: string): Promise<boolean> {
  const { data } = await db()
    .from("post_results")
    .select("updated_at")
    .eq("channel_id", channelId)
    .order("updated_at", { ascending: false })
    .limit(1);
  const last = data?.[0]?.updated_at;
  if (!last) return true;
  return Date.now() - new Date(last).getTime() >= CHANNEL_MIN_SPACING_MS;
}

// ─── Record a result row upsert ──────────────────────────────────────────────

export async function recordResult(postId: string, o: PublishOutcome, retryCount = 0, nextRetryAt: string | null = null) {
  const { error } = await db().from("post_results").upsert(
    {
      id: newId(),
      post_id: postId,
      channel_id: o.channelId,
      status: o.status,
      external_post_id: o.externalPostId ?? null,
      post_url: o.postUrl ?? null,
      error_message: o.errorMessage ?? null,
      retry_count: retryCount,
      next_retry_at: nextRetryAt,
    },
    { onConflict: "post_id,channel_id" },
  );
  if (error) throw error;
}
