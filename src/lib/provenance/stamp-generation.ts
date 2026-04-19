/**
 * Server-side provenance stamping.
 *
 * `stampGeneration()` is the single path through which any generation becomes
 * a playable asset in Swanblade. It:
 *   1. Recomputes the 08 Protocol fingerprint server-side from the decoded
 *      audio (never trusts client input).
 *   2. Builds a C2PA manifest with Swanblade custom assertions + pipeline trace.
 *   3. Signs the manifest (HMAC) and writes a provenance_manifests row.
 *   4. Enforces Private Canon (Ethical Lock): fails closed when required.
 *
 * Generation routes (/api/generate-lora, /api/remix, /api/transform, and the
 * spec-driven /api/pipeline) MUST call this before returning any audio URL.
 */

import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { buildC2paManifest } from "@/lib/c2pa/manifest";
import { embedC2paManifest } from "@/lib/c2pa/embed";
import { signManifest } from "@/lib/c2pa/sign";
import { computeOrigin8Fingerprint } from "@/lib/origin8/fingerprint";
import type { PipelineStepTrace } from "@/lib/pipeline/types";

export interface StampInput {
  supabase: SupabaseClient;
  userId: string;
  audio: Buffer;
  title: string;
  format?: string;
  prompt?: string;
  pipelineSteps: PipelineStepTrace[];
  soundId?: string;
  parentManifestId?: string | null;
}

export interface StampOutput {
  manifestId: string;
  fingerprint: string;
  fingerprintVersion: string;
  signature: string;
  manifest: ReturnType<typeof buildC2paManifest>;
  privateCanon: boolean;
  aiTrainingOptIn: boolean;
  watermarkStatus: "sidecar" | "embedded" | "pending";
  /** Signed audio buffer when embedding succeeded; the caller should ship
   * this in place of the original so provenance travels with the file. */
  signedAudio?: Buffer;
}

export class ProvenanceEnforcementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProvenanceEnforcementError";
  }
}

async function loadSovereigntyPrefs(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ private_canon: boolean; ai_training_opt_in: boolean }> {
  const { data } = await supabase
    .from("profiles")
    .select("private_canon, ai_training_opt_in")
    .eq("id", userId)
    .single();
  return {
    private_canon: Boolean(data?.private_canon),
    ai_training_opt_in: Boolean(data?.ai_training_opt_in),
  };
}

export async function stampGeneration(input: StampInput): Promise<StampOutput> {
  const prefs = await loadSovereigntyPrefs(input.supabase, input.userId);

  const fp = computeOrigin8Fingerprint(input.audio);
  if (prefs.private_canon && !fp.decoded) {
    throw new ProvenanceEnforcementError(
      "Private Canon: unable to compute 08 Protocol fingerprint from audio buffer",
    );
  }

  const instanceId = randomUUID();
  let watermarkStatus: "sidecar" | "embedded" | "pending" = "sidecar";

  const manifest = buildC2paManifest({
    title: input.title,
    format: input.format ?? "audio/wav",
    instance_id: instanceId,
    fingerprint: fp.value,
    fingerprint_version: fp.version,
    fingerprint_vector_prefix: fp.value.split(":")[2],
    pipeline_steps: input.pipelineSteps,
    user_id: input.userId,
    prompt: input.prompt,
    private_canon_id: prefs.private_canon ? instanceId : null,
    ai_training_opt_in: prefs.ai_training_opt_in,
    watermark_status: watermarkStatus,
    parent_manifest_id: input.parentManifestId,
  });

  const signed = signManifest(manifest);

  // Attempt binary C2PA embedding (JUMBF). Falls back to sidecar-only.
  const embed = await embedC2paManifest(input.audio, input.format ?? "audio/wav", manifest);
  watermarkStatus = embed.watermarkStatus;

  if (prefs.private_canon && watermarkStatus !== "embedded") {
    // Private Canon prefers embedded provenance but doesn't hard-fail on
    // format gaps — we still have a signed row + sidecar. Log loudly.
    console.warn("[stamp] Private Canon: manifest is sidecar (embed reason: ", embed.reason, ")");
  }

  const { data, error } = await input.supabase
    .from("provenance_manifests")
    .insert({
      id: instanceId,
      user_id: input.userId,
      sound_id: input.soundId ?? null,
      origin8_fingerprint: fp.value,
      origin8_version: fp.version,
      watermark_status: watermarkStatus,
      manifest: signed.manifest,
      signature: signed.signature,
      signature_alg: signed.alg,
      claim_generator: signed.manifest.claim_generator,
      pipeline_steps: input.pipelineSteps,
      private_canon: prefs.private_canon,
      ai_training_opt_in: prefs.ai_training_opt_in,
      content_type: "audio",
    })
    .select("id")
    .single();

  if (error || !data) {
    if (prefs.private_canon) {
      throw new ProvenanceEnforcementError(
        `Private Canon: failed to persist C2PA manifest (${error?.message ?? "unknown"})`,
      );
    }
    console.warn("[stamp] failed to persist manifest row:", error?.message);
  }

  return {
    manifestId: data?.id ?? instanceId,
    fingerprint: fp.value,
    fingerprintVersion: fp.version,
    signature: signed.signature,
    manifest: signed.manifest,
    privateCanon: prefs.private_canon,
    aiTrainingOptIn: prefs.ai_training_opt_in,
    watermarkStatus,
    signedAudio: watermarkStatus === "embedded" ? embed.audio : undefined,
  };
}
