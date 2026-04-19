/**
 * Dataset audio upload.
 *
 * Writes the uploaded file into the user's local library under
 * .swanblade-library/dataset/<id>.<ext>, mirroring how /api/library stores
 * generated sounds. Returns a stream URL that dataset_entries.audio_url
 * can reference.
 *
 * Keeping audio on disk (rather than uploading to Supabase Storage) matches
 * Swanblade's local-first posture: raw artist audio stays on the user's
 * machine until an explicit training job pushes it to Modal.
 */

import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import { randomUUID } from "crypto";
import { join } from "path";

import { createClient } from "@/lib/supabase/server";
import { getUploadLimit } from "@/lib/usage";

export const runtime = "nodejs";
export const maxDuration = 120;

const DATASET_DIR = join(process.cwd(), ".swanblade-library", "dataset");

const ALLOWED_EXTS = new Set(["wav", "mp3", "flac", "ogg", "m4a", "aiff", "aif"]);

function extFromName(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m ? m[1].toLowerCase() : "bin";
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  const ext = extFromName(file.name);
  if (!ALLOWED_EXTS.has(ext)) {
    return NextResponse.json({ error: `Unsupported extension .${ext}` }, { status: 400 });
  }

  const maxBytes = await getUploadLimit(supabase, user.id);
  if (maxBytes && file.size > maxBytes) {
    return NextResponse.json(
      { error: `File exceeds your tier upload limit (${Math.round(maxBytes / 1e6)}MB)` },
      { status: 413 },
    );
  }

  await mkdir(DATASET_DIR, { recursive: true });
  const id = randomUUID();
  const fileName = `${id}.${ext}`;
  const filePath = join(DATASET_DIR, fileName);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  return NextResponse.json({
    id,
    file_name: fileName,
    size_bytes: buffer.byteLength,
    audio_url: `/api/dataset/audio?id=${id}`,
  });
}
