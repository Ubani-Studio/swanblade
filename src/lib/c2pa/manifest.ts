/**
 * C2PA manifest construction.
 *
 * This builds a spec-shaped C2PA manifest JSON. We intentionally emit the raw
 * manifest body (not a signed JUMBF store) so it can be stored in Postgres and
 * rendered as a sidecar JSON next to the audio. When c2pa-node is wired in for
 * binary embedding, it will consume this same shape.
 *
 * Custom Swanblade assertions live under the `swanblade.*` namespace so they
 * don't collide with c2pa.* standard assertions.
 */

import type { PipelineStepTrace } from "@/lib/pipeline/types";

export interface C2paManifestInput {
  title: string;
  format: string;
  instance_id: string;
  fingerprint: string;
  fingerprint_version: string;
  fingerprint_vector_prefix?: string;
  pipeline_steps: PipelineStepTrace[];
  user_id: string;
  prompt?: string;
  private_canon_id?: string | null;
  ai_training_opt_in: boolean;
  watermark_status: "sidecar" | "embedded" | "pending";
  parent_manifest_id?: string | null;
}

export interface C2paManifest {
  claim_generator: string;
  claim_generator_info: { name: string; version: string };
  title: string;
  format: string;
  instance_id: string;
  assertions: Array<{
    label: string;
    data: Record<string, unknown>;
  }>;
  ingredients: Array<{
    title: string;
    relationship: "parentOf" | "componentOf";
    manifest_id: string;
  }>;
}

const CLAIM_GENERATOR = "swanblade/0.2";

/**
 * Build a C2PA manifest body from a generation result.
 *
 * Standard assertions: c2pa.actions, c2pa.hash.data.
 * Custom assertions:
 *   swanblade.origin8_fingerprint — perceptual hash + version
 *   swanblade.pipeline            — ordered pipeline step trace
 *   swanblade.private_canon_id    — opaque ref if in Private Canon mode
 *   swanblade.ai_training_opt_in  — user's training consent for this asset
 */
export function buildC2paManifest(input: C2paManifestInput): C2paManifest {
  const now = new Date().toISOString();

  const actions = input.pipeline_steps.map((step) => ({
    action: `swanblade.${step.stage}`,
    when: step.finished_at,
    parameters: step.parameters ?? {},
    softwareAgent: step.adapter,
  }));

  if (!actions.length) {
    actions.push({
      action: "c2pa.created",
      when: now,
      parameters: {},
      softwareAgent: CLAIM_GENERATOR,
    });
  }

  const assertions: C2paManifest["assertions"] = [
    {
      label: "c2pa.actions",
      data: { actions },
    },
    {
      label: "c2pa.hash.data",
      data: {
        alg: "sha256",
        hash: input.fingerprint.split(":").slice(1, 2).join(""),
        name: input.instance_id,
      },
    },
    {
      label: "swanblade.origin8_fingerprint",
      data: {
        version: input.fingerprint_version,
        value: input.fingerprint,
        vector_prefix: input.fingerprint_vector_prefix,
      },
    },
    {
      label: "swanblade.pipeline",
      data: {
        steps: input.pipeline_steps.map((s) => ({
          stage: s.stage,
          adapter: s.adapter,
          status: s.status,
          parameters: s.parameters ?? {},
          elapsed_ms: s.elapsed_ms,
        })),
      },
    },
    {
      label: "swanblade.ai_training_opt_in",
      data: { opted_in: input.ai_training_opt_in },
    },
  ];

  if (input.private_canon_id) {
    assertions.push({
      label: "swanblade.private_canon_id",
      data: { id: input.private_canon_id, mode: "ethical_lock" },
    });
  }

  if (input.prompt) {
    assertions.push({
      label: "swanblade.prompt",
      data: { text: input.prompt.slice(0, 512) },
    });
  }

  assertions.push({
    label: "swanblade.watermark",
    data: { status: input.watermark_status },
  });

  const ingredients: C2paManifest["ingredients"] = [];
  if (input.parent_manifest_id) {
    ingredients.push({
      title: "source",
      relationship: "parentOf",
      manifest_id: input.parent_manifest_id,
    });
  }

  return {
    claim_generator: CLAIM_GENERATOR,
    claim_generator_info: { name: "Swanblade", version: "0.2" },
    title: input.title,
    format: input.format,
    instance_id: input.instance_id,
    assertions,
    ingredients,
  };
}

export const CLAIM_GENERATOR_ID = CLAIM_GENERATOR;
