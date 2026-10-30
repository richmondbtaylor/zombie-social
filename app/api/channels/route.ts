import { NextResponse } from "next/server";
import { db, newId, type Platform } from "@/lib/db";
import { getAuthMember } from "@/lib/auth";
import { Problems } from "@/lib/problem";
import { encrypt } from "@/lib/crypto";
import { FREE_TIER_CHANNELS } from "@/lib/config";

export const dynamic = "force-dynamic";

const OAUTH_CONFIG: Partial<Record<Platform, { authUrl: string; scope: string }>> = {
  linkedin: {
    authUrl: "https://www.linkedin.com/oauth/v2/authorization",
    scope: "w_member_social r_liteprofile profile openid",
  },
  x: {
    authUrl: "https://x.com/i/oauth2/authorize",
    scope: "tweet.read tweet.write offline.access",
  },
};

/** Returns only safe fields — never access/refresh tokens. */
function toPublic(c: Record<string, unknown>) {
  return {
    id: c.id as string,
    workspaceId: c.workspace_id as string,
    platform: c.platform as Platform,
    name: c.name as string,
    handle: c.handle as string,
    followers: c.followers as number,
    connected: c.connected as boolean,
    frozen: c.frozen as boolean,
    tokenExpiresAt: (c.token_expires_at as string) ?? null,
  };
}

export async function GET() {
  const me = await getAuthMember();
  if (!me) return Problems.UNAUTHORIZED();
  const { data, error } = await db()
    .from("channels")
    .select("*")
    .eq("workspace_id", me.workspaceId)
    .order("platform");
  if (error) return Problems.INTERNAL(error.message);
  return NextResponse.json((data ?? []).map(toPublic));
}

/** Start an OAuth connection flow for a platform. */
export async function POST(req: Request) {
  const me = await getAuthMember();
  if (!me) return Problems.UNAUTHORIZED();
  if (me.role === "viewer") return Problems.FORBIDDEN("Viewers cannot connect channels.");

  const { platform } = await req.json().catch(() => ({ platform: null }));
  if (!platform || !(platform in OAUTH_CONFIG)) {
    return Problems.BAD_REQUEST(
      `Unsupported platform "${platform}". Supported: ${Object.keys(OAUTH_CONFIG).join(", ")}.`,
    );
  }

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

  const cfg = OAUTH_CONFIG[platform as Platform]!;
  const clientId = process.env[`OAUTH_${String(platform).toUpperCase()}_CLIENT_ID`];
  if (!clientId) {
    return Problems.UNPROCESSABLE(`${platform} OAuth is not configured on this deployment.`);
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return Problems.INTERNAL("NEXT_PUBLIC_APP_URL is not set.");
  const redirectUri = `${appUrl}/api/channels/callback`;

  const state = newId();
  await db().from("audit_log").insert({
    id: newId(),
    workspace_id: me.workspaceId,
    actor_id: me.id,
    action: "channel.oauth_start",
    entity_type: "channel",
    entity_id: state,
    details: { platform },
  });

  const url = new URL(cfg.authUrl);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", cfg.scope);
  url.searchParams.set("state", JSON.stringify({ s: state, p: platform, w: me.workspaceId }));

  return NextResponse.json({ authorizeUrl: url.toString(), state });
}
