import { NextResponse } from "next/server";
import { db, newId } from "@/lib/db";
import { Problems } from "@/lib/problem";
import { publishToChannel, aggregateStatus, recordResult } from "@/lib/publish";
import { decrypt } from "@/lib/crypto";
import {
  PROCESSING_STALE_MS,
  RETRY_BACKOFF_MINUTES,
  CHANNEL_MIN_SPACING_MS,
} from "@/lib/config";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PERMANENT_ERROR_RE = /401|unauthorized|invalid[_ ]?token|expired|validation|not_authorized|permission/i;

/**
 * Vercel Cron batch worker. Authenticated via Authorization: Bearer <CRON_SECRET>.
 * Claims due posts (status=scheduled), marks them processing with lockedAt,
 * dispatches per channel, applies exponential backoff for transient errors,
 * fails permanent errors immediately, and reclaims stale processing rows.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return Problems.UNAUTHORIZED("Cron requests require a valid bearer secret.");
  }

  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  // 1. Reclaim stale processing rows (>5 min) so a crashed run doesn't wedge a post.
  await db()
    .from("posts")
    .update({ status: "scheduled", locked_at: null, updated_at: nowIso })
    .eq("status", "processing")
    .lt("locked_at", new Date(now - PROCESSING_STALE_MS).toISOString());

  // 2. Mark overdue scheduled posts as failed rather than auto-publishing stale content.
  const { data: overdue } = await db()
    .from("posts")
    .select("id")
    .eq("status", "scheduled")
    .lt("scheduled_at", new Date(now - PROCESSING_STALE_MS).toISOString())
    .limit(50);
  for (const p of overdue ?? []) {
    await db()
      .from("posts")
      .update({ status: "failed", updated_at: nowIso })
      .eq("id", p.id);
    await db().from("post_results").update({
      status: "failed",
      error_message: "overdue: post was too far past its scheduled time to publish",
    }).eq("post_id", p.id).eq("status", "pending");
  }

  // 3. Claim due posts using optimistic concurrency (version bump) for row-level safety.
  const { data: due } = await db()
    .from("posts")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true })
    .limit(20);

  let published = 0, partial = 0, failed = 0, deferred = 0;

  for (const post of due ?? []) {
    const claimVersion = post.version as number;
    const { data: claimed } = await db()
      .from("posts")
      .update({ status: "processing", locked_at: nowIso, version: claimVersion + 1, updated_at: nowIso })
      .eq("id", post.id)
      .eq("version", claimVersion)
      .select("id")
      .maybeSingle();
    if (!claimed) continue; // another runner already owns this row

    const channelIds: string[] = (post.channel_ids as string[]) ?? [];
    const { data: channels } = await db()
      .from("channels")
      .select("id, platform, handle, connected, frozen, access_token_enc, last_rate_limit_reset")
      .in("id", channelIds);

    const outcomes = [];
    for (const c of channels ?? []) {
      // Respect per-channel spacing and rate-limit resets.
      const lastReset = c.last_rate_limit_reset ? new Date(c.last_rate_limit_reset as string).getTime() : 0;
      if (lastReset > now) { deferred++; continue; }
      const { data: recent } = await db()
        .from("post_results")
        .select("updated_at")
        .eq("channel_id", c.id)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (recent?.[0]?.updated_at && now - new Date(recent[0].updated_at as string).getTime() < CHANNEL_MIN_SPACING_MS) {
        deferred++;
        continue;
      }

      const o = await publishToChannel(
        { id: c.id as string, platform: c.platform as never, accessTokenEnc: c.access_token_enc as string },
        post.text as string,
        post.image_url as string,
        post.sponsored as boolean,
      ).then((r) => ({ ...r, channelId: c.id as string }));

      // Inspect rate-limit headers on the underlying call by re-reading outcome message.
      if (o.status === "rate_limited") {
        await db().from("channels").update({ last_rate_limit_reset: new Date(now + 60_000).toISOString() }).eq("id", c.id);
      }
      outcomes.push(o);
    }

    const overall = aggregateStatus(outcomes);
    for (const o of outcomes) {
      // Exponential backoff for transient errors; permanent errors fail fast.
      if (o.status === "failed" || o.status === "rate_limited") {
        const { data: existing } = await db()
          .from("post_results")
          .select("retry_count")
          .eq("post_id", post.id)
          .eq("channel_id", o.channelId)
          .maybeSingle();
        const attempt = (existing?.retry_count as number | undefined) ?? 0;
        const permanent = PERMANENT_ERROR_RE.test(o.errorMessage ?? "");
        if (permanent) {
          await recordResult(post.id as string, o, attempt, null);
        } else if (attempt >= RETRY_BACKOFF_MINUTES.length) {
          await recordResult(post.id as string, o, attempt, null);
        } else {
          const nextAt = new Date(now + RETRY_BACKOFF_MINUTES[attempt] * 60_000).toISOString();
          await recordResult(post.id as string, o, attempt + 1, nextAt);
        }
      } else {
        await recordResult(post.id as string, o);
      }
    }

    const allPendingRetry = outcomes.some((o) => o.status !== "success" && !PERMANENT_ERROR_RE.test(o.errorMessage ?? ""));
    const finalStatus = allPendingRetry && overall !== "published" ? "scheduled" : overall;

    await db()
      .from("posts")
      .update({ status: finalStatus, locked_at: null, updated_at: new Date().toISOString() })
      .eq("id", post.id);

    if (finalStatus === "published") published++;
    else if (finalStatus === "partially_published" || finalStatus === "partially_failed") partial++;
    else if (finalStatus === "failed") failed++;
  }

  return NextResponse.json({ ok: true, processed: (due?.length ?? 0), published, partial, failed, deferred });
}
