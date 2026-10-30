"use client";
import { useState } from "react";
import type { ChannelPublic, MemberRole, Platform } from "@/lib/db";
import { PLATFORM_NAMES } from "@/lib/channels";

export default function ChannelsClient({
  initialChannels,
  role,
}: {
  initialChannels: ChannelPublic[];
  role: MemberRole;
}) {
  const [channels, setChannels] = useState(initialChannels);
  const [msg, setMsg] = useState("");

  async function connect(platform: Platform) {
    setMsg("");
    const res = await fetch("/api/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform }),
    });
    const data = await res.json().catch(() => ({}));
    if (data.authorizeUrl) {
      window.location.href = data.authorizeUrl;
    } else {
      setMsg(data.detail ?? data.error ?? "Could not start OAuth flow.");
    }
  }

  async function disconnect(id: string) {
    setMsg("");
    const res = await fetch(`/api/channels/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data.detail ?? "Could not disconnect.");
      return;
    }
    setChannels((cs) => cs.map((c) => (c.id === id ? { ...c, connected: false } : c)));
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
      setMsg(data.detail ?? "Token refresh failed — reconnect the account.");
      setChannels((cs) => cs.map((c) => (c.id === id ? { ...c, connected: false } : c)));
      return;
    }
    setChannels((cs) => cs.map((c) => (c.id === id ? { ...c, connected: true } : c)));
  }

  return (
    <>
      <div className="list">
        {channels.map((c) => (
          <div key={c.id} className="card row" style={{ justifyContent: "space-between" }}>
            <div>
              <strong>{PLATFORM_NAMES[c.platform]}</strong> <span className="muted">{c.handle}</span>
              <div className="muted small">{c.followers.toLocaleString()} followers</div>
            </div>
            <div className="row">
              {!c.connected && (
                <span className="pill" style={{ background: "#fbe4e2", color: "var(--danger)" }}>
                  disconnected — reconnect
                </span>
              )}
              {c.connected && c.frozen && (
                <span className="pill" style={{ background: "#fff1d6", color: "#8a5a00" }}>frozen by plan</span>
              )}
              {c.connected && !c.frozen && <span className="pill">connected</span>}
              {role !== "viewer" && c.connected && (
                <>
                  <button className="ghost small-btn" onClick={() => refresh(c.id)}>Refresh token</button>
                  <button className="ghost small-btn" onClick={() => disconnect(c.id)}>Disconnect</button>
                </>
              )}
            </div>
          </div>
        ))}
        {channels.length === 0 && <div className="card empty"><strong>No channels yet.</strong></div>}
      </div>

      {role !== "viewer" && (
        <>
          <h2>Connect an account</h2>
          <div className="row">
            {(Object.keys(PLATFORM_NAMES) as Platform[]).map((p) => (
              <button key={p} className="ghost" onClick={() => connect(p)}>Connect {PLATFORM_NAMES[p]}</button>
            ))}
          </div>
        </>
      )}
      {msg && <p className="error">{msg}</p>}
    </>
  );
}
