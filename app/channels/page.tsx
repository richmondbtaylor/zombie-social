import { db } from "@/lib/db";
import { getAuthMember } from "@/lib/auth";
import type { ChannelPublic, Platform } from "@/lib/db";
import ChannelsClient from "@/components/ChannelsClient";

export const dynamic = "force-dynamic";

export default async function ChannelsPage() {
  const me = await getAuthMember();
  if (!me) {
    return (
      <div className="card">
        <strong>Not signed in.</strong>
        <p className="muted">Run the app with DEMO_MODE=1 to use the demo workspace.</p>
      </div>
    );
  }

  const { data } = await db()
    .from("channels")
    .select("*")
    .eq("workspace_id", me.workspaceId)
    .order("platform");

  const channels: ChannelPublic[] = (data ?? []).map((c) => ({
    id: c.id as string,
    workspaceId: c.workspace_id as string,
    platform: c.platform as Platform,
    name: c.name as string,
    handle: c.handle as string,
    followers: c.followers as number,
    connected: c.connected as boolean,
    frozen: c.frozen as boolean,
    accessTokenEnc: "",
    refreshTokenEnc: "",
    tokenExpiresAt: (c.token_expires_at as string) ?? null,
    lastRateLimitReset: (c.last_rate_limit_reset as string) ?? null,
  }));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Channels</h1>
          <p className="sub">Your connected social accounts. Reconnect any that have expired tokens.</p>
        </div>
      </div>
      <ChannelsClient initialChannels={channels} role={me.role} />
    </>
  );
}
