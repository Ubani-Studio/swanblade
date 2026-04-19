import type { PipelineContext, PipelineSpec, PipelineStage, StageAdapter, StageResult } from "../types";

/**
 * Placeholder adapter for a stage whose backend isn't wired yet.
 *
 * When the caller hits `private_canon` mode, the orchestrator will treat a
 * `not_wired` result as a fatal gap rather than silently skipping it.
 */
export function notWiredAdapter(kind: StageAdapter["kind"], name: string, reason: string): StageAdapter {
  return {
    kind,
    name,
    available: false,
    async run(_spec: PipelineSpec, _stage: PipelineStage, ctx: PipelineContext): Promise<StageResult> {
      return {
        status: "not_wired",
        message: reason,
        audio: ctx.audio,
      };
    },
  };
}
