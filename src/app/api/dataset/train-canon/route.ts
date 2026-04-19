/**
 * Canon training kickoff.
 *
 * Assembles a LoRA training manifest from the user's opted-in audio entries
 * (vocal_canon, live_captures, paired_controls), stages any local files into
 * the Modal volume, creates a training_jobs row, and fires the Modal LoRA
 * training in detached mode.
 *
 * Audio resolution:
 *   - http(s)://   → kept as-is, Modal downloads via HTTP
 *   - /api/dataset/audio?id=<uuid> → local file in .swanblade-library/dataset/
 *   - /api/library/audio?id=<sound_id> → local file in the Swanblade library
 *
 * Local files are copied into a staging directory, then pushed to the Modal
 * volume in a single `modal volume put`, and the manifest is rewritten to
 * reference them via `volume://sources/<entry_id>.<ext>`.
 */

import { NextRequest, NextResponse } from "next/server";
import { execSync, spawn } from "child_process";
import { mkdir, writeFile, copyFile, readdir, rm } from "fs/promises";
import { existsSync } from "fs";
import { join, extname } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

import { createClient } from "@/lib/supabase/server";
import { getLibrarySound, getAudioFilePath } from "@/lib/libraryStorage";

export const runtime = "nodejs";
export const maxDuration = 120;

const MODAL_DIR = process.env.SWANBLADE_MODAL_DIR || "/home/sphinxy/modal-audio";
const MODAL_VOLUME = process.env.SWANBLADE_MODAL_VOLUME || "swanblade-training";
const DATASET_LOCAL_DIR = join(process.cwd(), ".swanblade-library", "dataset");

const AUDIO_LAYERS = ["vocal_canon", "live_captures", "paired_controls"] as const;

interface Entry {
  id: string;
  title: string;
  audio_url: string | null;
  layer: string;
}

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

async function resolveLocalFile(url: string): Promise<string | null> {
  const datasetMatch = /^\/api\/dataset\/audio\?id=([0-9a-f-]+)$/i.exec(url);
  if (datasetMatch && isUuid(datasetMatch[1])) {
    const files = await readdir(DATASET_LOCAL_DIR).catch(() => [] as string[]);
    const match = files.find((f) => f.startsWith(`${datasetMatch[1]}.`));
    return match ? join(DATASET_LOCAL_DIR, match) : null;
  }
  const libraryMatch = /^\/api\/library\/audio\?id=([^&]+)$/i.exec(url);
  if (libraryMatch) {
    const sound = await getLibrarySound(libraryMatch[1]);
    if (!sound?.fileName) return null;
    const path = getAudioFilePath(sound.fileName);
    return existsSync(path) ? path : null;
  }
  return null;
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
      { error: `Need at least 3 opted-in audio entries. Found ${usable.length}.` },
      { status: 422 },
    );
  }

  const jobId = randomUUID();
  const staging = join(tmpdir(), `swanblade-canon-${jobId}`);
  const sourcesDir = join(staging, "sources");
  await mkdir(sourcesDir, { recursive: true });

  try {
    // Stage local files + rewrite manifest URLs to volume paths.
    const manifestEntries: Array<Record<string, unknown>> = [];
    let localCount = 0;
    let remoteCount = 0;

    for (const e of usable) {
      if (!e.audio_url) continue;
      const rewritten: Record<string, unknown> = {
        id: e.id,
        title: e.title,
        layer: e.layer,
      };

      if (e.audio_url.startsWith("http://") || e.audio_url.startsWith("https://")) {
        rewritten.audio_url = e.audio_url;
        remoteCount++;
      } else {
        const localPath = await resolveLocalFile(e.audio_url);
        if (!localPath) {
          console.warn(`[train-canon] could not resolve local file for ${e.id}: ${e.audio_url}`);
          continue;
        }
        const ext = extname(localPath) || ".wav";
        const fileName = `${e.id}${ext}`;
        await copyFile(localPath, join(sourcesDir, fileName));
        rewritten.audio_url = `volume://sources/${fileName}`;
        localCount++;
      }
      manifestEntries.push(rewritten);
    }

    if (manifestEntries.length < 3) {
      return NextResponse.json(
        { error: `After resolving local files, only ${manifestEntries.length} entries are trainable. Check that your dataset audio is still present.` },
        { status: 422 },
      );
    }

    const manifest = {
      job_id: jobId,
      user_id: user.id,
      name: modelName,
      entries: manifestEntries,
    };
    await writeFile(join(staging, "manifest.json"), JSON.stringify(manifest, null, 2));
    await writeFile(join(staging, "status.json"), JSON.stringify({
      stage: "preparing",
      progress: 0.0,
      message: "Uploading sources to Modal volume",
      updated_at: new Date().toISOString(),
    }));

    // Single multi-file upload — much faster than N sequential puts.
    execSync(
      `modal volume put ${MODAL_VOLUME} "${staging}" "ace_step_jobs/${jobId}" --force`,
      { timeout: 10 * 60 * 1000, cwd: MODAL_DIR },
    );

    const { error } = await supabase.from("training_jobs").insert({
      id: jobId,
      user_id: user.id,
      status: "training",
      model_type: "ace_step_lora",
      model_name: modelName,
      source_entry_ids: manifestEntries.map((e) => e.id),
      file_count: manifestEntries.length,
      consent_timestamp: new Date().toISOString(),
      data_protection_enabled: true,
      started_at: new Date().toISOString(),
      training_config: {
        layers_used: AUDIO_LAYERS,
        entry_count: manifestEntries.length,
        local_uploaded: localCount,
        remote_urls: remoteCount,
      },
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const proc = spawn(
      "modal",
      ["run", "--detach", "ace_step.py", "--train-lora", "--job-id", jobId],
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
      source_count: manifestEntries.length,
      local_uploaded: localCount,
      remote_urls: remoteCount,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to launch training" },
      { status: 500 },
    );
  } finally {
    if (existsSync(staging)) await rm(staging, { recursive: true, force: true });
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
