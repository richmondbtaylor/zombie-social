import { NextResponse } from "next/server";

// "Publish now" button.
export async function POST() {
  // ZOMBIE: Publish now is not built. It needs each platform's posting API with the user's
  // saved token (and some platforms need app review or only allow posting after the user
  // confirms). Build it, handle rate limits and errors, and set the post to published or failed.
  return NextResponse.json({ error: "Publish now is not built yet." }, { status: 501 });
}
