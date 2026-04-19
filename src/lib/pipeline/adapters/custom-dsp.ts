/**
 * Custom DSP stage — the "signature layer" that shapes raw generations toward
 * the Swanblade sound. Runs in pure TS on the decoded PCM.
 *
 * Operations (parameterised on the stage):
 *   - tilt: +/- dB linear spectral tilt (darker/brighter)
 *   - saturate: soft-clip drive (0..1)
 *   - widen: mid/side stereo widening factor (0..2)
 *   - limiter: peak ceiling (-3..0 dBFS)
 *
 * It writes a new RIFF/WAVE buffer so downstream stages stay compatible.
 */

import type { PipelineContext, PipelineSpec, PipelineStage, StageAdapter, StageResult } from "../types";

interface DspParams {
  tilt?: number;
  saturate?: number;
  widen?: number;
  limiter?: number;
}

interface DecodedStereo {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
  bitsPerSample: number;
}

function decode(buffer: Buffer): DecodedStereo | null {
  if (buffer.length < 44) return null;
  if (buffer.toString("ascii", 0, 4) !== "RIFF") return null;
  if (buffer.toString("ascii", 8, 12) !== "WAVE") return null;

  let offset = 12;
  let channels = 1;
  let sampleRate = 48000;
  let bitsPerSample = 16;
  let dataOffset = -1;
  let dataLength = 0;

  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (id === "fmt ") {
      channels = buffer.readUInt16LE(start + 2);
      sampleRate = buffer.readUInt32LE(start + 4);
      bitsPerSample = buffer.readUInt16LE(start + 14);
    } else if (id === "data") {
      dataOffset = start;
      dataLength = size;
      break;
    }
    offset = start + size + (size % 2);
  }

  if (dataOffset < 0 || bitsPerSample !== 16) return null;

  const frameCount = Math.floor(dataLength / (2 * channels));
  const left = new Float32Array(frameCount);
  const right = new Float32Array(frameCount);

  for (let i = 0; i < frameCount; i++) {
    const base = dataOffset + i * channels * 2;
    const l = buffer.readInt16LE(base) / 32768;
    const r = channels > 1 ? buffer.readInt16LE(base + 2) / 32768 : l;
    left[i] = l;
    right[i] = r;
  }

  return { left, right, sampleRate, bitsPerSample };
}

function encode(stereo: DecodedStereo): Buffer {
  const { left, right, sampleRate } = stereo;
  const frameCount = left.length;
  const channels = 2;
  const bitsPerSample = 16;
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const dataSize = frameCount * channels * 2;
  const buf = Buffer.alloc(44 + dataSize);

  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(channels * 2, 32);
  buf.writeUInt16LE(bitsPerSample, 34);
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < frameCount; i++) {
    const l = Math.max(-1, Math.min(1, left[i]));
    const r = Math.max(-1, Math.min(1, right[i]));
    buf.writeInt16LE(Math.round(l * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(r * 32767), 44 + i * 4 + 2);
  }

  return buf;
}

function applyTilt(sample: number, prev: number, tilt: number): number {
  const k = Math.max(-1, Math.min(1, tilt));
  return sample + k * (sample - prev);
}

function softClip(sample: number, drive: number): number {
  if (drive <= 0) return sample;
  const k = 1 + drive * 4;
  return Math.tanh(k * sample) / Math.tanh(k);
}

function process(stereo: DecodedStereo, p: DspParams): DecodedStereo {
  const tilt = p.tilt ?? 0;
  const drive = Math.max(0, Math.min(1, p.saturate ?? 0));
  const widen = Math.max(0, Math.min(2, p.widen ?? 1));
  const ceiling = Math.pow(10, (p.limiter ?? -1) / 20);

  let prevL = 0;
  let prevR = 0;
  for (let i = 0; i < stereo.left.length; i++) {
    let l = stereo.left[i];
    let r = stereo.right[i];

    l = applyTilt(l, prevL, tilt);
    r = applyTilt(r, prevR, tilt);
    prevL = stereo.left[i];
    prevR = stereo.right[i];

    l = softClip(l, drive);
    r = softClip(r, drive);

    const mid = (l + r) * 0.5;
    const side = (l - r) * 0.5 * widen;
    l = mid + side;
    r = mid - side;

    const peak = Math.max(Math.abs(l), Math.abs(r));
    if (peak > ceiling) {
      const gain = ceiling / peak;
      l *= gain;
      r *= gain;
    }

    stereo.left[i] = l;
    stereo.right[i] = r;
  }

  return stereo;
}

export const customDspAdapter: StageAdapter = {
  kind: "custom-dsp",
  name: "swanblade.custom-dsp/0.1",
  available: true,
  async run(_spec: PipelineSpec, stage: PipelineStage, ctx: PipelineContext): Promise<StageResult> {
    if (!ctx.audio) {
      return { status: "skipped", message: "no input audio" };
    }

    const decoded = decode(ctx.audio);
    if (!decoded) {
      return { status: "skipped", message: "input not PCM16 WAV; passthrough" };
    }

    const out = process(decoded, (stage.parameters ?? {}) as DspParams);
    return { status: "completed", audio: encode(out) };
  },
};
