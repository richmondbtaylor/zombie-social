import { db } from "@/lib/db";
import { getAuthMember } from "@/lib/auth";
import type { ChannelPublic, Platform } from "@/lib/db";
import ComposeClient from "@/components/ComposeClient";

export const dynamic = "force-dynamic";

function toChannel(c: Record<string, unknown>): ChannelPublic {
  return {
    id: c.id as string, workspaceId: c.workspace_id as string, platform: c.platform as Platform,
    name: c.name as string, handle: c.handle as string, followers: c.followers as number,
    connected: c.connected as boolean, frozen: c.frozen as boolean,
    tokenExpiresAt: (c.token_expires_at as string) ?? null,
    lastRateLimitReset: (c.last_rate_limit_reset as string) ?? null,
  };
}

export default async function ComposePage() {
  const me = await getAuthMember();
  if (!me) {
    return <div className="card"><strong>Not signed in.</strong><p className="muted">Run with DEMO_MODE=1 for the demo workspace.</p></div>;
  }

  const { data } = await db()
    .from("channels")
    .select("*")
    .eq("workspace_id", me.workspaceId)
    .order("platform");

  const channels = (data ?? []).map(toChannel);

  return <ComposeClient initialChannels={channels} role={me.role} />;
}
