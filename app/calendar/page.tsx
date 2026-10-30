"use client";
import { useEffect, useState } from "react";
import type { Channel, Post } from "@/lib/db";
import { PLATFORM_COLORS, PLATFORM_NAMES } from "@/lib/channels";
import { useMe } from "@/lib/useMe";

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function weekDays(offsetWeeks: number): string[] {
  const now = new Date();
  const monday = new Date(now);
  const dow = (now.getDay() + 6) % 7;
  monday.setDate(now.getDate() - dow + offsetWeeks * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return localDateKey(d);
  });
}

export default function CalendarPage() {
  const me = useMe();
  const [offset, setOffset] = useState(0);
  const [posts, setPosts] = useState<Post[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [dragPost, setDragPost] = useState<Post | null>(null);
  const [tz] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);

  useEffect(() => {
    fetch("/api/posts").then((r) => (r.ok ? r.json() : [])).then(setPosts);
    fetch("/api/channels").then((r) => (r.ok ? r.json() : [])).then(setChannels);
  }, []);

  const days = weekDays(offset);
  const label = (iso: string) =>
    new Date(iso + "T12:00").toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

  function localDayOf(scheduledAtUtc: string | null): string | null {
    if (!scheduledAtUtc) return null;
    return localDateKey(new Date(scheduledAtUtc));
  }

  async function drop(day: string) {
    if (!dragPost) return;
    const oldDate = dragPost.scheduledAtUtc ? new Date(dragPost.scheduledAtUtc) : null;
    const timePart = oldDate ? `${String(oldDate.getUTCHours()).padStart(2, "0")}:${String(oldDate.getUTCMinutes()).padStart(2, "0")}` : "09:00";
    const [y, m, d] = day.split("-").map(Number);
    const target = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
    const [h, min] = timePart.split(":").map(Number);
    target.setUTCHours(h, min);
    await fetch(`/api/posts/${dragPost.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledAt: target.toISOString(), version: dragPost.version }),
    });
    setDragPost(null);
    fetch("/api/posts").then((r) => r.json()).then(setPosts);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Calendar</h1>
          <p className="sub">One week at a time. Drafts without a date are not shown. Drag to reschedule.</p>
        </div>
        <div className="row">
          <span className="muted small">Timezone: {tz}</span>
          <button className="ghost small-btn" onClick={() => setOffset(offset - 1)}>Previous week</button>
          <button className="ghost small-btn" onClick={() => setOffset(0)}>This week</button>
          <button className="ghost small-btn" onClick={() => setOffset(offset + 1)}>Next week</button>
        </div>
      </div>
      <div className="week">
        {days.map((day) => {
          const todays = posts
            .filter((p) => p.status !== "draft" && localDayOf(p.scheduledAtUtc) === day)
            .sort((a, b) => (a.scheduledAtUtc ?? "").localeCompare(b.scheduledAtUtc ?? ""));
          const MAX_VISIBLE = 4;
          const visible = todays.slice(0, MAX_VISIBLE);
          const extra = todays.length - MAX_VISIBLE;
          return (
            <div
              key={day}
              className="day"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => drop(day)}
            >
              <div className="day-head">{label(day)}</div>
              {todays.length === 0 && <div className="muted small">Nothing</div>}
              {visible.map((p) => (
                <div
                  key={p.id}
                  className="slot"
                  draggable={me?.role !== "viewer"}
                  onDragStart={() => setDragPost(p)}
                >
                  <div className="small muted">
                    {p.scheduledAtUtc ? new Date(p.scheduledAtUtc).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—"} · {p.status}
                  </div>
                  <div className="slot-text">{p.text}</div>
                  <div className="row" style={{ gap: 4 }}>
                    {p.channelIds.map((id) => {
                      const c = channels.find((x) => x.id === id);
                      return c ? <span key={id} className="dot" title={PLATFORM_NAMES[c.platform]} style={{ background: PLATFORM_COLORS[c.platform] }} /> : null;
                    })}
                  </div>
                </div>
              ))}
              {extra > 0 && <div className="muted small">+{extra} more</div>}
            </div>
          );
        })}
      </div>
    </>
  );
}
