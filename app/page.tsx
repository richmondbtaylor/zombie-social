"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { Channel, Post } from "@/lib/db";
import PostRow from "@/components/PostRow";
import { useMe } from "@/lib/useMe";
import { PLATFORM_NAMES, PLATFORM_COLORS } from "@/lib/channels";

const PAGE_SIZE = 20;
type Tab = "scheduled" | "history";
type Filter = { platform: string; status: string };

export default function QueuePage() {
  const me = useMe();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>("scheduled");
  const [filter, setFilter] = useState<Filter>({ platform: "", status: "" });
  const [historyPage, setHistoryPage] = useState(1);

  const load = useCallback(async () => {
    const [p, c] = await Promise.all([
      fetch("/api/posts").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/channels").then((r) => (r.ok ? r.json() : [])),
    ]);
    setPosts(Array.isArray(p) ? p : []);
    setChannels(Array.isArray(c) ? c : []);
    setLoaded(true);
  }, []);
  useEffect(() => { load(); }, [load]);

  // Deactivated account → force re-auth.
  useEffect(() => {
    if (me && me.deactivated) router.push("/auth/login?deactivated=1");
  }, [me, router]);

  const ACTIVE = new Set(["scheduled", "publishing", "processing"]);
  const HISTORY = new Set(["published", "partially_published", "partially_failed", "failed"]);

  const withFilters = (list: Post[]) =>
    list.filter((p) => {
      if (filter.platform && !p.channelIds.some((id) => {
        const c = channels.find((x) => x.id === id);
        return c?.platform === filter.platform;
      })) return false;
      if (filter.status && p.status !== filter.status) return false;
      return true;
    });

  // Scheduled tab: soonest first (ascending).
  const scheduledList = withFilters(
    posts.filter((p) => ACTIVE.has(p.status)).sort((a, b) =>
      (a.scheduledAtUtc ?? "").localeCompare(b.scheduledAtUtc ?? "")),
  );

  // History tab: newest first (descending), cursor-paginated 20 per batch.
  const historyAll = withFilters(
    posts.filter((p) => HISTORY.has(p.status)).sort((a, b) =>
      (b.scheduledAtUtc ?? "").localeCompare(a.scheduledAtUtc ?? "")),
  );
  const historyList = historyAll.slice(0, historyPage * PAGE_SIZE);
  const hasMore = historyAll.length > historyList.length;

  const scheduledCount = posts.filter((p) => ACTIVE.has(p.status)).length;
  const draftCount = posts.filter((p) => p.status === "draft").length;
  const publishedCount = posts.filter((p) => HISTORY.has(p.status)).length;

  const platforms = Array.from(new Set(channels.map((c) => c.platform)));
  const statuses = tab === "scheduled"
    ? ["scheduled", "publishing", "processing"]
    : ["published", "partially_published", "partially_failed", "failed"];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Queue</h1>
          <p className="sub">Every post that is scheduled, published or failed.</p>
        </div>
        <Link href="/compose" className="btn">New post</Link>
      </div>

      <div className="stats">
        <div className="stat"><span className="stat-num">{scheduledCount}</span><span className="stat-label">Scheduled</span></div>
        <div className="stat"><span className="stat-num">{draftCount}</span><span className="stat-label">Drafts</span></div>
        <div className="stat"><span className="stat-num">{publishedCount}</span><span className="stat-label">Published / Failed</span></div>
      </div>

      <div className="row" style={{ marginBottom: 12 }}>
        <button className={tab === "scheduled" ? "" : "ghost small-btn"} onClick={() => setTab("scheduled")}>Scheduled</button>
        <button className={tab === "history" ? "" : "ghost small-btn"} onClick={() => setTab("history")}>Published / Failed</button>
      </div>

      <div className="row" style={{ marginBottom: 16 }}>
        {platforms.map((p) => (
          <button
            key={p}
            className={filter.platform === p ? "small-btn" : "ghost small-btn"}
            onClick={() => setFilter((f) => ({ ...f, platform: f.platform === p ? "" : p }))}
          >
            <span className="dot" style={{ background: PLATFORM_COLORS[p], marginRight: 6 }} />
            {PLATFORM_NAMES[p]}
          </button>
        ))}
        {statuses.map((s) => (
          <button
            key={s}
            className={filter.status === s ? "small-btn" : "ghost small-btn"}
            onClick={() => setFilter((f) => ({ ...f, status: f.status === s ? "" : s }))}
          >
            {s}
          </button>
        ))}
      </div>

      {loaded && (tab === "scheduled" ? scheduledList : historyList).length === 0 && (
        <div className="card empty">
          <strong>{tab === "scheduled" ? "Nothing scheduled." : "No history yet."}</strong>
          <Link href="/compose" className="btn">Write a post</Link>
        </div>
      )}

      <div className="list">
        {(tab === "scheduled" ? scheduledList : historyList).map((p) => (
          <PostRow key={p.id} post={p} channels={channels} role={me?.role ?? "viewer"} onChange={load} />
        ))}
      </div>

      {tab === "history" && hasMore && (
        <button className="ghost" onClick={() => setHistoryPage((n) => n + 1)} style={{ marginTop: 12 }}>
          Load {Math.min(PAGE_SIZE, historyAll.length - historyList.length)} more
        </button>
      )}
    </>
  );
}
