"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Channel, Post } from "@/lib/db";
import PostRow from "@/components/PostRow";

export default function DraftsPage() {
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

  const drafts = posts.filter((p) => p.status === "draft");

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Drafts</h1>
          <p className="sub">Posts that are not scheduled yet. Pick a time to schedule one.</p>
        </div>
        <Link href="/compose" className="btn">New post</Link>
      </div>
      {loaded && drafts.length === 0 && <div className="card empty"><strong>No drafts.</strong></div>}
      <div className="list">
        {drafts.map((p) => <PostRow key={p.id} post={p} channels={channels} onChange={load} />)}
      </div>
    </>
  );
}
