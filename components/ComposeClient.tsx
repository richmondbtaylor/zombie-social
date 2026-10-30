"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ChannelPublic, MemberRole } from "@/lib/db";
import { LIMITS, PLATFORM_NAMES, countChars, ratioOk, ratioMessage } from "@/lib/channels";
import PlatformIcon from "@/components/PlatformIcon";

type Toast = { kind: "error" | "success" | "warn"; msg: string } | null;
type Tone = "conversational" | "informal" | "professional";

const TONES: { id: Tone; label: string }[] = [
  { id: "conversational", label: "💬 Conversational" },
  { id: "informal", label: "😄 Informal" },
  { id: "professional", label: "👔 Professional" },
];

export default function ComposeClient({
  initialChannels,
  role,
}: {
  initialChannels: ChannelPublic[];
  role: MemberRole;
}) {
  const router = useRouter();
  const [channels, setChannels] = useState(initialChannels.filter((c) => c.connected && !c.frozen));
  const [picked, setPicked] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [when, setWhen] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageDims, setImageDims] = useState<{ w: number; h: number } | null>(null);
  const [sponsored, setSponsored] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [uploading, setUploading] = useState(false);
  const [brief, setBrief] = useState("");
  const [tone, setTone] = useState<Tone>("conversational");
  const [writing, setWriting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editVersion, setEditVersion] = useState(1);

  // Load an existing post when editing (?edit=<id>) so Edit and AI rewrites round-trip.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("edit");
    if (!id) return;
    fetch(`/api/posts/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (!p) return;
        setEditingId(id);
        setText(p.text ?? "");
        setImageUrl(p.imageUrl ?? "");
        setSponsored(Boolean(p.sponsored));
        if (Array.isArray(p.channelIds)) setPicked(p.channelIds);
        if (p.scheduledAtUtc) setWhen(new Date(p.scheduledAtUtc).toISOString().slice(0, 16));
        setEditVersion(Number(p.version ?? 1));
      })
      .catch(() => {});
  }, []);

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function writeForMe() {
    setToast(null);
    if (!brief.trim()) {
      setToast({ kind: "warn", msg: "First tell the writer what the post is about." });
      return;
    }
    setWriting(true);
    try {
      const res = await fetch("/api/ai/draft-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief,
          tone,
          sponsored,
          platforms: pickedChannels.length
            ? pickedChannels.map((c) => c.platform)
            : Array.from(new Set(channels.map((c) => c.platform))),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({ kind: "error", msg: data.detail ?? "Could not write the post." });
        return;
      }
      setText(data.text);
      if (data.source === "builtin") {
        setToast({ kind: "success", msg: "Drafted with the built-in writer. Add an OPENAI_API_KEY for richer output." });
      } else {
        setToast({ kind: "success", msg: "Draft written — edit it however you like." });
      }
    } finally {
      setWriting(false);
    }
  }

  const pickedChannels = channels.filter((c) => picked.includes(c.id));
  const overLimit = pickedChannels.some((c) => countChars(text, c.platform) > LIMITS[c.platform]);

  async function save(status: "draft" | "scheduled") {
    setToast(null);
    if (status === "scheduled" && !when) {
      setToast({ kind: "error", msg: "Pick a date and time to schedule." });
      return;
    }
    if (status === "scheduled" && overLimit) {
      setToast({ kind: "error", msg: "Trim the text before scheduling — one or more channels are over their limit." });
      return;
    }

    const body = JSON.stringify({
      text, channelIds: picked,
      scheduledAt: when ? new Date(when).toISOString() : null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      imageUrl, sponsored, status,
    });

    const res = editingId
      ? await fetch(`/api/posts/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...JSON.parse(body), version: editVersion }),
        })
      : await fetch("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
    if (!res.ok) {
      const p = await res.json().catch(() => ({}));
      setToast({ kind: "error", msg: p.detail ?? p.error ?? "Could not save the post." });
      return;
    }
    setToast({ kind: "success", msg: status === "draft" ? "Draft saved." : "Scheduled." });
    setTimeout(() => router.push(status === "draft" ? "/drafts" : "/"), 600);
  }

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setToast(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setToast({ kind: "error", msg: data.detail ?? "Upload failed." });
        return;
      }
      setImageUrl(data.url);
      try {
        const bmp = await createImageBitmap(file);
        setImageDims({ w: bmp.width, h: bmp.height });
      } catch { setImageDims(null); }
      setToast({ kind: "success", msg: "Image uploaded." });
    } finally {
      setUploading(false);
    }
  }

  const ratioWarning = pickedChannels
    .filter((c) => imageDims && !ratioOk(imageDims.w, imageDims.h, c.platform))
    .map((c) => ratioMessage(c.platform));

  const canSubmit = role !== "viewer" && !overLimit && ratioWarning.length === 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{editingId ? "Edit post" : "Compose"}</h1>
          <p className="sub">{editingId ? "Editing an existing post — save to update it." : "Write once. Pick the channels. Pick a time."}</p>
        </div>
      </div>

      {role === "viewer" && (
        <div className="card" style={{ marginBottom: 16 }}>You have view-only access. Ask an owner or editor to publish.</div>
      )}

      <div className="compose-layout">
        <div className="card stack">
          <label>
            Post text
            <textarea rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder="What do you want to say?" />
          </label>

          <div className="ai-panel">
            <strong>✨ Write it for me</strong>
            <input
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="What's the post about? e.g. new pumpkin cold brew launching Friday"
              style={{ marginTop: 8 }}
            />
            <div className="row" style={{ marginTop: 8 }}>
              {TONES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`small-btn ${tone === t.id ? "" : "ghost"}`}
                  onClick={() => setTone(t.id)}
                  disabled={role === "viewer"}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <button type="button" onClick={writeForMe} disabled={writing || role === "viewer"}>
                {writing ? "Writing…" : "Generate draft"}
              </button>
            </div>
          </div>

          <div>
            <div className="muted small" style={{ marginBottom: 6 }}>Channels</div>
            <div className="row">
              {channels.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`channel-toggle ${picked.includes(c.id) ? "active" : ""}`}
                  onClick={() => toggle(c.id)}
                  disabled={role === "viewer"}
                >
                  <PlatformIcon platform={c.platform} size={15} />
                  {PLATFORM_NAMES[c.platform]}
                  <span className="muted small">{c.handle}</span>
                </button>
              ))}
            </div>
          </div>
          <label>
            Date and time
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </label>
          <label>
            Image (optional)
            <input type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime" onChange={upload} />
          </label>
          {uploading && <div className="muted small">Uploading…</div>}
          {imageUrl && (
            <div className="row" style={{ gap: 8 }}>
              <img src={imageUrl} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8 }} />
              <span className="muted small">{imageUrl}</span>
            </div>
          )}
          <label style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 6, width: "auto" }}>
            <input type="checkbox" checked={sponsored} onChange={(e) => setSponsored(e.target.checked)} style={{ width: "auto" }} />
            This is a paid partnership or sponsored post (we append #ad)
          </label>

          {toast && <div className={`toast toast-${toast.kind}`}>{toast.msg}</div>}

          <div className="row">
            <button onClick={() => save("scheduled")} disabled={!canSubmit}>Schedule</button>
            <button className="ghost" onClick={() => save("draft")} disabled={role === "viewer"}>Save draft</button>
          </div>
        </div>

        <div className="card stack">
          <strong>Character counts</strong>
          {pickedChannels.length === 0 && <div className="muted small">Pick a channel to see its limit.</div>}
          {pickedChannels.map((c) => {
            const used = countChars(text, c.platform);
            const limit = LIMITS[c.platform];
            const pct = Math.min((used / limit) * 100, 100);
            return (
              <div key={c.id} className="stack" style={{ gap: 2 }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="row" style={{ gap: 5, fontSize: 13 }}>
                    <PlatformIcon platform={c.platform} size={14} />
                    {PLATFORM_NAMES[c.platform]}
                  </span>
                  <span className={used > limit ? "counter-over" : "muted small"}>{used} / {limit}</span>
                </div>
                <div className="char-counter-bar">
                  <div className={`char-counter-fill ${used > limit ? "over" : ""}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
          {overLimit && (
            <div className="counter-over">
              Over the limit on at least one channel. Trim {Math.max(...pickedChannels.map((c) => countChars(text, c.platform) - LIMITS[c.platform]))} characters to continue.
            </div>
          )}
          {ratioWarning.map((w, i) => <div key={i} className="counter-over">{w}</div>)}
        </div>
      </div>
    </>
  );
}
