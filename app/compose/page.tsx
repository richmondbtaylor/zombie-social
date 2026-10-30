"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Channel } from "@/lib/db";
import { LIMITS, PLATFORM_NAMES, countChars, ratioOk, ratioMessage } from "@/lib/channels";
import { useMe } from "@/lib/useMe";

type Toast = { kind: "error" | "success" | "warn"; msg: string } | null;
type Tone = "conversational" | "informal" | "professional";

const TONES: { id: Tone; label: string }[] = [
  { id: "conversational", label: "💬 Conversational" },
  { id: "informal", label: "😄 Informal" },
  { id: "professional", label: "👔 Professional" },
];

export default function ComposePage() {
  const router = useRouter();
  const me = useMe();
  const [channels, setChannels] = useState<Channel[]>([]);
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

  useEffect(() => {
    fetch("/api/channels")
      .then((r) => (r.ok ? r.json() : []))
      .then((list: Channel[]) => setChannels(list.filter((c) => c.connected && !c.frozen)));
  }, []);

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

  useEffect(() => {
    if (me?.deactivated) router.push("/auth/login?deactivated=1");
  }, [me, router]);

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

    // Editing an existing post → PATCH; new post → POST.
    const res = editingId
      ? await fetch(`/api/posts/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text, channelIds: picked,
            scheduledAt: when ? new Date(when).toISOString() : null,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            imageUrl, sponsored, status, version: editVersion,
          }),
        })
      : await fetch("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text, channelIds: picked,
            scheduledAt: when ? new Date(when).toISOString() : null,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            imageUrl, sponsored, status,
          }),
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
      // Read local dimensions to warn on aspect-ratio rules before scheduling.
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

  const canSubmit = me?.role !== "viewer" && !overLimit && ratioWarning.length === 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{editingId ? "Edit post" : "Compose"}</h1>
          <p className="sub">{editingId ? "Editing an existing post — save to update it." : "Write once. Pick the channels. Pick a time."}</p>
        </div>
      </div>

      {me?.role === "viewer" && (
        <div className="card" style={{ marginBottom: 16 }}>You have view-only access. Ask an owner or editor to publish.</div>
      )}

      <div className="two-col">
        <div className="card stack">
          <label>
            Post text
            <textarea rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder="What do you want to say?" />
          </label>

          <div className="ai-panel">
            <div className="muted small" style={{ marginBottom: 6 }}>Write it for me</div>
            <input
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="What's the post about? e.g. new pumpkin cold brew launching Friday"
            />
            <div className="row" style={{ marginTop: 8 }}>
              {TONES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={tone === t.id ? "small-btn" : "ghost small-btn"}
                  onClick={() => setTone(t.id)}
                  disabled={me?.role === "viewer"}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <button type="button" onClick={writeForMe} disabled={writing || me?.role === "viewer"}>
                {writing ? "Writing…" : "✨ Write it for me"}
              </button>
            </div>
          </div>

          <div>
            <div className="muted small" style={{ marginBottom: 6 }}>Channels</div>
            <div className="row">
              {channels.map((c) => (
                <button key={c.id} type="button" className={picked.includes(c.id) ? "" : "ghost"} onClick={() => toggle(c.id)} disabled={me?.role === "viewer"}>
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
            Image (optional)
            <input type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime" onChange={upload} />
          </label>
          {uploading && <div className="muted small">Uploading…</div>}
          {imageUrl && <div className="muted small">Asset: {imageUrl}</div>}
          <label style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 6, width: "auto" }}>
            <input type="checkbox" checked={sponsored} onChange={(e) => setSponsored(e.target.checked)} style={{ width: "auto" }} />
            This is a paid partnership or sponsored post (we append #ad)
          </label>

          {toast && <div className={`toast toast-${toast.kind}`}>{toast.msg}</div>}

          <div className="row">
            <button onClick={() => save("scheduled")} disabled={!canSubmit}>Schedule</button>
            <button className="ghost" onClick={() => save("draft")} disabled={me?.role === "viewer"}>Save draft</button>
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
                <span className={used > limit ? "counter-over" : "muted"}>{used} / {limit}</span>
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
