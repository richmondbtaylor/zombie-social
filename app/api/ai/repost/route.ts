import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthMember, canEdit } from "@/lib/auth";
import { Problems } from "@/lib/problem";
import type { Platform } from "@/lib/db";
import { LIMITS } from "@/lib/channels";
import { POSTURE_PROMPTS, rewriteDraft } from "@/lib/aiWriter";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/repost  { postId, tone }
 * Rewrites an existing post in a new tone using the workspace's own published
 * history as voice reference, and returns the draft for review. It does NOT save —
 * the client shows a preview and the user accepts or discards it.
 */
export async function POST(req: Request) {
  const me = await getAuthMember();
  if (!me) return Problems.UNAUTHORIZED();
  if (!canEdit(me.role)) return Problems.FORBIDDEN("Viewers cannot rewrite posts.");

  const b = await req.json().catch(() => ({}));
  const postId = String(b.postId ?? "");
  const tone = String(b.tone ?? "conversational");
  if (!postId) return Problems.BAD_REQUEST("postId is required.");
  if (!(tone in POSTURE_PROMPTS)) {
    return Problems.BAD_REQUEST(`Unknown tone "${tone}". Choose: ${Object.keys(POSTURE_PROMPTS).join(", ")}.`);
  }

  const { data: post } = await db()
    .from("posts")
    .select("id, text, channel_ids, sponsored")
    .eq("id", postId)
    .eq("workspace_id", me.workspaceId)
    .single();
  if (!post) return Problems.NOT_FOUND("Post not found.");

  // Voice reference: this workspace's recent published posts.
  const { data: history } = await db()
    .from("posts")
    .select("text")
    .eq("workspace_id", me.workspaceId)
    .in("status", ["published", "partially_published"])
    .neq("id", postId)
    .limit(5);
  const samples = (history ?? []).map((h) => String(h.text)).filter(Boolean);

  // Resolve channel ids to their platforms for the character budget.
  let platforms: Platform[] = ["instagram"];
  if (Array.isArray(post.channel_ids) && post.channel_ids.length) {
    const { data: chs } = await db()
      .from("channels")
      .select("platform")
      .in("id", post.channel_ids as string[]);
    const found = [...new Set((chs ?? []).map((c) => c.platform as Platform))];
    if (found.length) platforms = found;
  }

  const text = await rewriteDraft(String(post.text), tone as keyof typeof POSTURE_PROMPTS, samples, platforms, Boolean(post.sponsored));
  if (!text) return Problems.INTERNAL("The writer could not produce a rewrite right now.");

  return NextResponse.json({ text, tone, postId });
}
