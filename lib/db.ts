import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Platform = "instagram" | "linkedin" | "x" | "tiktok" | "facebook";

export type MemberRole = "owner" | "editor" | "viewer";

export type PostStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "scheduled"
  | "publishing"
  | "processing"
  | "published"
  | "partially_published"
  | "partially_failed"
  | "failed";

export interface Workspace {
  id: string;
  name: string;
  timezone: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  plan: "free" | "creator" | "team";
  pastDue: boolean;
  pastDueAt: string | null;
}

export interface Member {
  id: string;
  workspaceId: string;
  userId: string;
  name: string;
  email: string;
  role: MemberRole;
  deactivated: boolean;
}

export interface Channel {
  id: string;
  workspaceId: string;
  platform: Platform;
  name: string;
  handle: string;
  followers: number;
  connected: boolean;
  frozen: boolean;
  accessTokenEnc: string;
  refreshTokenEnc: string;
  tokenExpiresAt: string | null;
  lastRateLimitReset: string | null;
}

export type ChannelPublic = Omit<Channel, "accessTokenEnc" | "refreshTokenEnc">;

export interface PostResult {
  id: string;
  postId: string;
  channelId: string;
  externalPostId: string | null;
  postUrl: string | null;
  status: "pending" | "success" | "failed" | "rate_limited";
  errorMessage: string | null;
  retryCount: number;
  nextRetryAt: string | null;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
  extraMetrics: Record<string, unknown> | null;
  syncedAt: string | null;
}

export interface PostComment {
  authorId: string;
  timestamp: string;
  body: string;
}

export interface Post {
  id: string;
  workspaceId: string;
  text: string;
  channelIds: string[];
  scheduledAtUtc: string | null;
  timezone: string;
  status: PostStatus;
  imageUrl: string;
  videoUrl: string | null;
  sponsored: boolean;
  inReview: boolean;
  lockedAt: string | null;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  results?: PostResult[];
  comments?: PostComment[];
}

// ─── Supabase client (server-side) ───────────────────────────────────────────

let _client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!_client) {
    const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable.",
      );
    }
    _client = createClient(url, key, { auth: { persistSession: false } });
  }
  return _client;
}

// ─── UUID generation ──────────────────────────────────────────────────────────

import { randomUUID } from "crypto";

export function newId(): string {
  return randomUUID();
}

// ─── Validation ───────────────────────────────────────────────────────────────

const REQUIRED_ENV = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CRON_SECRET",
  "ENCRYPTION_KEY",
  "NEXT_PUBLIC_APP_URL",
] as const;

export function validateEnv(): void {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
}

if (typeof window === "undefined") {
  try { validateEnv(); } catch { /* allow local dev without all vars */ }
}
