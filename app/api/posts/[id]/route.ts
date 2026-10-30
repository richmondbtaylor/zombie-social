import { NextResponse } from "next/server";
import { db, newId, type Post } from "@/lib/db";
import { getAuthMember, canEdit, canDelete, canSchedule } from "@/lib/auth";
import { Problems } from "@/lib/problem";
import { MIN_SCHEDULE_LEAD_MS } from "@/lib/config";

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

// Fields a client may change; everything else is server-controlled.
const ALLOWED_PATCH = new Set([
  "text", "channelIds", "scheduledAt", "timezone", "imageUrl",
  "sponsored", "status", "version", "comment",
]);

async function loadOwned(id: string, workspaceId: string) {
  const { data } = await db()
    .from("posts")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .single();
  return data as Record<string, unknown> | null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthMember();
  if (!me) return Problems.UNAUTHORIZED();
  const { id } = await params;
  const row = await loadOwned(id, me.workspaceId);
  if (!row) return Problems.NOT_FOUND("Post not found.");
  return NextResponse.json(toPublic(row));
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthMember();
  if (!me) return Problems.UNAUTHORIZED();
  if (me.deactivated) return Problems.FORBIDDEN("Your account has been deactivated.");
  if (!canEdit(me.role)) return Problems.FORBIDDEN("Viewers cannot edit posts.");

  const { id } = await params;
  const existing = await loadOwned(id, me.workspaceId);
  if (!existing) return Problems.NOT_FOUND("Post not found.");

  // A post under review is locked against concurrent edits.
  if (existing.in_review && me.role !== "owner") {
    return Problems.FORBIDDEN("This post is locked for review.");
  }

  const b = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};

  for (const key of Object.keys(b)) {
    if (!ALLOWED_PATCH.has(key)) continue; // silently drop anything not allowlisted
    if (key === "createdBy" || key === "id" || key === "workspaceId") continue;
  }

  if ("text" in b) updates.text = String(b.text);
  if ("imageUrl" in b) updates.image_url = String(b.imageUrl);
  if ("sponsored" in b) updates.sponsored = Boolean(b.sponsored);
  if ("timezone" in b) updates.timezone = String(b.timezone);
  if ("channelIds" in b && Array.isArray(b.channelIds)) updates.channel_ids = b.channelIds.map(String);

  if ("scheduledAt" in b) {
    const raw = b.scheduledAt;
    if (raw === null || raw === "") {
      updates.scheduled_at = null;
    } else {
      const dt = new Date(String(raw));
      if (Number.isNaN(dt.getTime())) return Problems.BAD_REQUEST("scheduledAt is not a valid timestamp.");
      if (dt.getTime() - Date.now() < MIN_SCHEDULE_LEAD_MS) {
        return Problems.BAD_REQUEST("scheduledAt must be at least 5 minutes in the future (UTC).");
      }
      updates.scheduled_at = dt.toISOString();
    }
  }

  // Status transitions with role policy.
  if ("status" in b) {
    const want = String(b.status);
    if (want === "scheduled") {
      if (!canSchedule(me.role)) return Problems.FORBIDDEN("You cannot schedule posts.");
      // Workspace policy requires owner approval before an editor schedules.
      if (me.role === "editor") {
        return Problems.FORBIDDEN("An owner must approve this post before it can be scheduled.");
      }
    }
    if (want === "pending_review") {
      updates.in_review = true;
    }
    if (["approved", "rejected"].includes(want) && me.role !== "owner") {
      return Problems.FORBIDDEN("Only an owner can approve or reject a post.");
    }
    if (want === "rejected" && !b.comment) {
      return Problems.BAD_REQUEST("A rejection note is required.");
    }
    if (["published", "processing", "publishing"].includes(want)) {
      return Problems.BAD_REQUEST("That status is set by the publishing engine, not by clients.");
    }
    // Editing a previously-approved post resets it to draft and clears the lock.
    if (existing.status === "approved" && "text" in b) {
      updates.status = "draft";
      updates.in_review = false;
    } else {
      updates.status = want;
    }
    if (want !== "pending_review") updates.in_review = false;
  }

  // Optimistic concurrency: client sends the version it read.
  const expectedVersion = Number(b.version ?? existing.version);
  updates.version = expectedVersion + 1;
  updates.updated_at = new Date().toISOString();

  const { error } = await db()
    .from("posts")
    .update(updates)
    .eq("id", id)
    .eq("version", expectedVersion);
  if (error) return Problems.INTERNAL(error.message);

  // Re-read; if the version moved under us, someone else edited first.
  const after = await loadOwned(id, me.workspaceId);
  if (!after || after.version !== expectedVersion + 1) {
    return Problems.CONFLICT("This post changed while you were editing. Reload and try again.");
  }

  if (b.comment) {
    await db().from("post_comments").insert({
      id: newId(),
      post_id: id,
      author_id: me.id,
      body: String(b.comment),
    });
  }

  await db().from("audit_log").insert({
    id: newId(),
    workspace_id: me.workspaceId,
    actor_id: me.id,
    action: "post.update",
    entity_type: "post",
    entity_id: id,
    details: { fields: Object.keys(updates) },
  });

  return NextResponse.json(toPublic(after));
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthMember();
  if (!me) return Problems.UNAUTHORIZED();
  if (me.deactivated) return Problems.FORBIDDEN("Your account has been deactivated.");
  if (!canDelete(me.role)) return Problems.FORBIDDEN("Viewers cannot delete posts.");

  const { id } = await params;
  const existing = await loadOwned(id, me.workspaceId);
  if (!existing) return Problems.NOT_FOUND("Post not found.");

  const { error } = await db().from("posts").delete().eq("id", id).eq("workspace_id", me.workspaceId);
  if (error) return Problems.INTERNAL(error.message);

  // Async storage cleanup would run here (Supabase cron/edge worker): delete any asset URL
  // no longer referenced by another post in this workspace, after DRAFT_MEDIA_RETENTION_DAYS
  // of inactivity for drafts.
  await db().from("audit_log").insert({
    id: newId(),
    workspace_id: me.workspaceId,
    actor_id: me.id,
    action: "post.delete",
    entity_type: "post",
    entity_id: id,
    details: { image_url: existing.image_url },
  });

  return NextResponse.json({ ok: true });
}
