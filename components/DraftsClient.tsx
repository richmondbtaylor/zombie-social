"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import type { ChannelPublic, MemberRole, Post } from "@/lib/db";
import PostRow from "@/components/PostRow";

export default function DraftsClient({
  initialPosts,
  initialChannels,
  role,
}: {
  initialPosts: Post[];
  initialChannels: ChannelPublic[];
  role: MemberRole;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [channels, setChannels] = useState(initialChannels);

  const load = useCallback(async () => {
    const [p, c] = await Promise.all([
      fetch("/api/posts").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/channels").then((r) => (r.ok ? r.json() : [])),
    ]);
    setPosts(Array.isArray(p) ? p : []);
    setChannels(Array.isArray(c) ? c : []);
  }, []);

  const drafts = posts.filter((p) => ["draft", "pending_review", "rejected"].includes(p.status));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Drafts</h1>
          <p className="sub">Posts that are not scheduled yet. Submit for review or pick a time to schedule.</p>
        </div>
        {role !== "viewer" && <Link href="/compose" className="btn">+ New post</Link>}
      </div>
      {drafts.length === 0 && (
        <div className="card empty">
          <strong>No drafts right now.</strong>
          <p className="muted">Write something and save it as a draft — it shows up here.</p>
          {role !== "viewer" && <Link href="/compose" className="btn">Write a post</Link>}
        </div>
      )}
      <div className="list">
        {drafts.map((p) => <PostRow key={p.id} post={p} channels={channels} role={role} onChange={load} />)}
      </div>
    </>
  );
}
