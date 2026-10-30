import { NextResponse } from "next/server";
import { db, newId, type Platform } from "@/lib/db";
import { getAuthMember } from "@/lib/auth";
import { Problems } from "@/lib/problem";
import { encrypt, decrypt } from "@/lib/crypto";

export const dynamic = "force-dynamic";

const REVOKE_URLS: Partial<Record<Platform, string>> = {
  linkedin: "https://www.linkedin.com/oauth/v2/accessToken/revoke",
  x: "https://api.twitter.com/2/oauth2/revoke",
};

/** PATCH — refresh or update a channel. On refresh failure, set connected=false and log. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthMember();
  if (!me) return Problems.UNAUTHORIZED();
  if (me.role === "viewer") return Problems.FORBIDDEN("Viewers cannot modify channels.");

  const { id } = await params;
  const { data: ch } = await db()
    .from("channels")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", me.workspaceId)
    .single();
  if (!ch) return Problems.NOT_FOUND("Channel not found.");

  const b = await req.json().catch(() => ({}));

  // Explicit reconnect payload from the OAuth callback handler path.
  if (b.accessToken && b.refreshToken) {
    const { error } = await db()
      .from("channels")
      .update({
        access_token_enc: encrypt(String(b.accessToken)),
        refresh_token_enc: encrypt(String(b.refreshToken)),
        connected: true,
        frozen: false,
        token_expires_at: b.expiresAt ? String(b.expiresAt) : null,
      })
      .eq("id", id);
    if (error) return Problems.INTERNAL(error.message);
    return NextResponse.json({ ok: true });
  }

  // Token refresh attempt.
  if (b.action === "refresh") {
    try {
      const refreshToken = decrypt(ch.refresh_token_enc as string);
      const clientId = process.env[`OAUTH_${String(ch.platform).toUpperCase()}_CLIENT_ID`];
      const clientSecret = process.env[`OAUTH_${String(ch.platform).toUpperCase()}_CLIENT_SECRET`];
      if (!clientId || !clientSecret) throw new Error("OAuth credentials not configured");

      const tokenUrl =
        ch.platform === "linkedin"
          ? "https://www.linkedin.com/oauth/v2/accessToken"
          : "https://x.com/i/oauth2/token";
      const form = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      });
      const res = await fetch(tokenUrl, { method: "POST", body: form });
      if (!res.ok) throw new Error(`Refresh failed with status ${res.status}`);
      const json = await res.json();
      const { error } = await db()
        .from("channels")
        .update({
          access_token_enc: encrypt(json.access_token),
          refresh_token_enc: encrypt(json.refresh_token ?? refreshToken),
          connected: true,
          token_expires_at: json.expires_in
            ? new Date(Date.now() + Number(json.expires_in) * 1000).toISOString()
            : null,
        })
        .eq("id", id);
      if (error) return Problems.INTERNAL(error.message);
      return NextResponse.json({ ok: true, refreshed: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Token refresh failed";
      console.error(`[channel:${id}] refresh error`, message);
      const { error } = await db().from("channels").update({ connected: false }).eq("id", id);
      if (error) return Problems.INTERNAL(error.message);
      return Problems.UNPROCESSABLE(`Could not refresh the token for this account (${message}). Please re-authenticate.`);
    }
  }

  return Problems.BAD_REQUEST("Unknown PATCH action.");
}

/** DELETE — disconnect: revoke upstream token first, then wipe stored tokens. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getAuthMember();
  if (!me) return Problems.UNAUTHORIZED();
  if (me.role !== "owner" && me.role !== "editor") return Problems.FORBIDDEN("Only owners and editors can disconnect channels.");

  const { id } = await params;
  const { data: ch } = await db()
    .from("channels")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", me.workspaceId)
    .single();
  if (!ch) return Problems.NOT_FOUND("Channel not found.");

  // Best-effort revocation with the provider before wiping tokens locally.
  const revokeUrl = REVOKE_URLS[ch.platform as Platform];
  if (revokeUrl) {
    try {
      const accessToken = decrypt(ch.access_token_enc as string);
      const clientId = process.env[`OAUTH_${String(ch.platform).toUpperCase()}_CLIENT_ID`];
      const clientSecret = process.env[`OAUTH_${String(ch.platform).toUpperCase()}_CLIENT_SECRET`];
      const form = new URLSearchParams({ token: accessToken, client_id: clientId ?? "", client_secret: clientSecret ?? "" });
      await fetch(revokeUrl, { method: "POST", body: form });
    } catch (err) {
      console.warn(`[channel:${id}] revocation failed (continuing to wipe local tokens)`, err);
    }
  }

  const { error } = await db()
    .from("channels")
    .update({
      connected: false,
      access_token_enc: "",
      refresh_token_enc: "",
      token_expires_at: null,
    })
    .eq("id", id);
  if (error) return Problems.INTERNAL(error.message);

  await db().from("audit_log").insert({
    id: newId(),
    workspace_id: me.workspaceId,
    actor_id: me.id,
    action: "channel.disconnect",
    entity_type: "channel",
    entity_id: id,
    details: { platform: ch.platform },
  });

  return NextResponse.json({ ok: true });
}
