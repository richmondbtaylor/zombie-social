import * as fs from "fs";
import * as path from "path";

// Load .env.local manually (dotenv/config doesn't find it by default)
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const idx = line.indexOf("=");
    if (idx > 0 && !line.startsWith("#")) {
      process.env[line.slice(0, idx).trim()] ||= line.slice(idx + 1).trim();
    }
  }
}

import { db, newId } from "../lib/db";
import { encrypt } from "../lib/crypto";
import seed from "../data/seed.json";

async function run() {
  const supabase = db();

  // 1. Create workspace
  const workspaceId = newId();
  const { error: wsErr } = await supabase.from("workspaces").insert({
    id: workspaceId,
    name: "Harbor & Pine Coffee",
    timezone: "America/New_York",
    plan: "free",
  });
  if (wsErr) throw wsErr;

  // 2. Seed members (map old ids → new UUIDs)
  const memberMap = new Map<string, string>();
  for (const m of seed.members) {
    const id = newId();
    memberMap.set(m.id, id);
    const { error } = await supabase.from("members").insert({
      id,
      workspace_id: workspaceId,
      user_id: id, // placeholder — real auth users will replace this
      name: m.name,
      email: m.email,
      role: m.role,
    });
    if (error) throw error;
  }

  // 3. Seed channels
  const channelMap = new Map<string, string>();
  for (const c of seed.channels) {
    const id = newId();
    channelMap.set(c.id, id);
    const { error } = await supabase.from("channels").insert({
      id,
      workspace_id: workspaceId,
      platform: c.platform,
      name: c.name,
      handle: c.handle,
      followers: c.followers,
      connected: c.connected,
      frozen: false,
      access_token_enc: encrypt(c.accessToken),
      refresh_token_enc: encrypt(c.refreshToken),
    });
    if (error) throw error;
  }

  // 4. Seed posts + results
  for (const p of seed.posts) {
    const postId = newId();
    const newChannelIds = p.channelIds.map((cid) => channelMap.get(cid)!);
    const { error: postErr } = await supabase.from("posts").insert({
      id: postId,
      workspace_id: workspaceId,
      text: p.text,
      channel_ids: newChannelIds,
      scheduled_at: p.scheduledAt ? new Date(p.scheduledAt).toISOString() : null,
      timezone: "America/New_York",
      status: p.status,
      image_url: p.imageUrl,
      sponsored: p.sponsored,
      created_by: memberMap.get(p.createdBy)!,
      created_at: p.createdAt,
    });
    if (postErr) throw postErr;

    if (p.results) {
      for (const r of p.results) {
        const { error } = await supabase.from("post_results").insert({
          id: newId(),
          post_id: postId,
          channel_id: channelMap.get(r.channelId)!,
          status: "success",
          impressions: r.impressions,
          likes: r.likes,
          comments: r.comments,
          shares: r.shares,
          clicks: r.clicks,
        });
        if (error) throw error;
      }
    }
  }

  console.log("Seed complete. Workspace:", workspaceId);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
