import { NextResponse } from "next/server";
import { db, newId, type Platform } from "@/lib/db";
import { getAuthMember } from "@/lib/auth";
import { canEdit } from "@/lib/auth";
import { Problems } from "@/lib/problem";
import { FREE_TIER_CHANNELS } from "@/lib/config";

export const dynamic = "force-dynamic";

/**
 * POST /api/channels/connect  { platform, handle, name }
 * Manual connect for platforms without real OAuth (Instagram, TikTok, Facebook)
 * or as a fallback when LinkedIn/X OAuth isn't configured on this deployment.
 * Creates the channel row with connected=true and no tokens — publishing to these
 * channels is simulated by the publish pipeline.
 */
export async function POST(req: Request) {
  const me = await getAuthMember();
  if (!me) return Problems.UNAUTHORIZED();
  if (!canEdit(me.role)) return Problems.FORBIDDEN("Viewers cannot connect channels.");

  const b = await req.json().catch(() => ({}));
  const platform = String(b.platform ?? "") as Platform;
  const handle = String(b.handle ?? "").trim();
  const name = String(b.name ?? "").trim() || handle;

  const VALID: Platform[] = ["instagram", "linkedin", "x", "tiktok", "facebook"];
  if (!VALID.includes(platform)) return Problems.BAD_REQUEST("Unknown platform.");
  if (!handle) return Problems.BAD_REQUEST("Handle is required.");

  // Free-tier paywall check.
  const { count } = await db()
    .from("channels")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", me.workspaceId)
    .eq("connected", true);
  const { data: ws } = await db().from("workspaces").select("plan").eq("id", me.workspaceId).single();
  if (ws?.plan === "free" && (count ?? 0) >= FREE_TIER_CHANNELS) {
    return Problems.FORBIDDEN(`The free plan allows up to ${FREE_TIER_CHANNELS} connected channels. Upgrade to connect more.`);
  }

  // Dedupe: update existing channel for this workspace+platform+handle.
  const { data: existing } = await db()
    .from("channels")
    .select("id")
    .eq("workspace_id", me.workspaceId)
    .eq("platform", platform)
    .eq("handle", handle)
    .maybeSingle();

  const payload = {
    workspace_id: me.workspaceId,
    platform,
    name,
    handle,
    connected: true,
    frozen: false,
    access_token_enc: "",
    refresh_token_enc: "",
    token_expires_at: null,
  };

  let channelId: string;
  if (existing) {
    await db().from("channels").update(payload).eq("id", existing.id);
    channelId = existing.id;
  } else {
    channelId = newId();
    await db().from("channels").insert({ id: channelId, ...payload });
  }

  await db().from("audit_log").insert({
    id: newId(),
    workspace_id: me.workspaceId,
    actor_id: me.id,
    action: existing ? "channel.reconnect" : "channel.connect",
    entity_type: "channel",
    entity_id: channelId,
    details: { platform, handle },
  });

  const { data: ch } = await db().from("channels").select("*").eq("id", channelId).single();

  return NextResponse.json({
    ok: true,
    channel: {
      id: ch!.id as string,
      workspaceId: ch!.workspace_id as string,
      platform: ch!.platform as Platform,
      name: ch!.name as string,
      handle: ch!.handle as string,
      followers: ch!.followers as number,
      connected: ch!.connected as boolean,
      frozen: ch!.frozen as boolean,
      accessTokenEnc: "",
      refreshTokenEnc: "",
      tokenExpiresAt: (ch!.token_expires_at as string) ?? null,
      lastRateLimitReset: (ch!.last_rate_limit_reset as string) ?? null,
    },
  });
}
