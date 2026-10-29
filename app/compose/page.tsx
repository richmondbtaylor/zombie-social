"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Channel } from "@/lib/db";
import { LIMITS, PLATFORM_NAMES, countChars } from "@/lib/channels";
import { useMe } from "@/lib/useMe";

export default function ComposePage() {
  const router = useRouter();
  const me = useMe();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [when, setWhen] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [sponsored, setSponsored] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/channels").then((r) => r.json()).then((list: Channel[]) => setChannels(list.filter((c) => c.connected)));
  }, []);

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function save(status: "draft" | "scheduled") {
    setError("");
    if (status === "scheduled" && !when) { setError("Pick a date and time to schedule."); return; }
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, channelIds: picked, scheduledAt: when || null, imageUrl, sponsored, status, createdBy: me }),
    });
    if (!res.ok) { setError("Could not save the post."); return; }
    router.push(status === "draft" ? "/drafts" : "/");
  }

  async function upload() {
    const res = await fetch("/api/upload", { method: "POST" });
    const data = await res.json();
    setError(data.error ?? "");
  }

  const pickedChannels = channels.filter((c) => picked.includes(c.id));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Compose</h1>
          <p className="sub">Write once. Pick the channels. Pick a time.</p>
        </div>
      </div>
      <div className="two-col">
        <div className="card stack">
          <label>
            Post text
            <textarea rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder="What do you want to say?" />
          </label>
          <div>
            <div className="muted small" style={{ marginBottom: 6 }}>Channels</div>
            <div className="row">
              {channels.map((c) => (
                <button key={c.id} type="button" className={picked.includes(c.id) ? "" : "ghost"} onClick={() => toggle(c.id)}>
                  {PLATFORM_NAMES[c.platform]} {c.handle}
                </button>
              ))}
            </div>
          </div>
          <label>
            Date and time
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </label>
          <label>
            Image URL (optional)
            <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
          </label>
          <div className="row">
            <button type="button" className="ghost small-btn" onClick={upload}>Upload an image</button>
            <label style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 6, width: "auto" }}>
              <input type="checkbox" checked={sponsored} onChange={(e) => setSponsored(e.target.checked)} style={{ width: "auto" }} />
              This is a paid partnership or sponsored post
            </label>
          </div>
          {error && <div className="error">{error}</div>}
          <div className="row">
            <button onClick={() => save("scheduled")}>Schedule</button>
            <button className="ghost" onClick={() => save("draft")}>Save draft</button>
          </div>
        </div>
        <div className="card stack">
          <strong>Character counts</strong>
          {pickedChannels.length === 0 && <div className="muted">Pick a channel to see its limit.</div>}
          {pickedChannels.map((c) => {
            const used = countChars(text, c.platform);
            const limit = LIMITS[c.platform];
            return (
              <div key={c.id} className="row" style={{ justifyContent: "space-between" }}>
                <span>{PLATFORM_NAMES[c.platform]}</span>
                <span className={used > limit ? "error" : "muted"}>{used} / {limit}</span>
              </div>
            );
          })}
          <div className="muted small">The counter only warns. It does not block you.</div>
        </div>
      </div>
    </>
  );
}
