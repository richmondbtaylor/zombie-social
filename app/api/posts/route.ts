import { NextResponse } from "next/server";
import { readDb, writeDb, newId, type Post } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await readDb();
  return NextResponse.json(db.posts);
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const db = await readDb();

  // ZOMBIE: no real validation. Empty text, no channels, channel ids that do not exist,
  // a text longer than the channel limit, and any image URL (even javascript: or tracking
  // links) are all accepted. Check everything on the server.
  const wantsSchedule = b.status === "scheduled";

  // ZOMBIE: you can schedule a post in the past. Reject any time that is not in the future.
  // ZOMBIE: the time is saved as typed ("2026-10-30T14:00") with no time zone. A post meant for
  // 2 pm Miami time lands at the wrong hour for anyone in another zone. Save a UTC time plus
  // the workspace time zone.
  const scheduledAt: string | null = b.scheduledAt || null;

  // ZOMBIE: no duplicate check and no daily cap. The same text can go to the same channel
  // many times in a row. Platforms treat that as spam and can limit or ban the account.
  const post: Post = {
    id: newId(),
    text: String(b.text ?? ""),
    channelIds: Array.isArray(b.channelIds) ? b.channelIds : [],
    scheduledAt,
    status: wantsSchedule ? "scheduled" : "draft",
    imageUrl: String(b.imageUrl ?? ""),
    // ZOMBIE: "sponsored" is saved but nothing uses it. Paid partnerships must be disclosed
    // (#ad or the platform's paid partnership label). Add the disclosure to the text and
    // set the platform's branded content flag when you publish.
    sponsored: Boolean(b.sponsored),
    // ZOMBIE: createdBy comes from the request body, so anyone can post as anyone.
    createdBy: String(b.createdBy ?? ""),
    createdAt: new Date().toISOString(),
  };
  db.posts.push(post);
  await writeDb(db);
  return NextResponse.json(post, { status: 201 });
}
