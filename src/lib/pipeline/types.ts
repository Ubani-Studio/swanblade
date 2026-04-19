/**
 * Composable generation pipeline — type spine.
 *
 * The Swanblade pipeline is a linear composition of stages. A stage may be a
 * musical foundation (ACE-Step, AudioX, legacy VampNet), a transformation
 * (Fugatto, custom DSP), or a render stage (MusicHiFi). Each stage has a
 * uniform adapter interface so backends can be swapped independently.
 *
 * A pipeline adapter takes audio in and returns audio out, plus a trace
 * entry that gets folded into the C2PA manifest.
 */

export type PipelineStageKind =
  | "ace-step"
  | "audiox"
  | "fugatto"
  | "musichifi"
  | "custom-dsp"
  | "vampnet"
  | "magnet"
  | "stable-audio"
  | "musicgen";

export interface PipelineStage {
  kind: PipelineStageKind;
  /** Human-facing label for UI trace; falls through to the adapter name when absent. */
  label?: string;
  /** Stage-specific parameters. Adapters validate the shape they care about. */
  parameters?: Record<string, unknown>;
  /** Skip without failing; useful for optional render stages. */
  optional?: boolean;
}

export interface PipelineSpec {
  /** Ordered stages, each run in sequence. */
  stages: PipelineStage[];
  /** Base prompt surfaced across stages that accept one. */
  prompt?: string;
  /** Target output duration in seconds. */
  duration_seconds?: number;
  /** Random seed for reproducibility. */
  seed?: number;
  /** Target user (for LoRA + consent checks). */
  user_id?: string;
  /** When true, enforces non-bypassable 08 Protocol stamping on every stage. */
  private_canon?: boolean;
  /** Existing audio input (e.g., for Fugatto mutation). Data-URL or Base64. */
  input_audio_b64?: string;
  /** Optional multimodal conditioning (AudioX). */
  conditioning?: {
    image_url?: string;
    video_url?: string;
    text?: string;
  };
}

export interface PipelineStepTrace {
  stage: PipelineStageKind;
  adapter: string;
  status: "completed" | "skipped" | "not_wired" | "failed";
  parameters?: Record<string, unknown>;
  message?: string;
  started_at: string;
  finished_at: string;
  elapsed_ms: number;
}

export interface PipelineContext {
  /** Reserved for request-scoped logging / cancellation. */
  abortSignal?: AbortSignal;
  /** Pass-through for the current audio buffer between stages. */
  audio?: Buffer;
}

export interface StageAdapter {
  readonly kind: PipelineStageKind;
  readonly name: string;
  readonly available: boolean;
  run(spec: PipelineSpec, stage: PipelineStage, ctx: PipelineContext): Promise<StageResult>;
}

export interface StageResult {
  audio?: Buffer;
  status: PipelineStepTrace["status"];
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface PipelineResult {
  audio: Buffer | null;
  steps: PipelineStepTrace[];
  ok: boolean;
  /** Populated by the orchestrator after stamping. */
  fingerprint?: string;
  manifest_id?: string;
  error?: string;
}
