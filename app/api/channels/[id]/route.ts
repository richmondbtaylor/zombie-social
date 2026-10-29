import { NextResponse } from "next/server";
import { readDb, writeDb } from "@/lib/db";

// "Disconnect" button.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await readDb();
  const ch = db.channels.find((c) => c.id === id);
  if (!ch) return NextResponse.json({ error: "Channel not found." }, { status: 404 });
  // ZOMBIE: disconnect only flips a flag. The tokens stay in the file and are never revoked
  // with the platform. Call the platform's revoke endpoint and delete the tokens. Also, any
  // caller can do this: there is no role check.
  ch.connected = false;
  await writeDb(db);
  return NextResponse.json({ ok: true });
}
