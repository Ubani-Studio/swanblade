import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkUsageLimit, recordUsage } from "@/lib/usage";
import { stampGeneration, ProvenanceEnforcementError } from "@/lib/provenance/stamp-generation";
import { execSync } from "child_process";
import { readFileSync, existsSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Extract JSON from Modal stdout.
 * Scans lines in reverse to find the first valid JSON object.
 */
function extractJsonFromOutput(
  stdout: string
): Record<string, unknown> | null {
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

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check generation limit for user's tier
  const usage = await checkUsageLimit(supabase, user.id, "generation");
  if (!usage.allowed) {
    return NextResponse.json(
      {
        error: "Monthly generation limit reached.",
        current: usage.current,
        limit: usage.limit,
        tier: usage.tier,
      },
      { status: 429 }
    );
  }

  const body = await request.json();
  const { job_id, prompt, duration_seconds = 10, seed } = body;

  if (!job_id || !prompt?.trim()) {
    return NextResponse.json(
      { error: "job_id and prompt are required." },
      { status: 400 }
    );
  }

  // Verify the training job belongs to this user and is completed
  const { data: job, error } = await supabase
    .from("training_jobs")
    .select("id, status, lora_model_url")
    .eq("id", job_id)
    .eq("user_id", user.id)
    .single();

  if (error || !job) {
    return NextResponse.json(
      { error: "Training job not found." },
      { status: 404 }
    );
  }

  if (job.status !== "completed" || !job.lora_model_url) {
    return NextResponse.json(
      { error: "Model not ready. Training must be completed first." },
      { status: 400 }
    );
  }

  // Pass prompt via environment variable to prevent shell injection
  const seedValue = seed ?? Math.floor(Math.random() * 100000);
  const modalCmd = `cd /home/sphinxy/modal-audio && modal run lora_train.py --generate --job-id "${job_id}" --prompt "$SWANBLADE_PROMPT" --duration ${Number(duration_seconds)} --seed ${Number(seedValue)}`;

  let result: Record<string, unknown>;
  try {
    console.log(`[generate-lora] Starting generation with LoRA ${job_id}...`);
    const stdout = execSync(modalCmd, {
      timeout: 300000,
      encoding: "utf-8",
      env: { ...process.env, SWANBLADE_PROMPT: prompt.trim() },
    });

    // Parse JSON result (scans lines in reverse for robustness)
    const parsed = extractJsonFromOutput(stdout);
    if (!parsed) {
      console.error("[generate-lora] No JSON in Modal output:", stdout.slice(0, 500));
      return NextResponse.json(
        { error: "No result from GPU server." },
        { status: 500 }
      );
    }
    result = parsed;
  } catch (err) {
    console.error("[generate-lora] Modal generation failed:", err);
    return NextResponse.json(
      { error: "Generation failed on GPU server." },
      { status: 500 }
    );
  }

  if (result.status !== "completed" || !result.generation_id) {
    return NextResponse.json(
      { error: (result.error as string) || "Generation failed." },
      { status: 500 }
    );
  }

  // Download the generated audio from Modal volume
  const genId = result.generation_id as string;
  const tempDir = join(tmpdir(), `swanblade-gen-${genId}`);
  mkdirSync(tempDir, { recursive: true });

  const localWavPath = join(tempDir, `${genId}.wav`);

  try {
    execSync(
      `cd /home/sphinxy/modal-audio && modal volume get swanblade-training "generations/${genId}.wav" "${localWavPath}"`,
      { timeout: 60000 }
    );

    if (!existsSync(localWavPath)) {
      throw new Error("Downloaded file not found");
    }

    // Read and convert to data URL
    const audioBuffer = readFileSync(localWavPath);

    console.log(
      `[generate-lora] Generation complete: ${genId} (${(audioBuffer.byteLength / 1e6).toFixed(1)} MB)`
    );

    const now = new Date().toISOString();
    let provenance: Awaited<ReturnType<typeof stampGeneration>> | null = null;
    try {
      provenance = await stampGeneration({
        supabase,
        userId: user.id,
        audio: audioBuffer,
        title: prompt.trim().slice(0, 60) || `Generation ${genId.slice(0, 8)}`,
        prompt: prompt.trim(),
        pipelineSteps: [
          {
            stage: "stable-audio",
            adapter: "modal.stable-audio-lora",
            status: "completed",
            parameters: {
              duration_seconds: Number(duration_seconds),
              seed: Number(seedValue),
              lora_job_id: job_id,
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
      console.error("[generate-lora] stamp failed:", err);
    }

    // Record usage for tier-based limits
    await recordUsage(supabase, user.id, "generation", {
      provider: "modal",
      model: "stable-audio-lora",
    });

    const outputBuffer = provenance?.signedAudio ?? audioBuffer;
    const audioUrl = `data:audio/wav;base64,${outputBuffer.toString("base64")}`;

    return NextResponse.json({
      audioUrl,
      generationId: genId,
      loraJobId: job_id,
      provenance: provenance && {
        manifest_id: provenance.manifestId,
        fingerprint: provenance.fingerprint,
        signature: provenance.signature,
        private_canon: provenance.privateCanon,
        watermark_status: provenance.watermarkStatus,
      },
    });
  } catch (err) {
    console.error("[generate-lora] Failed to download from Modal:", err);
    return NextResponse.json(
      { error: "Failed to retrieve generated audio." },
      { status: 500 }
    );
  } finally {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
}
