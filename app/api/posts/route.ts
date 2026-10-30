import { NextResponse } from "next/server";
import { db, newId, type Post, type Platform } from "@/lib/db";
import { getAuthMember, canCreate } from "@/lib/auth";
import { Problems } from "@/lib/problem";
import { LIMITS, countChars } from "@/lib/channels";
import { MIN_SCHEDULE_LEAD_MS, DAILY_POST_CAP_PER_CHANNEL, DUPLICATE_WINDOW_HOURS, REMOTE_IMAGE_MAX_BYTES } from "@/lib/config";
import crypto from "crypto";

export const dynamic = "force-dynamic";

function toPublic(r: Record<string, unknown>): Post {
  return {
    id: r.id as string,
    workspaceId: r.workspace_id as string,
    text: r.text as string,
    channelIds: (r.channel_ids as string[]) ?? [],
    scheduledAtUtc: (r.scheduled_at as string) ?? null,
    timezone: r.timezone as string,
    status: r.status as Post["status"],
    imageUrl: r.image_url as string,
    videoUrl: (r.video_url as string) ?? null,
    sponsored: r.sponsored as boolean,
    inReview: r.in_review as boolean,
    lockedAt: (r.locked_at as string) ?? null,
    version: r.version as number,
    createdBy: r.created_by as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

async function validateImageUrl(url: string) {
  if (!url) return null;
  let parsed: URL;
  try { parsed = new URL(url); } catch { return "Image URL is not a valid absolute URL."; }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return `Image URL protocol "${parsed.protocol}" is not allowed. Only http and https are permitted.`;
  }
  const storageHosts = [".supabase.co", ".supabase.storage", "amazonaws.com"];
  const ok = storageHosts.some((h) => parsed.hostname.endsWith(h));
  if (!ok) return "Image URL must point to approved storage origins.";

  try {
    const head = await fetch(url, { method: "HEAD" });
    if (!head.ok) return "Image URL is not reachable.";
    const ct = head.headers.get("content-type") ?? "";
    if (!ct.startsWith("image/")) return `Image URL returned content-type "${ct}", expected image/*.`;
    const len = Number(head.headers.get("content-length") ?? "0");
    if (len > REMOTE_IMAGE_MAX_BYTES) return `Image exceeds ${REMOTE_IMAGE_MAX_BYTES} byte limit.`;
  } catch {
    return "Could not verify the image URL with a HEAD request.";
  }
  return null;
}

export async function GET() {
  const me = await getAuthMember();
  if (!me) return Problems.UNAUTHORIZED();
  const { data, error } = await db()
    .from("posts")
    .select("*")
    .eq("workspace_id", me.workspaceId)
    .order("scheduled_at", { ascending: true, nullsFirst: false });
  if (error) return Problems.INTERNAL(error.message);
  return NextResponse.json((data ?? []).map(toPublic));
}

export async function POST(req: Request) {
  const me = await getAuthMember();
  if (!me) return Problems.UNAUTHORIZED();
  if (me.deactivated) return Problems.FORBIDDEN("Your account has been deactivated.");
  if (!canCreate(me.role)) return Problems.FORBIDDEN("Viewers cannot create posts.");

  const b = await req.json().catch(() => ({}));

  const text = String(b.text ?? "").trim();
  if (!text) return Problems.BAD_REQUEST("Post text is required.");

  const channelIds: string[] = Array.isArray(b.channelIds) ? b.channelIds.map(String) : [];
  if (channelIds.length === 0) return Problems.BAD_REQUEST("Select at least one channel.");

  // Verify every channel exists, belongs to this workspace, and is connected.
  const { data: channels, error: chErr } = await db()
    .from("channels")
    .select("id, platform, handle, connected, frozen, workspace_id")
    .in("id", channelIds)
    .eq("workspace_id", me.workspaceId);
  if (chErr) return Problems.INTERNAL(chErr.message);
  const found = new Map((channels ?? []).map((c) => [c.id as string, c]));
  for (const cid of channelIds) {
    const c = found.get(cid);
    if (!c) return Problems.UNPROCESSABLE(`Channel ${cid} does not exist in your workspace.`);
    if (!c.connected) return Problems.UNPROCESSABLE(`Channel ${c.handle} is not connected. Reconnect it before scheduling.`);
    if (c.frozen) return Problems.UNPROCESSABLE(`Channel ${c.handle} is frozen by your plan. Upgrade or reconnect to schedule.`);
  }

  // Character-limit validation per platform.
  for (const c of channels ?? []) {
    const platform = c.platform as Platform;
    const used = countChars(text, platform);
    if (used > LIMITS[platform]) {
      return Problems.BAD_REQUEST(
        `Text is ${used} characters; ${platform} allows at most ${LIMITS[platform]}.`,
      );
    }
  }

  // Sponsored disclosure (#ad).
  let finalText = text;
  const sponsored = Boolean(b.sponsored);
  if (sponsored && !/#ad\b/i.test(finalText)) finalText = `${finalText}\n\n#ad`;

  // Image URL sanitization + HEAD verification.
  const imageUrl = String(b.imageUrl ?? "");
  const imgErr = await validateImageUrl(imageUrl);
  if (imgErr) return Problems.UNPROCESSABLE(imgErr);

  // scheduledAt conversion: require ISO 8601 UTC + IANA tz, ≥5 min in future.
  let scheduledAtUtc: string | null = null;
  const wantsSchedule = b.status === "scheduled";
  if (wantsSchedule) {
    if (!b.scheduledAt || typeof b.scheduledAt !== "string") {
      return Problems.BAD_REQUEST("scheduledAt is required when scheduling.");
    }
    const dt = new Date(b.scheduledAt);
    if (Number.isNaN(dt.getTime())) return Problems.BAD_REQUEST("scheduledAt is not a valid ISO 8601 timestamp.");
    if (dt.getTime() - Date.now() < MIN_SCHEDULE_LEAD_MS) {
      return Problems.BAD_REQUEST("scheduledAt must be at least 5 minutes in the future (UTC).");
    }
    scheduledAtUtc = dt.toISOString();
  }

  // Duplicate hash check within rolling window on overlapping channels.
  const textHash = crypto.createHash("sha256").update(finalText.toLowerCase()).digest("hex");
  const sinceIso = new Date(Date.now() - DUPLICATE_WINDOW_HOURS * 3600 * 1000).toISOString();
  const { data: recent } = await db()
    .from("posts")
    .select("id, channel_ids, text")
    .eq("workspace_id", me.workspaceId)
    .gte("created_at", sinceIso)
    .in("status", ["scheduled", "published", "partially_published", "processing", "publishing"]);
  for (const p of recent ?? []) {
    const overlap = (p.channel_ids as string[]).some((cid) => channelIds.includes(cid));
    if (!overlap) continue;
    const h = crypto.createHash("sha256").update(String(p.text).toLowerCase()).digest("hex");
    if (h === textHash) return Problems.CONFLICT("Identical text already scheduled/published to an overlapping channel in the last 24 hours.");
  }

  // Daily cap per channel.
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  for (const cid of channelIds) {
    const { count } = await db()
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", me.workspaceId)
      .contains("channel_ids", `{${cid}}`)
      .in("status", ["scheduled", "published"])
      .gte("scheduled_at", dayStart.toISOString());
    if ((count ?? 0) >= DAILY_POST_CAP_PER_CHANNEL) {
      return Problems.TOO_MANY_REQUESTS(`Daily cap of ${DAILY_POST_CAP_PER_CHANNEL} posts reached for channel ${cid}.`);
    }
  }

  const id = newId();
  const row = {
    id,
    workspace_id: me.workspaceId,
    text: finalText,
    channel_ids: channelIds,
    scheduled_at: scheduledAtUtc,
    timezone: String(b.timezone ?? "UTC"),
    status: wantsSchedule ? "scheduled" : "draft",
    image_url: imageUrl,
    sponsored,
    created_by: me.id, // strictly from authenticated session — never client-supplied
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version: 1,
  };
  const { error } = await db().from("posts").insert(row);
  if (error) return Problems.INTERNAL(error.message);

  await db().from("audit_log").insert({
    id: newId(),
    workspace_id: me.workspaceId,
    actor_id: me.id,
    action: "post.create",
    entity_type: "post",
    entity_id: id,
    details: { status: row.status },
  });

  return NextResponse.json(toPublic(row as unknown as Record<string, unknown>), { status: 201 });
}
