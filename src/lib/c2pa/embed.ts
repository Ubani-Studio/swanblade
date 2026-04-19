/**
 * Binary C2PA embedding via c2pa-node (native Rust bindings to c2pa-rs).
 *
 * c2pa-node 0.5.x only signs audio/wav, audio/mp3 and similar container
 * formats through a FileAsset path, so we round-trip the buffer through a
 * temp file. The embedded JUMBF box travels with the WAV even when the file
 * is exported outside Swanblade.
 *
 * Signer strategy:
 *   - Dev: use the test signer shipped with c2pa-node (ES256 self-signed).
 *   - Prod: require C2PA_SIGN_CERT_PATH and C2PA_SIGN_KEY_PATH pointing at a
 *     real certificate + private key.
 */

import { randomUUID } from "crypto";
import { readFile, unlink, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

import type { C2paManifest } from "./manifest";

export interface EmbedResult {
  audio: Buffer;
  watermarkStatus: "embedded" | "sidecar";
  reason?: string;
}

const CERT_ENV = "C2PA_SIGN_CERT_PATH";
const KEY_ENV = "C2PA_SIGN_KEY_PATH";

let embedErrorReported = false;

function formatToExt(mimeType: string): string {
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  if (mimeType.includes("flac")) return "flac";
  if (mimeType.includes("ogg")) return "ogg";
  return "bin";
}

async function loadSigner() {
  const { createTestSigner, SigningAlgorithm } = await import("c2pa-node");
  const certPath = process.env[CERT_ENV];
  const keyPath = process.env[KEY_ENV];

  if (certPath && keyPath) {
    const [certificate, privateKey] = await Promise.all([readFile(certPath), readFile(keyPath)]);
    return {
      type: "local" as const,
      certificate,
      privateKey,
      algorithm: SigningAlgorithm.ES256,
    };
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(`Set ${CERT_ENV} and ${KEY_ENV} in production to sign C2PA manifests`);
  }

  return createTestSigner();
}

export async function embedC2paManifest(
  audio: Buffer,
  mimeType: string,
  manifest: C2paManifest,
): Promise<EmbedResult> {
  const ext = formatToExt(mimeType);
  const tmpIn = join(tmpdir(), `swanblade-c2pa-in-${randomUUID()}.${ext}`);
  const tmpOut = join(tmpdir(), `swanblade-c2pa-out-${randomUUID()}.${ext}`);

  try {
    const { createC2pa, ManifestBuilder } = await import("c2pa-node");
    const signer = await loadSigner();
    const c2pa = createC2pa({ signer });

    const builder = new ManifestBuilder({
      claim_generator: manifest.claim_generator,
      claim_generator_info: [manifest.claim_generator_info],
      title: manifest.title,
      format: mimeType,
      instance_id: manifest.instance_id,
      assertions: manifest.assertions.map((a) => ({ label: a.label, data: a.data })),
    });

    await writeFile(tmpIn, audio);

    await c2pa.sign({
      asset: { path: tmpIn, mimeType },
      manifest: builder,
      thumbnail: false,
      options: { outputPath: tmpOut },
    });

    const signed = await readFile(tmpOut);
    return { audio: signed, watermarkStatus: "embedded" };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    if (!embedErrorReported) {
      console.warn("[c2pa] binary embed unavailable, falling back to sidecar:", reason);
      embedErrorReported = true;
    }
    return { audio, watermarkStatus: "sidecar", reason };
  } finally {
    await Promise.all([
      unlink(tmpIn).catch(() => {}),
      unlink(tmpOut).catch(() => {}),
    ]);
  }
}
