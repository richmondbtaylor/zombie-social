import { NextResponse } from "next/server";
import { db, newId } from "@/lib/db";
import { getAuthMember } from "@/lib/auth";
import { Problems } from "@/lib/problem";
import { encrypt } from "@/lib/crypto";

export const dynamic = "force-dynamic";

/**
 * OAuth callback. Validates state, exchanges the code for tokens with the provider,
 * dedupes on (platform, handle) so reconnecting an existing handle updates its row
 * instead of creating a duplicate, and stores tokens encrypted at rest.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const rawState = url.searchParams.get("state");
  if (!code || !rawState) return Problems.BAD_REQUEST("Missing code or state.");

  let state: { s: string; p: string; w: string };
  try {
    state = JSON.parse(rawState);
  } catch {
    return Problems.BAD_REQUEST("Malformed OAuth state.");
  }
  const platform = state.p as import("@/lib/db").Platform;

  // Verify the workspace member initiating this callback is still valid.
  const me = await getAuthMember();
  if (!me) return Problems.UNAUTHORIZED();
  if (me.workspaceId !== state.w) return Problems.FORBIDDEN("Workspace mismatch in OAuth state.");

  const clientId = process.env[`OAUTH_${platform.toUpperCase()}_CLIENT_ID`];
  const clientSecret = process.env[`OAUTH_${platform.toUpperCase()}_CLIENT_SECRET`];
  if (!clientId || !clientSecret) return Problems.INTERNAL(`${platform} OAuth credentials are not configured.`);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  const tokenRes = await fetch(
    platform === "linkedin"
      ? "https://www.linkedin.com/oauth/v2/accessToken"
      : "https://x.com/i/oauth2/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${appUrl}/api/channels/callback`,
      }),
    },
  );
  if (!tokenRes.ok) {
    return Problems.UNPROCESSABLE(`Token exchange failed with status ${tokenRes.status}.`);
  }
  const tok = await tokenRes.json();

  // Fetch profile to resolve name + handle for dedupe lookup.
  let handle = "";
  let name = "";
  try {
    if (platform === "linkedin") {
      const p = await fetch("https://api.linkedin.com/v2/userInfo", {
        headers: { Authorization: `Bearer ${tok.access_token}` },
      }).then((r) => r.json());
      handle = String(p.li_at_alias ?? p.id ?? "");
      name = String(p.name ?? handle);
    } else {
      const p = await fetch("https://api.twitter.com/2/users/me", {
        headers: { Authorization: `Bearer ${tok.access_token}` },
      }).then((r) => r.json());
      handle = String(p.data?.username ?? "");
      name = String(p.data?.name ?? handle);
    }
  } catch {
    /* fall through — we still store the tokens even if profile lookup fails */
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
    access_token_enc: encrypt(String(tok.access_token)),
    refresh_token_enc: encrypt(String(tok.refresh_token ?? "")),
    token_expires_at: tok.expires_in
      ? new Date(Date.now() + Number(tok.expires_in) * 1000).toISOString()
      : null,
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

  return NextResponse.redirect(`${appUrl}/channels?connected=1`);
}
