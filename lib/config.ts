import type { Platform, PostStatus } from "@/lib/db";

// ─── Configuration constants (resolved placeholders) ─────────────────────────

export const VIDEO_MAX_BYTES = 250 * 1024 * 1024; // 250 MB
export const DRAFT_MEDIA_RETENTION_DAYS = 30;
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB upload cap
export const REMOTE_IMAGE_MAX_BYTES = 10 * 1024 * 1024; // 10 MB remote HEAD check
export const DAILY_POST_CAP_PER_CHANNEL = 24;
export const FREE_TIER_CHANNELS = 3;
export const BILLING_GRACE_PERIOD_DAYS = 3;
export const MIN_SCHEDULE_LEAD_MS = 5 * 60 * 1000; // schedule ≥ 5 min in future
export const CHANNEL_MIN_SPACING_MS = 60 * 1000; // 60s between posts to same channel
export const PROCESSING_STALE_MS = 5 * 60 * 1000; // reclaim after 5 min
export const SYNC_PUBLISH_TIMEOUT_MS = 30 * 1000; // hand off to cron after 30s
export const RETRY_BACKOFF_MINUTES = [1, 5, 15];
export const DUPLICATE_WINDOW_HOURS = 24;
export const INVITE_EXPIRY_DAYS = 7;

// ─── Status sets ─────────────────────────────────────────────────────────────

export const ACTIVE_STATUSES: PostStatus[] = [
  "scheduled", "publishing", "processing",
];
export const HISTORY_STATUSES: PostStatus[] = [
  "published", "partially_published", "partially_failed", "failed",
];
export const EDITABLE_STATUSES: PostStatus[] = [
  "draft", "pending_review", "approved", "rejected", "scheduled", "failed",
];
