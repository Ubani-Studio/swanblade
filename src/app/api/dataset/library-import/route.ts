/**
 * Import a Swanblade library sound into the dataset.
 *
 * Creates a dataset_entries row pointing at the library's stream URL. The
 * audio itself stays in the local library — the dataset entry is a reference.
 */

import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getLibrarySound, getLibrarySounds } from "@/lib/libraryStorage";
import { DATASET_LAYERS, type DatasetLayer } from "@/lib/dataset/layers";

export const runtime = "nodejs";

function isLayer(v: unknown): v is DatasetLayer {
  return typeof v === "string" && (DATASET_LAYERS as readonly string[]).includes(v);
}

export async function GET() {
  const sounds = await getLibrarySounds();
  return NextResponse.json({
    sounds: sounds.map((s) => ({
      id: s.id,
      name: s.name,
      prompt: s.prompt,
      createdAt: s.createdAt,
      lengthSeconds: s.lengthSeconds,
      type: s.type,
      hasAudio: Boolean(s.fileName),
    })),
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || !isLayer(body.layer) || !body.sound_id) {
    return NextResponse.json({ error: "layer and sound_id required" }, { status: 400 });
  }

  const sound = await getLibrarySound(body.sound_id);
  if (!sound) {
    return NextResponse.json({ error: "Library sound not found" }, { status: 404 });
  }

  const audioUrl = sound.fileName ? `/api/library/audio?id=${sound.id}` : null;

  const { data, error } = await supabase
    .from("dataset_entries")
    .insert({
      user_id: user.id,
      layer: body.layer,
      kind: body.kind ?? null,
      title: sound.name,
      content_text: sound.prompt ?? null,
      audio_url: audioUrl,
      data: {
        imported_from: "library",
        library_sound_id: sound.id,
        length_seconds: sound.lengthSeconds,
      },
      ai_training_opt_in: body.ai_training_opt_in ?? true,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data?.id });
}
