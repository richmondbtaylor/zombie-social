"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Channel, Post } from "@/lib/db";
import PostRow from "@/components/PostRow";

// The queue: every post that is scheduled, plus published and failed ones for history.
export default function QueuePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [p, c] = await Promise.all([fetch("/api/posts").then((r) => r.json()), fetch("/api/channels").then((r) => r.json())]);
    setPosts(p);
    setChannels(c);
    setLoaded(true);
  }, []);
  useEffect(() => { load(); }, [load]);

  // ZOMBIE: the queue is sorted newest first. A queue should show what goes out next, soonest first.
  const queue = posts
    .filter((p) => p.status !== "draft")
    .sort((a, b) => (b.scheduledAt ?? "").localeCompare(a.scheduledAt ?? ""));

  const scheduled = posts.filter((p) => p.status === "scheduled").length;

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
        <div className="stat"><span className="stat-num">{scheduled}</span><span className="stat-label">Scheduled</span></div>
        <div className="stat"><span className="stat-num">{posts.filter((p) => p.status === "draft").length}</span><span className="stat-label">Drafts</span></div>
        <div className="stat"><span className="stat-num">{posts.filter((p) => p.status === "published").length}</span><span className="stat-label">Published</span></div>
      </div>
      {loaded && queue.length === 0 && (
        <div className="card empty"><strong>Nothing in the queue.</strong><Link href="/compose" className="btn">Write a post</Link></div>
      )}
      <div className="list">
        {queue.map((p) => <PostRow key={p.id} post={p} channels={channels} onChange={load} />)}
      </div>
    </>
  );
}
