"use client";
import { useEffect, useState } from "react";
import type { Channel, Post } from "@/lib/db";
import { PLATFORM_COLORS, PLATFORM_NAMES } from "@/lib/channels";

// Week view: seven columns in a CSS grid, Monday to Sunday.
function weekDays(offsetWeeks: number): string[] {
  const now = new Date();
  const monday = new Date(now);
  const dow = (now.getDay() + 6) % 7; // 0 = Monday
  monday.setDate(now.getDate() - dow + offsetWeeks * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    // ZOMBIE: toISOString() gives the UTC date, not the local date. In the evening in Miami
    // the "day" is already tomorrow in UTC, so columns can be off by one day. Build the key
    // from the local year, month and day.
    return d.toISOString().slice(0, 10);
  });
}

export default function CalendarPage() {
  const [offset, setOffset] = useState(0);
  const [posts, setPosts] = useState<Post[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);

  useEffect(() => {
    fetch("/api/posts").then((r) => r.json()).then(setPosts);
    fetch("/api/channels").then((r) => r.json()).then(setChannels);
  }, []);

  const days = weekDays(offset);
  const label = (iso: string) => new Date(iso + "T12:00").toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Calendar</h1>
          <p className="sub">One week at a time. Drafts without a date are not shown.</p>
        </div>
        <div className="row">
          <button className="ghost small-btn" onClick={() => setOffset(offset - 1)}>Previous week</button>
          <button className="ghost small-btn" onClick={() => setOffset(0)}>This week</button>
          <button className="ghost small-btn" onClick={() => setOffset(offset + 1)}>Next week</button>
        </div>
      </div>
      <div className="week">
        {days.map((day) => {
          const todays = posts
            .filter((p) => p.scheduledAt && p.scheduledAt.slice(0, 10) === day)
            .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));
          return (
            <div key={day} className="day">
              <div className="day-head">{label(day)}</div>
              {todays.length === 0 && <div className="muted small">Nothing</div>}
              {todays.map((p) => (
                <div key={p.id} className="slot">
                  <div className="small muted">{p.scheduledAt!.slice(11, 16)} · {p.status}</div>
                  <div className="slot-text">{p.text}</div>
                  <div className="row" style={{ gap: 4 }}>
                    {p.channelIds.map((id) => {
                      const c = channels.find((x) => x.id === id);
                      return c ? <span key={id} className="dot" title={PLATFORM_NAMES[c.platform]} style={{ background: PLATFORM_COLORS[c.platform] }} /> : null;
                    })}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}
