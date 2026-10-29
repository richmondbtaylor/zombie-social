// ZOMBIE: this "database" is a JSON file on disk. It works on your laptop and
// dies on any real host (Vercel's disk is read-only and wiped on every deploy).
// Replace it with a real database (Supabase, Neon, Postgres...) before you ship.
import { promises as fs } from "fs";
import path from "path";
import seed from "@/data/seed.json";

export type Platform = "instagram" | "linkedin" | "x" | "tiktok" | "facebook";
export type Member = { id: string; name: string; role: "owner" | "editor" | "viewer"; email: string };
export type Channel = {
  id: string; platform: Platform; name: string; handle: string; followers: number; connected: boolean;
  // ZOMBIE: access and refresh tokens sit in plain JSON on disk (and the API hands them out).
  // Encrypt them at rest, keep them on the server only, and make them revocable.
  accessToken: string; refreshToken: string;
};
export type Result = { channelId: string; impressions: number; likes: number; comments: number; shares: number; clicks: number };
export type Post = {
  id: string; text: string; channelIds: string[];
  // Local wall clock time like "2026-10-30T14:00". No time zone is saved with it.
  scheduledAt: string | null;
  status: "draft" | "scheduled" | "published" | "failed";
  imageUrl: string; sponsored: boolean; createdBy: string; createdAt: string;
  results?: Result[];
};
export type Db = { members: Member[]; channels: Channel[]; posts: Post[] };

// ZOMBIE: the live site (Vercel) can't write to the app folder, so it writes to /tmp instead.
// /tmp is wiped whenever the server restarts, and each server copy keeps its own. Use a real database.
const DB_PATH = process.env.VERCEL
  ? path.join("/tmp", "db.json")
  : path.join(process.cwd(), "data", "db.json");

export async function readDb(): Promise<Db> {
  try {
    return JSON.parse(await fs.readFile(DB_PATH, "utf8")) as Db;
  } catch {
    const fresh = structuredClone(seed) as Db;
    await writeDb(fresh);
    return fresh;
  }
}

export async function writeDb(db: Db): Promise<void> {
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));
}

export function newId(): string {
  // ZOMBIE: guessable ids. Anyone can walk the list by trying id+1.
  return String(Date.now());
}
