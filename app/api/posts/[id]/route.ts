import { NextResponse } from "next/server";
import { readDb, writeDb } from "@/lib/db";

// ZOMBIE: both handlers trust the caller. A viewer can edit or delete any post, including
// posts that were already published. Check who is calling, check their role, and keep a
// history of changes.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const db = await readDb();
  const post = db.posts.find((p) => p.id === id);
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  // ZOMBIE: whatever fields are sent get copied onto the post, with no checks (same gaps as
  // creating a post: past dates, no time zone, no limit check).
  Object.assign(post, b, { id: post.id });
  await writeDb(db);
  return NextResponse.json(post);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await readDb();
  db.posts = db.posts.filter((p) => p.id !== id);
  await writeDb(db);
  return NextResponse.json({ ok: true });
}
