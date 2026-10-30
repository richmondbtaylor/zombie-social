import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthMember } from "@/lib/auth";
import { Problems } from "@/lib/problem";
import { IMAGE_MAX_BYTES, VIDEO_MAX_BYTES } from "@/lib/config";

export const dynamic = "force-dynamic";

const ALLOWED_IMAGE_MIME = ["image/png", "image/jpeg", "image/webp"];
const ALLOWED_VIDEO_MIME = ["video/mp4", "video/quicktime"];

// Magic-byte signatures: [mime, offset, bytes]
const SIGNATURES: Array<[string, number, number[]]> = [
  ["image/png", 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  ["image/jpeg", 0, [0xff, 0xd8, 0xff]],
  ["image/webp", 0, [0x52, 0x49, 0x46, 0x46]], // RIFF....WEBP (checked further below)
  ["video/mp4", 4, [0x66, 0x74, 0x79, 0x70]], // 'ftyp' at offset 4
];

function detectMime(buf: Uint8Array): string | null {
  for (const [mime, offset, sig] of SIGNATURES) {
    if (buf.length < offset + sig.length) continue;
    if (sig.every((b, i) => buf[offset + i] === b)) {
      if (mime === "image/webp") {
        const webp = buf.subarray(8, 12);
        if (!(webp[0] === 0x57 && webp[1] === 0x45 && webp[2] === 0x42 && webp[3] === 0x50)) continue;
      }
      return mime;
    }
  }
  return null;
}

function storageAdmin() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Storage admin client not configured.");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * POST /api/upload
 * Two modes:
 *   1. JSON body { filename, contentType, kind:"image"|"video" } → returns a pre-signed
 *      upload URL plus the public asset URL. The browser PUTs directly to Supabase Storage.
 *   2. multipart/form-data with a `file` field → validated server-side (magic bytes, MIME,
 *      size cap) then uploaded, derivatives generated via Sharp, all URLs returned.
 */
export async function POST(req: Request) {
  const me = await getAuthMember();
  if (!me) return Problems.UNAUTHORIZED();
  if (me.role === "viewer") return Problems.FORBIDDEN("Viewers cannot upload media.");

  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return Problems.BAD_REQUEST("No file provided.");

    const maxBytes = file.type.startsWith("video/") ? VIDEO_MAX_BYTES : IMAGE_MAX_BYTES;
    if (file.size > maxBytes) {
      return problem422(file.type, file.size, maxBytes);
    }
    const buf = new Uint8Array(await file.arrayBuffer());
    const detected = detectMime(buf);
    if (!detected) return Problems.UNPROCESSABLE("Could not verify file type from magic bytes.");
    const allowed = [...ALLOWED_IMAGE_MIME, ...ALLOWED_VIDEO_MIME];
    if (!allowed.includes(detected)) {
      return Problems.UNPROCESSABLE(`File type "${detected}" is not permitted.`);
    }
    if (detected.startsWith("image/") && !ALLOWED_IMAGE_MIME.includes(file.type)) {
      return Problems.UNPROCESSABLE(`Declared MIME "${file.type}" does not match detected "${detected}".`);
    }

    const supabase = storageAdmin();
    const path = `${me.workspaceId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
    const { error: upErr } = await supabase.storage.from("media").upload(path, buf, {
      contentType: detected,
      upsert: false,
    });
    if (upErr) return Problems.INTERNAL(upErr.message);

    const publicUrl = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;

    // Platform-specific cropped derivatives (images only). Video transcoding runs in a
    // background worker rather than inline here.
    const derivatives: Record<string, string> = {};
    if (detected.startsWith("image/")) {
      try {
        const sharp = (await import("sharp")).default;
        const crops = [
          { label: "instagram_1x1", width: 1080, height: 1080 },
          { label: "stories_9x16", width: 1080, height: 1920 },
          { label: "landscape_16x9", width: 1920, height: 1080 },
        ];
        for (const c of crops) {
          const out = await sharp(buf).resize(c.width, c.height, { fit: "cover" }).webp({ quality: 82 }).toBuffer();
          const dpath = `${me.workspaceId}/derivatives/${path.split("/").pop()}_${c.label}.webp`;
          const { error: derr } = await supabase.storage.from("media").upload(dpath, out, { contentType: "image/webp", upsert: false });
          if (!derr) derivatives[c.label] = supabase.storage.from("media").getPublicUrl(dpath).data.publicUrl;
        }
      } catch (err) {
        console.warn("[upload] derivative generation skipped", err);
      }
    }

    return NextResponse.json({ url: publicUrl, derivatives, detectedType: detected });
  }

  // Pre-signed URL mode.
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return Problems.BAD_REQUEST("Expected JSON body or multipart upload."); }
  const filename = String(b.filename ?? "").replace(/[^\w.\-]/g, "_");
  const declaredType = String(b.contentType ?? "");
  const kind = b.kind === "video" ? "video" : "image";
  if (!filename) return Problems.BAD_REQUEST("filename is required.");

  const allowedTypes = kind === "video" ? ALLOWED_VIDEO_MIME : ALLOWED_IMAGE_MIME;
  if (!allowedTypes.includes(declaredType)) {
    return Problems.UNPROCESSABLE(`${kind} uploads must be one of: ${allowedTypes.join(", ")}.`);
  }

  const supabase = storageAdmin();
  const path = `${me.workspaceId}/${crypto.randomUUID()}-${filename}`;
  const { data, error } = await supabase.storage.from("media").createSignedUploadUrl(path);
  if (error) return Problems.INTERNAL(error.message);

  const publicUrl = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
  return NextResponse.json({
    signedUrl: data.signedUrl,
    token: data.token,
    path,
    publicUrl,
    maxSizeBytes: kind === "video" ? VIDEO_MAX_BYTES : IMAGE_MAX_BYTES,
  });
}

function problem422(type: string, size: number, max: number) {
  return NextResponse.json(
    {
      code: "payload_too_large",
      title: "Unprocessable Entity",
      detail: `"${type || "unknown"}" file of ${size} bytes exceeds the ${max}-byte limit.`,
    },
    { status: 422 },
  );
}
