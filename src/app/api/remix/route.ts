import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from "fs";
import { randomBytes, createCipheriv } from "crypto";
import { join } from "path";
import { execSync } from "child_process";
import { tmpdir } from "os";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Server-side AES-256-GCM encryption for non-secure contexts.
 * Produces output compatible with the Python decryption in lora_train.py.
 */
function encryptServerSide(
  data: Buffer,
  keyBytes: Buffer
): { encrypted: Buffer; iv: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([encrypted, authTag]);
  return { encrypted: combined, iv: iv.toString("base64") };
}

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

  const body = await request.json();
  const {
    prompt,
    strength = 0.5,
    duration_seconds = 10,
    seed,
    lora_job_id,
    original_name,
    engine = "stable-audio",
    periodic_prompt = 7,
    upper_codebook_mask = 3,
    onset_mask_width = 0,
    temperature = 1.0,
    feedback_steps = 1,
    stereo_mode = "mid-side",
    dry_wet = 1.0,
    spectral_match = false,
    normalize_loudness = true,
    compress = false,
    hpss = false,
    demucs_stems = "",
    enhance = false,
    magnet_temperature = 3.0,
    magnet_top_k = 250,
    inpaint_start = 0,
    inpaint_end = 0,
    transplant = false,
    transplant_codebooks = "low",
  } = body;

  const referenceB64: string | undefined = body.reference_b64;
  const donorB64: string | undefined = body.donor_b64;

  // Accept either client-encrypted or raw audio
  const isClientEncrypted = !!body.encrypted_b64;
  const clientSessionKey: string | undefined = body.session_key_b64;
  const rawAudioB64: string | undefined = body.audio_b64;

  if (!isClientEncrypted && !rawAudioB64) {
    return NextResponse.json(
      { error: "No audio data provided." },
      { status: 400 }
    );
  }

  if (isClientEncrypted && !clientSessionKey) {
    return NextResponse.json(
      { error: "Missing session key for client-encrypted upload." },
      { status: 400 }
    );
  }

  // If LoRA specified, verify it belongs to user and is completed
  if (lora_job_id) {
    const { data: job, error } = await supabase
      .from("training_jobs")
      .select("id, status")
      .eq("id", lora_job_id)
      .eq("user_id", user.id)
      .single();

    if (error || !job || job.status !== "completed") {
      return NextResponse.json(
        { error: "LoRA model not found or not ready." },
        { status: 400 }
      );
    }
  }

  const remixId = crypto.randomUUID();
  const tempDir = join(tmpdir(), `swanblade-remix-${remixId}`);
  mkdirSync(tempDir, { recursive: true });

  let keyB64: string;
  let iv: string;

  try {
    const encPath = join(tempDir, "input.enc");

    if (isClientEncrypted) {
      // Client already encrypted — write directly
      const encBuffer = Buffer.from(body.encrypted_b64, "base64");
      writeFileSync(encPath, encBuffer);
      keyB64 = clientSessionKey!;
      iv = body.iv;
    } else {
      // Server-side encryption
      const keyBytes = randomBytes(32);
      keyB64 = keyBytes.toString("base64");
      const rawBuffer = Buffer.from(rawAudioB64!, "base64");
      const result = encryptServerSide(rawBuffer, keyBytes);
      writeFileSync(encPath, result.encrypted);
      iv = result.iv;
    }

    // Write metadata
    const meta = {
      remix_id: remixId,
      original_name: original_name || "input.wav",
      iv,
    };
    const metaPath = join(tempDir, "meta.json");
    writeFileSync(metaPath, JSON.stringify(meta));

    // Push encrypted file + metadata to Modal volume
    const volumeName = "swanblade-training";
    const remotePath = `remix/${remixId}`;

    execSync(
      `modal volume put ${volumeName} "${encPath}" "${remotePath}/input.enc"`,
      { timeout: 60000 }
    );
    execSync(
      `modal volume put ${volumeName} "${metaPath}" "${remotePath}/meta.json"`,
      { timeout: 15000 }
    );

    console.log(`[remix] Uploaded encrypted audio to Modal volume for remix ${remixId}`);

    // Upload donor audio for transplant mode
    if (transplant && donorB64) {
      const donorKeyBytes = Buffer.from(keyB64, "base64");
      const donorRaw = Buffer.from(donorB64, "base64");
      const donorResult = encryptServerSide(donorRaw, donorKeyBytes);
      const donorEncPath = join(tempDir, "donor.enc");
      writeFileSync(donorEncPath, donorResult.encrypted);
      const donorMeta = { iv: donorResult.iv };
      const donorMetaPath = join(tempDir, "donor_meta.json");
      writeFileSync(donorMetaPath, JSON.stringify(donorMeta));

      execSync(
        `modal volume put ${volumeName} "${donorEncPath}" "${remotePath}/donor.enc"`,
        { timeout: 60000 }
      );
      execSync(
        `modal volume put ${volumeName} "${donorMetaPath}" "${remotePath}/donor_meta.json"`,
        { timeout: 15000 }
      );
      console.log(`[remix] Uploaded encrypted donor audio for transplant`);
    }
  } catch (err) {
    console.error("[remix] Failed to upload to Modal volume:", err);
    return NextResponse.json(
      { error: "Failed to upload audio to GPU server." },
      { status: 500 }
    );
  } finally {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }

  // Run remix on Modal
  const seedValue = seed ?? Math.floor(Math.random() * 100000);
  const safeStrength = Math.max(0.05, Math.min(1.0, Number(strength)));
  const promptArg = (prompt || "").trim();

  // Build command — branch on engine type
  let modalCmd: string;

  if (engine === "vampnet") {
    const safePeriodicPrompt = Math.max(1, Math.min(16, Math.round(Number(periodic_prompt))));
    const safeUpperMask = Math.max(1, Math.min(8, Math.round(Number(upper_codebook_mask))));
    const safeOnsetMask = Math.max(0, Math.min(5, Math.round(Number(onset_mask_width))));
    const safeTemperature = Math.max(0.1, Math.min(3.0, Number(temperature)));
    const safeFeedbackSteps = Math.max(1, Math.min(4, Math.round(Number(feedback_steps))));
    const safeStereoMode = ["mid-side", "independent", "mono-widen"].includes(stereo_mode) ? stereo_mode : "mid-side";

    const safeDryWet = Math.max(0, Math.min(1, Number(dry_wet)));
    const safeHpss = !!hpss;
    const safeEnhance = !!enhance;
    const safeSpectralMatch = spectral_match === true;
    const safeNormalize = normalize_loudness !== false;
    const safeCompress = compress === true;
    const safeDemucsStems = typeof demucs_stems === "string" ? demucs_stems.replace(/[^a-z,]/gi, "") : "";

    modalCmd = `cd /home/sphinxy/modal-audio && modal run remix_engines.py --vampnet --remix-id "${remixId}" --key "$SWANBLADE_KEY" --periodic-prompt ${safePeriodicPrompt} --upper-codebook-mask ${safeUpperMask} --onset-mask-width ${safeOnsetMask} --temperature ${safeTemperature} --feedback-steps ${safeFeedbackSteps} --seed ${Number(seedValue)} --stereo-mode ${safeStereoMode} --dry-wet ${safeDryWet}`;
    if (!safeSpectralMatch) modalCmd += " --no-spectral-match";
    if (!safeNormalize) modalCmd += " --no-normalize-loudness";
    if (safeCompress) modalCmd += " --compress";
    if (safeHpss) modalCmd += " --hpss";
    if (safeEnhance) modalCmd += " --enhance";
    if (safeDemucsStems) modalCmd += ` --demucs-stems "${safeDemucsStems}"`;
    // Inpaint: restrict regeneration to a time region
    const safeInpaintStart = Math.max(0, Number(inpaint_start) || 0);
    const safeInpaintEnd = Math.max(0, Number(inpaint_end) || 0);
    if (safeInpaintStart > 0 || safeInpaintEnd > 0) {
      modalCmd += ` --inpaint-start ${safeInpaintStart} --inpaint-end ${safeInpaintEnd}`;
    }
    // Transplant: mix codebooks from two audio sources
    if (transplant && donorB64) {
      const safeTransplantCb = ["low", "mid", "high"].includes(transplant_codebooks) ? transplant_codebooks : "low";
      modalCmd += ` --transplant --transplant-codebooks ${safeTransplantCb}`;
    }
  } else if (engine === "magnet") {
    const safeMagnetTemp = Math.max(1, Math.min(10, Number(magnet_temperature)));
    const safeMagnetTopK = Math.max(50, Math.min(500, Math.round(Number(magnet_top_k))));
    modalCmd = `cd /home/sphinxy/modal-audio && modal run magnet_engine.py --remix-id "${remixId}" --key "$SWANBLADE_KEY" --prompt "$SWANBLADE_PROMPT" --duration ${Number(duration_seconds)} --temperature ${safeMagnetTemp} --top-k ${safeMagnetTopK} --seed ${Number(seedValue)}`;
  } else {
    // Stable Audio (default) — pass prompt via env var to prevent shell injection
    modalCmd = `cd /home/sphinxy/modal-audio && modal run lora_train.py --remix --remix-id "${remixId}" --key "$SWANBLADE_KEY" --strength ${safeStrength} --duration ${Number(duration_seconds)} --seed ${Number(seedValue)}`;
    if (promptArg) {
      modalCmd += ` --prompt "$SWANBLADE_PROMPT"`;
    }
    if (lora_job_id) {
      modalCmd += ` --lora-job "${lora_job_id}"`;
    }
  }

  let result: Record<string, unknown>;
  try {
    console.log(`[remix] Starting ${engine} remix ${remixId}...`);
    const stdout = execSync(modalCmd, {
      timeout: 600000,
      encoding: "utf-8",
      env: {
        ...process.env,
        SWANBLADE_KEY: keyB64,
        SWANBLADE_PROMPT: promptArg,
      },
    });

    const parsed = extractJsonFromOutput(stdout);
    if (!parsed) {
      console.error("[remix] No JSON in Modal output:", stdout.slice(0, 500));
      return NextResponse.json(
        { error: "No result from GPU server." },
        { status: 500 }
      );
    }
    result = parsed;
  } catch (err) {
    console.error("[remix] Modal remix failed:", err);
    return NextResponse.json(
      { error: "Remix failed on GPU server." },
      { status: 500 }
    );
  }

  if (result.status !== "completed" || !result.generation_id) {
    return NextResponse.json(
      { error: (result.error as string) || "Remix failed." },
      { status: 500 }
    );
  }

  // Download the generated audio from Modal volume
  const genId = result.generation_id as string;
  const downloadDir = join(tmpdir(), `swanblade-remix-dl-${genId}`);
  mkdirSync(downloadDir, { recursive: true });
  const localWavPath = join(downloadDir, `${genId}.wav`);

  try {
    execSync(
      `cd /home/sphinxy/modal-audio && modal volume get swanblade-training "generations/${genId}.wav" "${localWavPath}"`,
      { timeout: 60000 }
    );

    if (!existsSync(localWavPath)) {
      throw new Error("Downloaded file not found");
    }

    // Reference mastering (optional)
    if (referenceB64) {
      try {
        const refPath = join(downloadDir, "reference.wav");
        writeFileSync(refPath, Buffer.from(referenceB64, "base64"));
        console.log(`[remix] Applying reference mastering...`);
        execSync(
          `cd /home/sphinxy/modal-audio && modal run squarp_mastering.py --audio-path "${localWavPath}" --reference-path "${refPath}"`,
          { timeout: 120000, encoding: "utf-8" }
        );
        const masteredPath = localWavPath.replace(".wav", "_mastered.wav");
        if (existsSync(masteredPath)) {
          const masteredBuf = readFileSync(masteredPath);
          writeFileSync(localWavPath, masteredBuf);
          console.log(`[remix] Reference mastering applied`);
        }
      } catch (masterErr) {
        console.error("[remix] Reference mastering failed, using unmastered:", masterErr);
      }
    }

    const audioBuffer = readFileSync(localWavPath);
    const base64 = audioBuffer.toString("base64");
    const audioUrl = `data:audio/wav;base64,${base64}`;

    console.log(
      `[remix] Complete: ${genId} (${(audioBuffer.byteLength / 1e6).toFixed(1)} MB)`
    );

    return NextResponse.json({
      audioUrl,
      generationId: genId,
      remixId,
    });
  } catch (err) {
    console.error("[remix] Failed to download from Modal:", err);
    return NextResponse.json(
      { error: "Failed to retrieve remixed audio." },
      { status: 500 }
    );
  } finally {
    if (existsSync(downloadDir)) {
      rmSync(downloadDir, { recursive: true, force: true });
    }
  }
}
