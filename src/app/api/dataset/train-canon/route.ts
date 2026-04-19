/**
 * Canon training kickoff.
 *
 * Assembles a LoRA training manifest from the user's opted-in audio entries
 * (vocal_canon, live_captures, paired_controls), writes a training_jobs row
 * with model_type='ace_step_lora', and launches the Modal fine-tune.
 *
 * Prerequisites: SWANBLADE_ACE_STEP_ENABLED=1 (same gate as inference) plus
 * the `modal` CLI available on the server (already used by lora_train.py).
 */

import { NextRequest, NextResponse } from "next/server";
import { execSync, spawn } from "child_process";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODAL_DIR = process.env.SWANBLADE_MODAL_DIR || "/home/sphinxy/modal-audio";
const MODAL_VOLUME = process.env.SWANBLADE_MODAL_VOLUME || "swanblade-training";

const AUDIO_LAYERS = ["vocal_canon", "live_captures", "paired_controls"] as const;

interface Entry {
  id: string;
  title: string;
  audio_url: string | null;
  layer: string;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (process.env.SWANBLADE_ACE_STEP_ENABLED !== "1") {
    return NextResponse.json(
      { error: "ACE-Step not enabled on this server. Set SWANBLADE_ACE_STEP_ENABLED=1 after deploying the Modal script." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const modelName = String(body.name ?? `canon-${new Date().toISOString().slice(0, 10)}`).slice(0, 80);

  const { data: entries } = await supabase
    .from("dataset_entries")
    .select("id, title, audio_url, layer")
    .eq("user_id", user.id)
    .eq("ai_training_opt_in", true)
    .eq("archived", false)
    .in("layer", AUDIO_LAYERS as unknown as string[])
    .not("audio_url", "is", null);

  const usable = (entries ?? []).filter((e: Entry) => e.audio_url && !e.audio_url.startsWith("data:"));

  if (usable.length < 3) {
    return NextResponse.json(
      {
        error: `Need at least 3 opted-in audio entries across vocal_canon / live_captures / paired_controls. Found ${usable.length}.`,
      },
      { status: 422 },
    );
  }

  // Write the manifest to a temp file, push to Modal volume under a unique
  // job directory, then create the training_jobs row + launch modal run.
  const jobId = randomUUID();
  const tmp = join(tmpdir(), `swanblade-canon-${jobId}`);
  mkdirSync(tmp, { recursive: true });
  const manifestPath = join(tmp, "manifest.json");

  try {
    const manifest = {
      job_id: jobId,
      user_id: user.id,
      name: modelName,
      entries: usable.map((e: Entry) => ({
        id: e.id,
        title: e.title,
        layer: e.layer,
        audio_url: e.audio_url,
      })),
    };
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    execSync(
      `modal volume put ${MODAL_VOLUME} "${manifestPath}" "ace_step_jobs/${jobId}/manifest.json"`,
      { timeout: 60000, cwd: MODAL_DIR },
    );

    const { error } = await supabase.from("training_jobs").insert({
      id: jobId,
      user_id: user.id,
      status: "training",
      model_type: "ace_step_lora",
      model_name: modelName,
      source_entry_ids: usable.map((e: Entry) => e.id),
      file_count: usable.length,
      consent_timestamp: new Date().toISOString(),
      data_protection_enabled: true,
      started_at: new Date().toISOString(),
      training_config: {
        layers_used: AUDIO_LAYERS,
        entry_count: usable.length,
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fire-and-forget Modal training. The Python script is responsible for
    // updating the job status (via a follow-up API call) or the caller polls
    // /api/training/active-job. For now we just launch the subprocess and
    // return.
    const proc = spawn(
      "modal",
      [
        "run",
        "--detach",
        "ace_step.py",
        "--train-lora",
        "--job-id",
        jobId,
      ],
      {
        cwd: MODAL_DIR,
        detached: true,
        stdio: "ignore",
        env: { ...process.env },
      },
    );
    proc.unref();

    return NextResponse.json({
      job_id: jobId,
      status: "training",
      name: modelName,
      source_count: usable.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to launch training" },
      { status: 500 },
    );
  } finally {
    if (existsSync(tmp)) rmSync(tmp, { recursive: true, force: true });
  }
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("training_jobs")
    .select("id, status, model_name, file_count, created_at, completed_at, lora_model_url, error_message")
    .eq("user_id", user.id)
    .eq("model_type", "ace_step_lora")
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({ jobs: data ?? [] });
}
