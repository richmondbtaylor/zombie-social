import { NextResponse } from "next/server";
import { db, newId } from "@/lib/db";
import { getAuthMember, canPublish } from "@/lib/auth";
import { Problems } from "@/lib/problem";
import { publishToChannel, aggregateStatus, recordResult } from "@/lib/publish";
import { SYNC_PUBLISH_TIMEOUT_MS } from "@/lib/config";

export const dynamic = "force-dynamic";

/** Immediate publish with a 30s budget; hand off to cron on overrun. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthMember();
  if (!me) return Problems.UNAUTHORIZED();
  if (me.deactivated) return Problems.FORBIDDEN("Your account has been deactivated.");
  if (!canPublish(me.role)) return Problems.FORBIDDEN("Viewers cannot publish posts.");

  const { id } = await params;
  const { data: post } = await db().from("posts").select("*").eq("id", id).eq("workspace_id", me.workspaceId).single();
  if (!post) return Problems.NOT_FOUND("Post not found.");

  const channelIds: string[] = (post.channel_ids as string[]) ?? [];
  const { data: channels } = await db()
    .from("channels")
    .select("id, platform, handle, connected, frozen, access_token_enc")
    .in("id", channelIds)
    .eq("workspace_id", me.workspaceId);
  if (!channels || channels.length === 0) return Problems.UNPROCESSABLE("No usable channels for this post.");

  const disconnected = channels.filter((c) => !c.connected || c.frozen);
  if (disconnected.length > 0) {
    return Problems.UNPROCESSABLE(
      `Reconnect these channels before publishing: ${disconnected.map((c) => c.handle).join(", ")}.`,
    );
  }

  // Run dispatch inside a hard 30-second budget.
  const dispatch = async () => {
    const outcomes = await Promise.all(
      channels.map((c) =>
        publishToChannel(
          { id: c.id as string, platform: c.platform as never, accessTokenEnc: c.access_token_enc as string },
          post.text as string,
          post.image_url as string,
          post.sponsored as boolean,
        ).then((o) => ({ ...o, channelId: c.id as string })),
      ),
    );
    return outcomes;
  };

  const timer = new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), SYNC_PUBLISH_TIMEOUT_MS));
  const raced = await Promise.race([dispatch(), timer]);

  if (raced === "timeout") {
    const { error } = await db()
      .from("posts")
      .update({ status: "publishing", updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return Problems.INTERNAL(error.message);
    return NextResponse.json(
      { status: "publishing", detail: "Dispatch exceeded 30s and was handed off to the background scheduler." },
      { status: 202 },
    );
  }

  const overall = aggregateStatus(raced);
  for (const o of raced) await recordResult(id, o);
  const { error } = await db()
    .from("posts")
    .update({ status: overall, updated_at: new Date().toISOString(), version: (post.version as number) + 1 })
    .eq("id", id);
  if (error) return Problems.INTERNAL(error.message);

  await db().from("audit_log").insert({
    id: newId(),
    workspace_id: me.workspaceId,
    actor_id: me.id,
    action: "post.publish",
    entity_type: "post",
    entity_id: id,
    details: { overall },
  });

  return NextResponse.json({ status: overall, results: raced });
}
