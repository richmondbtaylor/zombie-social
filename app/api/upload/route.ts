import { NextResponse } from "next/server";

// ZOMBIE: image upload is turned off. The composer only takes an image URL. Build upload to
// real storage (Supabase Storage, S3...), check file type and size, and resize for each platform.
export async function POST() {
  return NextResponse.json({ error: "Image upload is not built yet. Paste an image URL." }, { status: 501 });
}
