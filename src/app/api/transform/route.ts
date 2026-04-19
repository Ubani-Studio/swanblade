/**
 * Sound Transform API
 *
 * Transform existing audio using AI models:
 * - Style transfer
 * - Timbre morphing
 * - Rhythm extraction
 * - Melody reimagining
 */

import { NextRequest, NextResponse } from "next/server";
import {
  analyzeSourceAudio,
  buildTransformPrompt,
  transformWithMusicGenMelody,
  transformResultToSound,
  TransformHistoryStore,
  TRANSFORM_PRESETS,
  type SourceAudioAnalysis,
  type TransformMode,
} from "@/lib/soundTransform";
import { saveToLibrary, getLibrarySound } from "@/lib/libraryStorage";
import { createClient } from "@/lib/supabase/server";
import { stampGeneration, ProvenanceEnforcementError } from "@/lib/provenance/stamp-generation";
import type { TransformRequest, TransformResult, SoundGeneration } from "@/types";

const historyStore = new TransformHistoryStore();

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Extract parameters
    const sourceAudioFile = formData.get("sourceAudio") as File | null;
    const sourceSoundId = formData.get("sourceSoundId") as string | null;
    const transformPrompt = formData.get("transformPrompt") as string;
    const presetId = formData.get("presetId") as string | null;
    const preserveRhythm = formData.get("preserveRhythm") === "true";
    const preservePitch = formData.get("preservePitch") === "true";
    const preserveTimbre = formData.get("preserveTimbre") === "true";
    const transformStrength = parseFloat(formData.get("transformStrength") as string) || 0.7;
    const saveToLib = formData.get("saveToLibrary") !== "false";

    // Validate inputs
    if (!transformPrompt) {
      return NextResponse.json(
        { error: "transformPrompt is required" },
        { status: 400 }
      );
    }

    // Get source audio
    let sourceAudioBuffer: ArrayBuffer;
    let sourceSound: SoundGeneration | null = null;

    if (sourceAudioFile) {
      // Direct file upload
      sourceAudioBuffer = await sourceAudioFile.arrayBuffer();
    } else if (sourceSoundId) {
      // Get from library
      sourceSound = await getLibrarySound(sourceSoundId);
      if (!sourceSound || !sourceSound.audioUrl) {
        return NextResponse.json(
          { error: "Source sound not found in library" },
          { status: 404 }
        );
      }

      // Fetch audio from URL
      if (sourceSound.audioUrl.startsWith("data:")) {
        // Base64 encoded
        const base64Data = sourceSound.audioUrl.split(",")[1];
        sourceAudioBuffer = Buffer.from(base64Data, "base64").buffer;
      } else {
        // URL fetch
        const audioResponse = await fetch(sourceSound.audioUrl);
        sourceAudioBuffer = await audioResponse.arrayBuffer();
      }
    } else {
      return NextResponse.json(
        { error: "Either sourceAudio file or sourceSoundId is required" },
        { status: 400 }
      );
    }

    // Apply preset if specified
    let effectivePreserveRhythm = preserveRhythm;
    let effectivePreservePitch = preservePitch;
    let effectivePreserveTimbre = preserveTimbre;
    let effectiveStrength = transformStrength;
    let mode: TransformMode = "style_transfer";

    if (presetId) {
      const preset = TRANSFORM_PRESETS.find((p) => p.id === presetId);
      if (preset) {
        effectivePreserveRhythm = preset.preserveRhythm;
        effectivePreservePitch = preset.preservePitch;
        effectivePreserveTimbre = preset.preserveTimbre;
        effectiveStrength = preset.transformStrength;
        mode = preset.mode;
      }
    }

    // Analyze source audio
    const starforgeApiUrl = process.env.STARFORGE_API_URL || "http://localhost:5000";
    let analysis: SourceAudioAnalysis;

    try {
      analysis = await analyzeSourceAudio(sourceAudioBuffer, starforgeApiUrl);
    } catch (error) {
      console.warn("Audio analysis failed, using defaults:", error);
      analysis = {
        bpm: 120,
        key: null,
        energy: 0.5,
        description: "uploaded audio",
        duration: 10,
      };
    }

    // Build transform request
    const transformRequest: TransformRequest = {
      sourceAudioUrl: "", // Will use buffer directly
      transformPrompt,
      preserveRhythm: effectivePreserveRhythm,
      preservePitch: effectivePreservePitch,
      preserveTimbre: effectivePreserveTimbre,
      transformStrength: effectiveStrength,
    };

    // Build full prompt
    const fullPrompt = buildTransformPrompt(analysis, transformRequest);

    // Convert source audio to base64
    const sourceBase64 = Buffer.from(sourceAudioBuffer).toString("base64");

    // Transform using available provider
    const replicateApiKey = process.env.REPLICATE_API_KEY;

    if (!replicateApiKey) {
      return NextResponse.json(
        { error: "No transform provider configured. Add REPLICATE_API_KEY to .env.local" },
        { status: 500 }
      );
    }

    let resultAudioUrl: string;

    try {
      resultAudioUrl = await transformWithMusicGenMelody(
        sourceBase64,
        fullPrompt,
        analysis.duration,
        replicateApiKey
      );
    } catch (error) {
      console.error("Transform failed:", error);
      return NextResponse.json(
        { error: `Transform failed: ${error instanceof Error ? error.message : "Unknown error"}` },
        { status: 500 }
      );
    }

    // Fetch the result audio so we can stamp it server-side.
    let resultBuffer: Buffer | null = null;
    try {
      if (resultAudioUrl.startsWith("data:")) {
        const b64 = resultAudioUrl.split(",", 2)[1] ?? "";
        resultBuffer = Buffer.from(b64, "base64");
      } else {
        const r = await fetch(resultAudioUrl);
        resultBuffer = Buffer.from(await r.arrayBuffer());
      }
    } catch (err) {
      console.warn("[transform] could not fetch result for stamping:", err);
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let provenance: Awaited<ReturnType<typeof stampGeneration>> | null = null;
    if (user && resultBuffer) {
      const now = new Date().toISOString();
      try {
        provenance = await stampGeneration({
          supabase,
          userId: user.id,
          audio: resultBuffer,
          title: transformPrompt.slice(0, 60) || "Transform",
          prompt: transformPrompt,
          pipelineSteps: [
            {
              stage: "musicgen",
              adapter: "replicate.musicgen-melody",
              status: "completed",
              parameters: {
                mode,
                preserveRhythm: effectivePreserveRhythm,
                preservePitch: effectivePreservePitch,
                preserveTimbre: effectivePreserveTimbre,
                strength: effectiveStrength,
              },
              started_at: now,
              finished_at: now,
              elapsed_ms: 0,
            },
          ],
        });
      } catch (err) {
        if (err instanceof ProvenanceEnforcementError) {
          return NextResponse.json({ error: err.message }, { status: 451 });
        }
        console.error("[transform] stamp failed:", err);
      }
    }

    // Build result
    const result: TransformResult = {
      audioUrl: resultAudioUrl,
      transformApplied: transformPrompt,
      provenanceCid: provenance?.manifestId,
    };

    // Create sound object
    const resultSound = transformResultToSound(
      result,
      sourceSound || createPlaceholderSound(analysis),
      transformPrompt
    );

    // Save to library if requested
    if (saveToLib) {
      await saveToLibrary(resultSound);
    }

    // Save to history
    if (typeof window !== "undefined" || true) {
      // Server-side history (would need DB in production)
      const historyEntry = {
        id: `hist_${Date.now()}`,
        sourceSoundId: sourceSoundId || "upload",
        resultSoundId: resultSound.id,
        transformPrompt,
        preset: presetId || undefined,
        mode,
        preserveRhythm: effectivePreserveRhythm,
        preservePitch: effectivePreservePitch,
        preserveTimbre: effectivePreserveTimbre,
        transformStrength: effectiveStrength,
        createdAt: new Date().toISOString(),
      };
      console.log("Transform complete:", historyEntry);
    }

    return NextResponse.json({
      sound: resultSound,
      analysis,
      transform: {
        prompt: fullPrompt,
        mode,
        preserveRhythm: effectivePreserveRhythm,
        preservePitch: effectivePreservePitch,
        preserveTimbre: effectivePreserveTimbre,
        strength: effectiveStrength,
      },
    });
  } catch (error) {
    console.error("Transform API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// GET endpoint for presets
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const presetId = searchParams.get("preset");

  if (presetId) {
    const preset = TRANSFORM_PRESETS.find((p) => p.id === presetId);
    if (!preset) {
      return NextResponse.json({ error: "Preset not found" }, { status: 404 });
    }
    return NextResponse.json(preset);
  }

  return NextResponse.json({ presets: TRANSFORM_PRESETS });
}

// ==================== Helpers ====================

function createPlaceholderSound(analysis: SourceAudioAnalysis): SoundGeneration {
  return {
    id: `upload_${Date.now()}`,
    name: "Uploaded Audio",
    prompt: "User uploaded audio for transformation",
    createdAt: new Date().toISOString(),
    type: "FX",
    moodTags: [],
    lengthSeconds: analysis.duration,
    bpm: analysis.bpm,
    key: analysis.key || undefined,
    intensity: Math.round(analysis.energy * 100),
    texture: 50,
    brightness: 50,
    noisiness: 20,
    audioUrl: null,
    status: "ready",
  };
}
