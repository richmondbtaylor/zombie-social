"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Channel, Post } from "@/lib/db";
import PostRow from "@/components/PostRow";
import { useMe } from "@/lib/useMe";

export default function DraftsPage() {
  const me = useMe();
  const [posts, setPosts] = useState<Post[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loaded, setLoaded] = useState(false);

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

  const drafts = posts.filter((p) => p.status === "draft" || p.status === "pending_review" || p.status === "rejected");

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Drafts</h1>
          <p className="sub">Posts that are not scheduled yet. Submit for review or pick a time to schedule.</p>
        </div>
        {me?.role !== "viewer" && <Link href="/compose" className="btn">New post</Link>}
      </div>
      {loaded && drafts.length === 0 && <div className="card empty"><strong>No drafts.</strong></div>}
      <div className="list">
        {drafts.map((p) => <PostRow key={p.id} post={p} channels={channels} role={me?.role ?? "viewer"} onChange={load} />)}
      </div>
    </>
  );
}
