/**
 * Pipeline API — spec-driven generation entrypoint.
 *
 * Accepts a PipelineSpec, runs the orchestrator, stamps the result with
 * 08 Protocol + C2PA, and returns a data URL + manifest reference. Today
 * most stages are `not_wired`; the custom-dsp stage works end-to-end so the
 * orchestrator, stamping, and enforcement paths are exercised on every call.
 */

import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { runPipeline } from "@/lib/pipeline/orchestrator";
import { stampGeneration, ProvenanceEnforcementError } from "@/lib/provenance/stamp-generation";
import type { PipelineSpec } from "@/lib/pipeline/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const spec = (await request.json().catch(() => null)) as PipelineSpec | null;
  if (!spec?.stages?.length) {
    return NextResponse.json({ error: "PipelineSpec with stages required" }, { status: 400 });
  }

  const { data: prefs } = await supabase
    .from("profiles")
    .select("private_canon")
    .eq("id", user.id)
    .single();

  const effectiveSpec: PipelineSpec = {
    ...spec,
    user_id: user.id,
    private_canon: spec.private_canon ?? Boolean(prefs?.private_canon),
  };

  const result = await runPipeline(effectiveSpec);

  if (!result.ok || !result.audio) {
    return NextResponse.json(
      {
        error: result.error ?? "Pipeline failed",
        steps: result.steps,
      },
      { status: 422 },
    );
  }

  try {
    const stamp = await stampGeneration({
      supabase,
      userId: user.id,
      audio: result.audio,
      title: effectiveSpec.prompt?.slice(0, 60) || "Untitled pipeline run",
      prompt: effectiveSpec.prompt,
      pipelineSteps: result.steps,
    });

    const outputBuffer = stamp.signedAudio ?? result.audio;
    const audioUrl = `data:audio/wav;base64,${outputBuffer.toString("base64")}`;
    return NextResponse.json({
      audioUrl,
      steps: result.steps,
      manifest_id: stamp.manifestId,
      fingerprint: stamp.fingerprint,
      signature: stamp.signature,
      private_canon: stamp.privateCanon,
      watermark_status: stamp.watermarkStatus,
    });
  } catch (err) {
    if (err instanceof ProvenanceEnforcementError) {
      return NextResponse.json({ error: err.message, steps: result.steps }, { status: 451 });
    }
    const message = err instanceof Error ? err.message : "Stamping failed";
    return NextResponse.json({ error: message, steps: result.steps }, { status: 500 });
  }
}
