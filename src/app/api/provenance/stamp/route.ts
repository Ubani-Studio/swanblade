/**
 * Standalone stamp endpoint.
 *
 * For uploads or previously-generated assets that need an 08 Protocol + C2PA
 * record. The server-side generation routes auto-stamp via
 * `stampGeneration()`; this endpoint exists for explicit user-driven stamping
 * from the library / asset detail UI.
 */

import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { stampGeneration } from "@/lib/provenance/stamp-generation";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.audio_b64 && !body?.sound_id) {
    return NextResponse.json(
      { error: "audio_b64 or sound_id is required" },
      { status: 400 },
    );
  }

  let audio: Buffer;
  let soundId: string | undefined;
  let title: string = body?.title ?? "Untitled";

  if (body.audio_b64) {
    audio = Buffer.from(body.audio_b64, "base64");
  } else {
    const { data: sound } = await supabase
      .from("sounds")
      .select("id, name, file_url")
      .eq("id", body.sound_id)
      .eq("user_id", user.id)
      .single();
    if (!sound) {
      return NextResponse.json({ error: "Sound not found" }, { status: 404 });
    }
    const resp = await fetch(sound.file_url);
    audio = Buffer.from(await resp.arrayBuffer());
    soundId = sound.id;
    title = sound.name ?? title;
  }

  try {
    const stamp = await stampGeneration({
      supabase,
      userId: user.id,
      audio,
      title,
      prompt: body?.prompt,
      pipelineSteps: body?.pipeline_steps ?? [],
      soundId,
    });

    if (soundId) {
      await supabase
        .from("sounds")
        .update({
          origin8_fingerprint: stamp.fingerprint,
          c2pa_manifest_id: stamp.manifestId,
          watermark_status: stamp.watermarkStatus,
        })
        .eq("id", soundId);
    }

    return NextResponse.json({
      manifest_id: stamp.manifestId,
      fingerprint: stamp.fingerprint,
      signature: stamp.signature,
      manifest: stamp.manifest,
      private_canon: stamp.privateCanon,
      ai_training_opt_in: stamp.aiTrainingOptIn,
      watermark_status: stamp.watermarkStatus,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stamping failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
