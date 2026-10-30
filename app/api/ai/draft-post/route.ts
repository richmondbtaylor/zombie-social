import { NextResponse } from "next/server";
import { getAuthMember, canCreate } from "@/lib/auth";
import { Problems } from "@/lib/problem";
import { LIMITS } from "@/lib/channels";
import type { Platform } from "@/lib/db";
import { db } from "@/lib/db";
import { draftFromBrief, POSTURE_PROMPTS, type Tone } from "@/lib/aiWriter";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/draft-post  { brief, tone, platforms, sponsored }
 * Writes a new post from a short brief in the chosen tone. Uses an LLM when
 * OPENAI_API_KEY is set; otherwise falls back to the built-in composer so the
 * feature works with no keys. Returns text only — the client fills the form.
 */
export async function POST(req: Request) {
  const me = await getAuthMember();
  if (!me) return Problems.UNAUTHORIZED();
  if (!canCreate(me.role)) return Problems.FORBIDDEN("Viewers cannot draft posts.");

  const b = await req.json().catch(() => ({}));
  const brief = String(b.brief ?? "").trim();
  const tone = (Object.keys(POSTURE_PROMPTS).includes(b.tone) ? b.tone : "conversational") as Tone;
  const sponsored = Boolean(b.sponsored);
  const platforms: Platform[] = Array.isArray(b.platforms) && b.platforms.length
    ? (b.platforms.filter((p: string) => p in LIMITS) as Platform[])
    : ["instagram"];
  if (!platforms.length) platforms.push("instagram");
  if (platforms.length === 0) platforms.push("instagram");

  if (!brief) return Problems.BAD_REQUEST("Tell the writer what the post is about first.");
  if (brief.length > 500) return Problems.BAD_REQUEST("Keep the brief under 500 characters.");

  // Voice reference: recent published posts from this workspace.
  const { data: history } = await db()
    .from("posts")
    .select("text")
    .eq("workspace_id", me.workspaceId)
    .in("status", ["published", "partially_published"])
    .limit(5);
  const samples = (history ?? []).map((h) => String(h.text)).filter(Boolean);

  const { text, source } = await draftFromBrief(brief, tone, platforms, sponsored, samples);
  return NextResponse.json({ text, source });
}
