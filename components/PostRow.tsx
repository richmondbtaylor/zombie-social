"use client";
import { useState } from "react";
import type { ChannelPublic, MemberRole, Post } from "@/lib/db";
import { PLATFORM_NAMES } from "@/lib/channels";
import PlatformIcon from "@/components/PlatformIcon";
import { useRouter } from "next/navigation";

export function fmtTime(s: string | null): string {
  if (!s) return "No date yet";
  return new Date(s).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

interface Props { post: Post; channels: ChannelPublic[]; role: MemberRole; onChange: () => void }

export default function PostRow({ post, channels, role, onChange }: Props) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [when, setWhen] = useState(post.scheduledAtUtc ?? "");
  const [showError, setShowError] = useState(false);
  const [rewrite, setRewrite] = useState<{ text: string; tone: string } | null>(null);
  const [rewriting, setRewriting] = useState(false);

  const canEdit = role === "owner" || role === "editor";
  const names = post.channelIds.map((id) => channels.find((c) => c.id === id)).filter(Boolean) as ChannelPublic[];
  const failedResults = (post.results ?? []).filter((r) => r.status === "failed" || r.status === "rate_limited");

  async function publishNow() {
    setMsg("");
    const res = await fetch(`/api/posts/${post.id}/publish`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setMsg(res.ok ? (data.status ?? "Published.") : (data.detail ?? "Publish failed."));
    onChange();
  }

  async function remove() {
    await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
    onChange();
  }

  async function schedule() {
    if (!when) { setMsg("Pick a date and time first."); return; }
    const res = await fetch(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "scheduled", scheduledAt: when, version: post.version }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(data.detail ?? "Could not schedule.");
    onChange();
  }

  async function retry() {
    const res = await fetch(`/api/posts/${post.id}/publish`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setMsg(res.ok ? (data.status ?? "Retried.") : (data.detail ?? "Retry failed."));
    onChange();
  }

  async function submitReview() {
    const res = await fetch(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "pending_review", version: post.version }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(data.detail ?? "Could not submit for review.");
    onChange();
  }

  function edit() {
    router.push(`/compose?edit=${post.id}`);
  }

  async function rewriteTone(tone: "conversational" | "informal" | "professional") {
    setMsg("");
    setRewriting(true);
    try {
      const res = await fetch("/api/ai/repost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id, tone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg(data.detail ?? "Could not rewrite."); return; }
      setRewrite({ text: data.text, tone });
    } finally {
      setRewriting(false);
    }
  }

  async function applyRewrite() {
    if (!rewrite) return;
    const res = await fetch(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: rewrite.text, version: post.version }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setMsg(data.detail ?? "Could not save the rewrite."); return; }
    setRewrite(null);
    setMsg("Rewritten.");
    onChange();
  }

  return (
    <div className="card post-row">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 6 }}>
        <span className="muted small">{fmtTime(post.scheduledAtUtc)}</span>
        <span className={`pill status-${post.status}`}>{post.status.replace(/_/g, " ")}</span>
      </div>

      {!rewrite && <div className="post-text">{post.text}</div>}
      {rewrite && (
        <div className="rewrite-preview">
          <div className="muted small" style={{ marginBottom: 6 }}>AI rewrite · {rewrite.tone}</div>
          <div style={{ whiteSpace: "pre-wrap" }}>{rewrite.text}</div>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="small-btn" onClick={applyRewrite}>Use this</button>
            <button className="small-btn ghost" onClick={() => setRewrite(null)}>Discard</button>
          </div>
        </div>
      )}

      {post.imageUrl && (
        <div className="row" style={{ marginTop: 6 }}>
          <img src={post.imageUrl} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8 }} />
        </div>
      )}

      <div className="row" style={{ marginTop: 6 }}>
        {names.map((c) => (
          <span key={c.id} className="channel-tag">
            <PlatformIcon platform={c.platform} size={13} />
            {PLATFORM_NAMES[c.platform]}
          </span>
        ))}
        {post.sponsored && <span className="pill status-sponsored">sponsored</span>}
      </div>

      {failedResults.length > 0 && (
        <div className="error-badge" onClick={() => setShowError((s) => !s)}>
          {failedResults.length} channel error{failedResults.length > 1 ? "s" : ""} {showError ? "▾" : "▸"}
        </div>
      )}
      {showError && failedResults.map((r) => (
        <div key={r.channelId} className="error small">{channels.find((c) => c.id === r.channelId)?.handle}: {r.errorMessage}</div>
      ))}

      {canEdit && (
        <div className="row" style={{ marginTop: 10 }}>
          {post.status === "draft" && (
            <>
              <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} style={{ width: "auto" }} />
              <button className="small-btn" onClick={schedule}>Schedule</button>
            </>
          )}
          {post.status === "scheduled" && <button className="small-btn" onClick={publishNow}>Publish now</button>}
          {post.status === "failed" && (
            <>
              <button className="small-btn" onClick={retry}>Retry</button>
              <button className="small-btn ghost" onClick={edit}>Edit</button>
            </>
          )}
          {post.status === "draft" && role === "editor" && (
            <button className="small-btn ghost" onClick={submitReview}>Submit for review</button>
          )}
          {!rewrite && (
            <div className="row ai-actions">
              <button className="small-btn ghost" disabled={rewriting} onClick={() => rewriteTone("conversational")}>💬 Rewrite</button>
              <button className="small-btn ghost" disabled={rewriting} onClick={() => rewriteTone("informal")}>😄</button>
              <button className="small-btn ghost" disabled={rewriting} onClick={() => rewriteTone("professional")}>👔</button>
            </div>
          )}
          {["draft", "scheduled", "failed", "rejected"].includes(post.status) && (
            <button className="small-btn ghost danger" onClick={remove}>Delete</button>
          )}
        </div>
      )}
      {!canEdit && (
        <div className="muted small" style={{ marginTop: 8 }}>View-only access — actions hidden.</div>
      )}
      {msg && <div className="error" style={{ marginTop: 6 }}>{msg}</div>}
    </div>
  );
}
