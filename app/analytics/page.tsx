"use client";
import { useEffect, useState } from "react";
import { PLATFORM_NAMES } from "@/lib/channels";
import type { Platform } from "@/lib/db";

type Row = { channelId: string; platform: Platform; followers: number; posts: number; impressions: number; likes: number; comments: number; shares: number; clicks: number; engagementRate: number };
type Data = {
  totals: { impressions: number; likes: number; comments: number; shares: number; clicks: number; posts: number; avgImpressions: number };
  perChannel: Row[];
  topPost: { id: string; text: string } | null;
};

export default function AnalyticsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => { fetch("/api/analytics").then((r) => r.json()).then(setData); }, []);

  async function exportCsv() {
    const res = await fetch("/api/analytics/export");
    const body = await res.json();
    setMsg(body.error ?? "");
  }

  if (!data) return <p className="muted">Loading...</p>;
  const t = data.totals;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Analytics</h1>
          <p className="sub">Fake numbers from the seed file. Nothing is pulled from the real platforms.</p>
        </div>
        <button className="ghost" onClick={exportCsv}>Export CSV</button>
      </div>
      {msg && <p className="error">{msg}</p>}
      <div className="stats">
        <div className="stat"><span className="stat-num">{t.posts}</span><span className="stat-label">Published posts</span></div>
        <div className="stat"><span className="stat-num">{t.impressions.toLocaleString()}</span><span className="stat-label">Impressions</span></div>
        <div className="stat"><span className="stat-num">{t.avgImpressions.toLocaleString()}</span><span className="stat-label">Avg impressions per post</span></div>
        <div className="stat"><span className="stat-num">{(t.likes + t.comments + t.shares).toLocaleString()}</span><span className="stat-label">Likes, comments, shares</span></div>
        <div className="stat"><span className="stat-num">{t.clicks.toLocaleString()}</span><span className="stat-label">Link clicks</span></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Channel</th><th>Followers</th><th>Posts</th><th>Impressions</th><th>Likes</th><th>Comments</th><th>Shares</th><th>Clicks</th><th>Engagement</th></tr>
          </thead>
          <tbody>
            {data.perChannel.map((c) => (
              <tr key={c.channelId}>
                <td>{PLATFORM_NAMES[c.platform]}</td>
                <td>{c.followers.toLocaleString()}</td>
                <td>{c.posts}</td>
                <td>{c.impressions.toLocaleString()}</td>
                <td>{c.likes}</td>
                <td>{c.comments}</td>
                <td>{c.shares}</td>
                <td>{c.clicks}</td>
                <td>{c.engagementRate.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.topPost && (
        <>
          <h2>Top post</h2>
          <div className="card" style={{ maxWidth: 640 }}>{data.topPost.text}</div>
        </>
      )}
    </>
  );
}
