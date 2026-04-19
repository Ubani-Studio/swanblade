/**
 * Canon training status.
 *
 * Reads status.json off the Modal volume (written by ace_step.py during
 * training). Caches in-process for 3s so rapid polling doesn't hammer the
 * `modal volume get` CLI.
 *
 * When the Modal side reports a terminal state, we also update the
 * training_jobs row so the rest of Swanblade sees the correct status.
 */

import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import { mkdir, readFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MODAL_DIR = process.env.SWANBLADE_MODAL_DIR || "/home/sphinxy/modal-audio";
const MODAL_VOLUME = process.env.SWANBLADE_MODAL_VOLUME || "swanblade-training";

interface StatusShape {
  stage: string;
  progress: number;
  message?: string;
  step?: number;
  max_steps?: number;
  eta_seconds?: number;
  updated_at?: string;
  lora_path?: string;
  error?: string;
}

const cache = new Map<string, { at: number; value: StatusShape | null }>();
const CACHE_MS = 3000;

async function fetchStatus(jobId: string): Promise<StatusShape | null> {
  const now = Date.now();
  const cached = cache.get(jobId);
  if (cached && now - cached.at < CACHE_MS) return cached.value;

  const tmp = join(tmpdir(), `swanblade-status-${randomUUID()}`);
  await mkdir(tmp, { recursive: true });
  const localPath = join(tmp, "status.json");

  try {
    execSync(
      `modal volume get ${MODAL_VOLUME} "ace_step_jobs/${jobId}/status.json" "${localPath}" --force`,
      { timeout: 20000, cwd: MODAL_DIR, stdio: ["ignore", "ignore", "ignore"] },
    );
    const text = await readFile(localPath, "utf-8");
    const parsed = JSON.parse(text) as StatusShape;
    cache.set(jobId, { at: now, value: parsed });
    return parsed;
  } catch {
    cache.set(jobId, { at: now, value: null });
    return null;
  } finally {
    await rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("job_id");
  if (!jobId) return NextResponse.json({ error: "job_id required" }, { status: 400 });

  // Verify ownership.
  const { data: job } = await supabase
    .from("training_jobs")
    .select("id, user_id, status, model_name")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .eq("model_type", "ace_step_lora")
    .single();

  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const status = await fetchStatus(jobId);

  // Update the DB row on terminal transitions so the jobs list reflects truth.
  if (status?.stage === "completed" && job.status !== "completed") {
    await supabase
      .from("training_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        lora_model_url: status.lora_path ?? null,
      })
      .eq("id", jobId);
  } else if (status?.stage === "failed" && job.status !== "failed") {
    await supabase
      .from("training_jobs")
      .update({
        status: "failed",
        error_message: status.error ?? status.message ?? "training failed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  }

  return NextResponse.json({
    job_id: jobId,
    db_status: job.status,
    status: status ?? { stage: "pending", progress: 0, message: "waiting for Modal to start" },
  });
}
