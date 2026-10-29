import { NextResponse } from "next/server";

// ZOMBIE: "Export CSV" on the Analytics page is not built. Build a CSV of the numbers per post
// and per channel (and escape commas and quotes in the text).
export async function GET() {
  return NextResponse.json({ error: "Export is not built yet." }, { status: 501 });
}
