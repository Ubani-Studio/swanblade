import type { PipelineStageKind, StageAdapter } from "../types";
import { notWiredAdapter } from "./base";
import { customDspAdapter } from "./custom-dsp";

/**
 * Adapter registry. Existing Modal-backed stages (VampNet / Magnet / Stable
 * Audio / MusicGen) are invoked through the legacy /api/remix and /api/transform
 * routes; the pipeline orchestrator is the new spec-driven entrypoint so those
 * adapters forward to the same Modal scripts — wired incrementally.
 *
 * Stages without a production backend yet return `not_wired` so the UI stays
 * honest in Private Canon mode.
 */
const REGISTRY: Record<PipelineStageKind, StageAdapter> = {
  "ace-step": notWiredAdapter(
    "ace-step",
    "ace-step/1.5",
    "ACE-Step backend is not configured. Set PIPELINE_ACE_STEP_URL and deploy the Modal script.",
  ),
  audiox: notWiredAdapter(
    "audiox",
    "audiox/0.1",
    "AudioX multimodal conditioning backend is not configured.",
  ),
  fugatto: notWiredAdapter(
    "fugatto",
    "fugatto/0.1",
    "Fugatto transformation backend is not configured.",
  ),
  musichifi: notWiredAdapter(
    "musichifi",
    "musichifi/0.1",
    "MusicHiFi render backend is not configured.",
  ),
  "custom-dsp": customDspAdapter,
  vampnet: notWiredAdapter("vampnet", "vampnet.legacy", "Use /api/remix for VampNet today."),
  magnet: notWiredAdapter("magnet", "magnet.legacy", "Use /api/remix for Magnet today."),
  "stable-audio": notWiredAdapter("stable-audio", "stable-audio.legacy", "Use /api/remix or /api/generate-lora."),
  musicgen: notWiredAdapter("musicgen", "musicgen.legacy", "Use /api/transform for MusicGen."),
};

export function getAdapter(kind: PipelineStageKind): StageAdapter {
  return REGISTRY[kind];
}

export function listAdapters(): StageAdapter[] {
  return Object.values(REGISTRY);
}
