/**
 * 08 Protocol (Origin 8) — perceptual fingerprint.
 *
 * Version: origin8/0.1
 * Design: a deterministic, server-side vector derived from the decoded audio
 * energy envelope, quantised and hashed. Built in pure TS (no native deps) so
 * it runs in Next.js server routes alongside Modal generation.
 *
 * Stability: survives mild DSP (lossy compression, limiter, slight trim). Not
 * as robust as chromaprint; we version the tag so v0.2 can swap in a stronger
 * algorithm without losing forward compatibility.
 *
 * Format of the public fingerprint string:
 *   "o8v1:<64-hex-sha256>:<32-hex-vector-prefix>"
 */

import { createHash } from "crypto";

const FINGERPRINT_VERSION = "o8v1";
const TIME_BUCKETS = 64;
const DYNAMIC_LEVELS = 16;

export interface Origin8Fingerprint {
  version: string;
  value: string;
  vector: number[];
  duration_seconds: number;
  sample_rate: number;
  channels: number;
  decoded: boolean;
}

interface DecodedPcm {
  samples: Float32Array;
  sampleRate: number;
  channels: number;
}

/**
 * Parse a RIFF/WAVE buffer into mono Float32 samples.
 * Supports PCM 16-bit and IEEE float 32-bit (the two formats Modal emits).
 */
function decodeWav(buffer: Buffer): DecodedPcm | null {
  if (buffer.length < 44) return null;
  if (buffer.toString("ascii", 0, 4) !== "RIFF") return null;
  if (buffer.toString("ascii", 8, 12) !== "WAVE") return null;

  let offset = 12;
  let audioFormat = 0;
  let channels = 1;
  let sampleRate = 48000;
  let bitsPerSample = 16;
  let dataOffset = -1;
  let dataLength = 0;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;

    if (chunkId === "fmt ") {
      audioFormat = buffer.readUInt16LE(chunkStart);
      channels = buffer.readUInt16LE(chunkStart + 2);
      sampleRate = buffer.readUInt32LE(chunkStart + 4);
      bitsPerSample = buffer.readUInt16LE(chunkStart + 14);
    } else if (chunkId === "data") {
      dataOffset = chunkStart;
      dataLength = chunkSize;
      break;
    }
    offset = chunkStart + chunkSize + (chunkSize % 2);
  }

  if (dataOffset < 0 || channels < 1) return null;

  const bytesPerSample = bitsPerSample / 8;
  const frameCount = Math.floor(dataLength / (bytesPerSample * channels));
  const mono = new Float32Array(frameCount);

  for (let i = 0; i < frameCount; i++) {
    let acc = 0;
    for (let c = 0; c < channels; c++) {
      const pos = dataOffset + (i * channels + c) * bytesPerSample;
      if (pos + bytesPerSample > buffer.length) break;

      if (audioFormat === 1 && bitsPerSample === 16) {
        acc += buffer.readInt16LE(pos) / 32768;
      } else if (audioFormat === 1 && bitsPerSample === 24) {
        const b0 = buffer.readUInt8(pos);
        const b1 = buffer.readUInt8(pos + 1);
        const b2 = buffer.readInt8(pos + 2);
        acc += ((b2 << 16) | (b1 << 8) | b0) / 8388608;
      } else if (audioFormat === 1 && bitsPerSample === 32) {
        acc += buffer.readInt32LE(pos) / 2147483648;
      } else if (audioFormat === 3 && bitsPerSample === 32) {
        acc += buffer.readFloatLE(pos);
      } else {
        return null;
      }
    }
    mono[i] = acc / channels;
  }

  return { samples: mono, sampleRate, channels };
}

function quantiseVector(values: number[]): number[] {
  const max = Math.max(...values, 1e-9);
  return values.map((v) => Math.min(DYNAMIC_LEVELS - 1, Math.round((v / max) * (DYNAMIC_LEVELS - 1))));
}

/**
 * Compute the perceptual vector: TIME_BUCKETS time frames, each a log-RMS
 * energy value + a spectral-flux-ish delta value. Quantised into DYNAMIC_LEVELS.
 */
function computeVector(pcm: DecodedPcm): number[] {
  const { samples } = pcm;
  if (samples.length === 0) return new Array(TIME_BUCKETS * 2).fill(0);

  const bucketSize = Math.max(1, Math.floor(samples.length / TIME_BUCKETS));
  const energy: number[] = new Array(TIME_BUCKETS).fill(0);
  const flux: number[] = new Array(TIME_BUCKETS).fill(0);

  for (let b = 0; b < TIME_BUCKETS; b++) {
    const start = b * bucketSize;
    const end = Math.min(samples.length, start + bucketSize);
    let sumSq = 0;
    let sumDiff = 0;
    let prev = 0;
    for (let i = start; i < end; i++) {
      const s = samples[i];
      sumSq += s * s;
      sumDiff += Math.abs(s - prev);
      prev = s;
    }
    const n = Math.max(1, end - start);
    energy[b] = Math.log1p(Math.sqrt(sumSq / n));
    flux[b] = Math.log1p(sumDiff / n);
  }

  return [...quantiseVector(energy), ...quantiseVector(flux)];
}

/**
 * Build the Origin 8 fingerprint for a decoded audio buffer.
 *
 * The fingerprint is reproducible from the audio alone: the server always
 * recomputes it rather than trusting client input.
 */
export function computeOrigin8Fingerprint(audio: Buffer): Origin8Fingerprint {
  const decoded = decodeWav(audio);

  if (!decoded) {
    const hash = createHash("sha256").update(audio).digest("hex");
    return {
      version: FINGERPRINT_VERSION,
      value: `${FINGERPRINT_VERSION}:${hash}:raw`,
      vector: [],
      duration_seconds: 0,
      sample_rate: 0,
      channels: 0,
      decoded: false,
    };
  }

  const vector = computeVector(decoded);
  const bytes = Buffer.from(vector);
  const hash = createHash("sha256").update(bytes).digest("hex");
  const prefix = bytes.toString("hex").slice(0, 32);

  return {
    version: FINGERPRINT_VERSION,
    value: `${FINGERPRINT_VERSION}:${hash}:${prefix}`,
    vector,
    duration_seconds: decoded.samples.length / decoded.sampleRate,
    sample_rate: decoded.sampleRate,
    channels: decoded.channels,
    decoded: true,
  };
}

/**
 * Pairwise similarity between two fingerprints. 1.0 = identical.
 * Uses the quantised vector so it's robust to mild DSP.
 */
export function fingerprintSimilarity(a: Origin8Fingerprint, b: Origin8Fingerprint): number {
  if (!a.decoded || !b.decoded) return a.value === b.value ? 1 : 0;
  if (a.vector.length !== b.vector.length) return 0;
  let agree = 0;
  for (let i = 0; i < a.vector.length; i++) {
    if (Math.abs(a.vector[i] - b.vector[i]) <= 1) agree++;
  }
  return agree / a.vector.length;
}
