"use client";
import { useState } from "react";
import type { ChannelPublic, MemberRole, Platform } from "@/lib/db";
import { PLATFORM_NAMES, PLATFORM_COLORS } from "@/lib/channels";
import PlatformIcon from "@/components/PlatformIcon";

const ALL_PLATFORMS: Platform[] = ["instagram", "linkedin", "x", "tiktok", "facebook"];

export default function ChannelsClient({
  initialChannels,
  role,
}: {
  initialChannels: ChannelPublic[];
  role: MemberRole;
}) {
  const [channels, setChannels] = useState(initialChannels);
  const [msg, setMsg] = useState("");
  const [msgKind, setMsgKind] = useState<"ok" | "err">("ok");
  const [connecting, setConnecting] = useState<Platform | null>(null);
  const [handle, setHandle] = useState("");
  const [name, setName] = useState("");

  function flash(text: string, kind: "ok" | "err") {
    setMsg(text);
    setMsgKind(kind);
    setTimeout(() => setMsg(""), 5000);
  }

  async function startConnect(platform: Platform) {
    // For LinkedIn & X, try the real OAuth flow first.
    if (platform === "linkedin" || platform === "x") {
      setConnecting(null);
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.authorizeUrl) {
        window.location.href = data.authorizeUrl;
        return;
      }
      // OAuth not configured → fall through to manual connect.
    }
    setConnecting(platform);
    setHandle("");
    setName("");
  }

  async function submitConnect() {
    if (!connecting || !handle.trim()) return;
    setMsg("");
    const res = await fetch("/api/channels/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform: connecting, handle: handle.trim(), name: name.trim() || handle.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      flash(data.detail ?? "Could not connect.", "err");
      return;
    }
    setChannels((cs) => [...cs, data.channel]);
    flash(`Connected ${PLATFORM_NAMES[connecting]}!`, "ok");
    setConnecting(null);
  }

  async function disconnect(id: string) {
    setMsg("");
    const res = await fetch(`/api/channels/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      flash(data.detail ?? "Could not disconnect.", "err");
      return;
    }
    setChannels((cs) => cs.map((c) => (c.id === id ? { ...c, connected: false } : c)));
    flash("Disconnected.", "ok");
  }

  async function refresh(id: string) {
    setMsg("");
    const res = await fetch(`/api/channels/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "refresh" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      flash(data.detail ?? "Token refresh failed — try reconnecting.", "err");
      setChannels((cs) => cs.map((c) => (c.id === id ? { ...c, connected: false } : c)));
      return;
    }
    setChannels((cs) => cs.map((c) => (c.id === id ? { ...c, connected: true } : c)));
    flash("Token refreshed.", "ok");
  }

  const canEdit = role === "owner" || role === "editor";

  return (
    <>
      {/* Connected channels */}
      <div className="channel-grid">
        {channels.map((c) => (
          <div key={c.id} className="channel-card" style={{ borderTopColor: PLATFORM_COLORS[c.platform] }}>
            <div className="channel-card-head">
              <PlatformIcon platform={c.platform} size={28} />
              <div>
                <strong>{PLATFORM_NAMES[c.platform]}</strong>
                <div className="muted small">{c.handle}</div>
              </div>
              {c.connected && !c.frozen && <span className="pill status-published">connected</span>}
              {c.connected && c.frozen && <span className="pill status-sponsored">frozen by plan</span>}
              {!c.connected && <span className="pill status-failed">disconnected</span>}
            </div>
            <div className="channel-card-body">
              <div className="stat" style={{ padding: 0, border: "none", background: "none" }}>
                <span className="stat-num">{c.followers.toLocaleString()}</span>
                <span className="stat-label">followers</span>
              </div>
              {canEdit && (
                <div className="row" style={{ marginTop: 8 }}>
                  {c.connected && (
                    <>
                      <button className="small-btn ghost" onClick={() => refresh(c.id)}>Refresh</button>
                      <button className="small-btn ghost" style={{ color: "var(--danger)" }} onClick={() => disconnect(c.id)}>Disconnect</button>
                    </>
                  )}
                  {!c.connected && (
                    <button className="small-btn" onClick={() => startConnect(c.platform)}>Reconnect</button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Connect new channels */}
      {canEdit && (
        <>
          <h2>Connect an account</h2>
          <div className="connect-grid">
            {ALL_PLATFORMS.map((p) => {
              const existing = channels.find((c) => c.platform === p && c.connected);
              return (
                <button
                  key={p}
                  className="connect-btn"
                  style={{ "--pc": PLATFORM_COLORS[p] } as React.CSSProperties}
                  onClick={() => startConnect(p)}
                  disabled={!!existing}
                >
                  <PlatformIcon platform={p} size={24} />
                  <span>{PLATFORM_NAMES[p]}</span>
                  {existing && <span className="small muted">✓</span>}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Manual connect modal */}
      {connecting && (
        <div className="modal-overlay" onClick={() => setConnecting(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ marginBottom: 12 }}>
              <PlatformIcon platform={connecting} size={24} />
              <strong>Connect {PLATFORM_NAMES[connecting]}</strong>
            </div>
            <label>
              Account name
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Harbor & Pine Coffee" />
            </label>
            <label>
              Handle
              <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder={connecting === "instagram" ? "@harborpine.coffee" : connecting === "tiktok" ? "@harborpinecoffee" : "your-handle"} />
            </label>
            <div className="row" style={{ marginTop: 12 }}>
              <button onClick={submitConnect}>Connect</button>
              <button className="ghost" onClick={() => setConnecting(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {msg && <p className={msgKind === "ok" ? "toast toast-success" : "toast toast-error"} style={{ marginTop: 12 }}>{msg}</p>}
    </>
  );
}
