"use client";
import { useState } from "react";
import type { ChannelPublic, MemberRole, Post } from "@/lib/db";
import { PLATFORM_COLORS } from "@/lib/channels";

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function CalendarClient({
  initialPosts,
  initialChannels,
}: {
  initialPosts: Post[];
  initialChannels: ChannelPublic[];
  role: MemberRole;
}) {
  const [weekOffset, setWeekOffset] = useState(0);

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay() + weekOffset * 7);
  startOfWeek.setHours(0, 0, 0, 0);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return d;
  });

  const scheduled = initialPosts.filter((p) => ["scheduled", "publishing", "processing"].includes(p.status));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Calendar</h1>
          <p className="sub">Your posting schedule for the week.</p>
        </div>
        <div className="row">
          <button className="ghost small-btn" onClick={() => setWeekOffset((w) => w - 1)}>← Prev</button>
          <button className="ghost small-btn" onClick={() => setWeekOffset(0)}>This week</button>
          <button className="ghost small-btn" onClick={() => setWeekOffset((w) => w + 1)}>Next →</button>
        </div>
      </div>

      <div className="week">
        {days.map((d) => {
          const key = localDateKey(d);
          const dayPosts = scheduled.filter((p) => p.scheduledAtUtc && p.scheduledAtUtc.startsWith(key));
          return (
            <div key={key} className="day">
              <div className="day-head">
                {d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
              </div>
              {dayPosts.map((p) => (
                <div key={p.id} className="slot">
                  <div className="row" style={{ gap: 4 }}>
                    {p.channelIds.map((cid) => {
                      const ch = initialChannels.find((c) => c.id === cid);
                      return ch ? <span key={cid} className="dot" style={{ background: PLATFORM_COLORS[ch.platform] }} /> : null;
                    })}
                    <span className="muted small">{new Date(p.scheduledAtUtc!).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                  </div>
                  <div className="slot-text">{p.text}</div>
                </div>
              ))}
              {dayPosts.length === 0 && <div className="muted small" style={{ marginTop: 8 }}>—</div>}
            </div>
          );
        })}
      </div>
    </>
  );
}
