"use client";
import { useCallback, useEffect, useState } from "react";
import type { Channel, Platform } from "@/lib/db";
import { PLATFORM_NAMES } from "@/lib/channels";

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setChannels(await fetch("/api/channels").then((r) => r.json()));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function connect(platform: Platform) {
    setMsg("");
    const res = await fetch("/api/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform }),
    });
    const data = await res.json();
    setMsg(data.error ?? "Connected.");
  }

  async function disconnect(id: string) {
    await fetch(`/api/channels/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Channels</h1>
          <p className="sub">These accounts are fake. They are only names and handles in the seed file.</p>
        </div>
      </div>
      <div className="list">
        {channels.map((c) => (
          <div key={c.id} className="card row" style={{ justifyContent: "space-between" }}>
            <div>
              <strong>{PLATFORM_NAMES[c.platform]}</strong> <span className="muted">{c.handle}</span>
              <div className="muted small">{c.followers.toLocaleString()} followers</div>
            </div>
            <div className="row">
              <span className="pill">{c.connected ? "connected" : "disconnected"}</span>
              {c.connected && <button className="ghost small-btn" onClick={() => disconnect(c.id)}>Disconnect</button>}
            </div>
          </div>
        ))}
      </div>
      <h2>Connect an account</h2>
      <div className="row">
        {(Object.keys(PLATFORM_NAMES) as Platform[]).map((p) => (
          <button key={p} className="ghost" onClick={() => connect(p)}>Connect {PLATFORM_NAMES[p]}</button>
        ))}
      </div>
      {msg && <p className="error">{msg}</p>}
    </>
  );
}
