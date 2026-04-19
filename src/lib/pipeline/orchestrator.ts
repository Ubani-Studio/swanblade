/**
 * Pipeline orchestrator.
 *
 * Runs a PipelineSpec stage by stage, threading audio through adapters and
 * recording a trace that the 08 Protocol stamp layer folds into the C2PA
 * manifest. Non-bypassable in `private_canon` mode: any stage that isn't a
 * production-ready `completed` (e.g. `not_wired`, `failed`) fails the whole run.
 */

import { getAdapter } from "./adapters";
import type { PipelineContext, PipelineResult, PipelineSpec, PipelineStepTrace } from "./types";

export async function runPipeline(spec: PipelineSpec): Promise<PipelineResult> {
  const steps: PipelineStepTrace[] = [];
  const ctx: PipelineContext = {
    audio: spec.input_audio_b64 ? Buffer.from(spec.input_audio_b64, "base64") : undefined,
  };

  for (const stage of spec.stages) {
    const adapter = getAdapter(stage.kind);
    const started = Date.now();
    const startedIso = new Date(started).toISOString();

    try {
      const result = await adapter.run(spec, stage, ctx);
      const finished = Date.now();
      steps.push({
        stage: stage.kind,
        adapter: adapter.name,
        status: result.status,
        parameters: stage.parameters,
        message: result.message,
        started_at: startedIso,
        finished_at: new Date(finished).toISOString(),
        elapsed_ms: finished - started,
      });

      if (result.audio) ctx.audio = result.audio;

      if (spec.private_canon && result.status !== "completed" && !stage.optional) {
        return {
          audio: null,
          steps,
          ok: false,
          error: `Private Canon aborted at ${stage.kind}: ${result.status} — ${result.message ?? "no backend"}`,
        };
      }
    } catch (err) {
      const finished = Date.now();
      steps.push({
        stage: stage.kind,
        adapter: adapter.name,
        status: "failed",
        parameters: stage.parameters,
        message: err instanceof Error ? err.message : String(err),
        started_at: startedIso,
        finished_at: new Date(finished).toISOString(),
        elapsed_ms: finished - started,
      });

      if (spec.private_canon) {
        return {
          audio: null,
          steps,
          ok: false,
          error: `Private Canon aborted at ${stage.kind}: threw`,
        };
      }
    }
  }

  return { audio: ctx.audio ?? null, steps, ok: true };
}
