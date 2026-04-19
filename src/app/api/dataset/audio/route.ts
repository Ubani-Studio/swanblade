/**
 * Dataset audio stream.
 *
 * Serves files written by /api/dataset/audio/upload. Supports .wav/.mp3/.flac/.ogg/.m4a.
 * The id is a UUID allocated at upload time; the file extension is stored as part
 * of the filename and resolved server-side, so the URL stays clean.
 */

import { NextRequest, NextResponse } from "next/server";
import { readFile, readdir } from "fs/promises";
import { join } from "path";

export const runtime = "nodejs";

const DATASET_DIR = join(process.cwd(), ".swanblade-library", "dataset");

const MIME_BY_EXT: Record<string, string> = {
  wav: "audio/wav",
  mp3: "audio/mpeg",
  flac: "audio/flac",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  aiff: "audio/aiff",
  aif: "audio/aiff",
};

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id || !isUuid(id)) {
    return NextResponse.json({ error: "valid id required" }, { status: 400 });
  }

  try {
    const entries = await readdir(DATASET_DIR);
    const match = entries.find((e) => e.startsWith(`${id}.`));
    if (!match) return NextResponse.json({ error: "not found" }, { status: 404 });

    const ext = match.split(".").pop() ?? "bin";
    const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";
    const data = await readFile(join(DATASET_DIR, match));

    return new NextResponse(data, {
      headers: {
        "Content-Type": mime,
        "Content-Length": data.length.toString(),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
