/**
 * C2PA manifest signing.
 *
 * This is an HMAC-SHA256 signer bound to the server's C2PA_SIGNING_KEY. It is
 * deliberately simple and adapter-shaped — when c2pa-node is installed for
 * full x509 certificate-based signing and JUMBF embedding, the adapter swaps
 * without touching callers.
 *
 * Verification is symmetric: anyone with the server secret can verify. For
 * external verifiers, the signed manifest row is the authoritative record.
 */

import { createHmac, timingSafeEqual } from "crypto";

import type { C2paManifest } from "./manifest";

const ALG = "hmac-sha256";

function canonicalise(obj: unknown): string {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(canonicalise).join(",")}]`;
  const entries = Object.entries(obj as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalise(v)}`).join(",")}}`;
}

let warnedDevKey = false;

function getKey(): Buffer {
  const key = process.env.C2PA_SIGNING_KEY;
  if (!key || key.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("C2PA_SIGNING_KEY must be set (>= 16 chars) to sign manifests");
    }
    if (!warnedDevKey) {
      console.warn("[c2pa] C2PA_SIGNING_KEY unset — using insecure dev key. Set it in .env.local before deploying.");
      warnedDevKey = true;
    }
    return Buffer.from("swanblade-dev-insecure-key-change-me", "utf8");
  }
  return Buffer.from(key, "utf8");
}

export interface SignedManifest {
  manifest: C2paManifest;
  signature: string;
  alg: string;
  signed_at: string;
}

export function signManifest(manifest: C2paManifest): SignedManifest {
  const key = getKey();
  const body = canonicalise(manifest);
  const signature = createHmac("sha256", key).update(body).digest("hex");
  return { manifest, signature, alg: ALG, signed_at: new Date().toISOString() };
}

export function verifyManifest(manifest: C2paManifest, signature: string): boolean {
  try {
    const key = getKey();
    const body = canonicalise(manifest);
    const expected = createHmac("sha256", key).update(body).digest();
    const actual = Buffer.from(signature, "hex");
    if (expected.length !== actual.length) return false;
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
