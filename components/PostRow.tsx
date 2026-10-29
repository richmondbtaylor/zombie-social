"use client";
import { useState } from "react";
import type { Channel, Post } from "@/lib/db";
import { PLATFORM_NAMES } from "@/lib/channels";

export function fmtTime(s: string | null): string {
  if (!s) return "No date yet";
  return new Date(s).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// One post in the queue or the drafts list.
export default function PostRow({ post, channels, onChange }: { post: Post; channels: Channel[]; onChange: () => void }) {
  const [msg, setMsg] = useState("");
  const [when, setWhen] = useState(post.scheduledAt ?? "");
  const names = post.channelIds.map((id) => channels.find((c) => c.id === id)).filter(Boolean) as Channel[];

  async function publishNow() {
    setMsg("");
    const res = await fetch(`/api/posts/${post.id}/publish`, { method: "POST" });
    const data = await res.json();
    setMsg(data.error ?? "Published.");
    onChange();
  }
  async function remove() {
    await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
    onChange();
  }
  async function schedule() {
    if (!when) { setMsg("Pick a date and time first."); return; }
    await fetch(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "scheduled", scheduledAt: when }),
    });
    onChange();
  }

  return (
    <div className="card stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="muted small">{fmtTime(post.scheduledAt)}</span>
        <span className={`pill status-${post.status}`}>{post.status}</span>
      </div>
      <div>{post.text}</div>
      {post.imageUrl && <div className="muted small">Image: {post.imageUrl}</div>}
      <div className="row">
        {names.map((c) => <span key={c.id} className="pill">{PLATFORM_NAMES[c.platform]}</span>)}
        {post.sponsored && <span className="pill status-sponsored">sponsored</span>}
      </div>
      <div className="row">
        {post.status === "draft" && (
          <>
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} style={{ width: "auto" }} />
            <button className="small-btn" onClick={schedule}>Schedule</button>
          </>
        )}
        {post.status === "scheduled" && <button className="small-btn" onClick={publishNow}>Publish now</button>}
        <button className="small-btn ghost" onClick={remove}>Delete</button>
      </div>
      {msg && <div className="error">{msg}</div>}
    </div>
  );
}
