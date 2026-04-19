/**
 * ACE-Step 1.5 adapter.
 *
 * Shells out to `modal run ace_step.py --generate ...` (same pattern as
 * /api/generate-lora and /api/remix). When the Modal image or weights aren't
 * ready, the Python side returns `{status: "failed"}` and the adapter degrades
 * to `not_wired` so Private Canon fails closed cleanly.
 */

import { execSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import type { PipelineContext, PipelineSpec, PipelineStage, StageAdapter, StageResult } from "../types";

const MODAL_DIR = process.env.SWANBLADE_MODAL_DIR || "/home/sphinxy/modal-audio";
const MODAL_VOLUME = process.env.SWANBLADE_MODAL_VOLUME || "swanblade-training";

function extractJson(stdout: string): Record<string, unknown> | null {
  const lines = stdout.trim().split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line.startsWith("{") && line.endsWith("}")) {
      try {
        return JSON.parse(line);
      } catch {
        continue;
      }
    }
  }
  return null;
}

export const aceStepAdapter: StageAdapter = {
  kind: "ace-step",
  name: "modal.ace-step-1.5",
  available: Boolean(process.env.SWANBLADE_ACE_STEP_ENABLED === "1"),
  async run(spec: PipelineSpec, stage: PipelineStage, _ctx: PipelineContext): Promise<StageResult> {
    if (process.env.SWANBLADE_ACE_STEP_ENABLED !== "1") {
      return {
        status: "not_wired",
        message: "ACE-Step disabled. Set SWANBLADE_ACE_STEP_ENABLED=1 after `modal deploy ace_step.py`.",
      };
    }

    const prompt = ((stage.parameters?.prompt as string) ?? spec.prompt ?? "").trim();
    if (!prompt) {
      return { status: "failed", message: "ACE-Step requires a prompt" };
    }
    const duration = Math.max(1, Math.min(240, Number(stage.parameters?.duration_seconds ?? spec.duration_seconds ?? 30)));
    const seed = Number(stage.parameters?.seed ?? spec.seed ?? Math.floor(Math.random() * 1e6));

    try {
      const cmd =
        `cd ${MODAL_DIR} && modal run ace_step.py --generate ` +
        `--prompt "$SWANBLADE_PROMPT" --duration ${duration} --seed ${seed}`;
      const stdout = execSync(cmd, {
        timeout: 600000,
        encoding: "utf-8",
        env: { ...process.env, SWANBLADE_PROMPT: prompt },
      });
      const parsed = extractJson(stdout);
      if (!parsed || parsed.status !== "completed" || !parsed.generation_id) {
        return {
          status: "failed",
          message: (parsed?.error as string) ?? "ACE-Step returned no result",
        };
      }

      const genId = parsed.generation_id as string;
      const tmp = join(tmpdir(), `swanblade-ace-${genId}`);
      mkdirSync(tmp, { recursive: true });
      const wavPath = join(tmp, `${genId}.wav`);
      try {
        execSync(
          `cd ${MODAL_DIR} && modal volume get ${MODAL_VOLUME} "generations/${genId}.wav" "${wavPath}"`,
          { timeout: 120000 },
        );
        if (!existsSync(wavPath)) {
          return { status: "failed", message: "ACE-Step output not found on volume" };
        }
        const audio = readFileSync(wavPath);
        return {
          status: "completed",
          audio,
          metadata: { generation_id: genId, duration_seconds: duration, seed },
        };
      } finally {
        if (existsSync(tmp)) rmSync(tmp, { recursive: true, force: true });
      }
    } catch (err) {
      return {
        status: "failed",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
