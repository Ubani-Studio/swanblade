"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface SpectrogramProps {
  audioUrl: string | null;
  isPlaying: boolean;
  className?: string;
}

export function Spectrogram({ audioUrl, isPlaying, className }: SpectrogramProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationRef = useRef<number>(0);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!audioUrl || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Initialize audio context
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }

    const audioContext = audioContextRef.current;

    // Create analyser
    if (!analyserRef.current) {
      analyserRef.current = audioContext.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.8;
    }

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // Draw function
    const draw = () => {
      if (!ctx || !analyser) return;

      analyser.getByteFrequencyData(dataArray);

      // Clear canvas
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw frequency bars
      const barWidth = canvas.width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;

        // Gradient from purple to white based on intensity
        const intensity = dataArray[i] / 255;
        const r = Math.floor(102 + (255 - 102) * intensity);
        const g = Math.floor(2 + (255 - 2) * intensity);
        const b = Math.floor(60 + (255 - 60) * intensity);

        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);

        x += barWidth;
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    if (isPlaying) {
      draw();
    } else {
      cancelAnimationFrame(animationRef.current);
    }

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [audioUrl, isPlaying]);

  // Connect audio source when playing
  useEffect(() => {
    if (!audioUrl || !isPlaying) return;

    const initAudio = async () => {
      if (!audioContextRef.current || !analyserRef.current) return;

      const audioContext = audioContextRef.current;
      const analyser = analyserRef.current;

      // Resume context if suspended
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      // Find the audio element on the page
      const audioElements = document.querySelectorAll("audio");
      const matchingAudio = Array.from(audioElements).find(
        (el) => el.src === audioUrl || el.currentSrc === audioUrl
      );

      if (matchingAudio && !sourceRef.current) {
        try {
          sourceRef.current = audioContext.createMediaElementSource(matchingAudio);
          sourceRef.current.connect(analyser);
          analyser.connect(audioContext.destination);
          setInitialized(true);
        } catch (e) {
          // Source already connected
          setInitialized(true);
        }
      }
    };

    initAudio();
  }, [audioUrl, isPlaying]);

  if (!audioUrl) {
    return (
      <div className={cn("bg-black border border-[#1a1a1a]", className)}>
        <div className="h-24 flex items-center justify-center">
          <p className="text-body-sm text-gray-500">No audio loaded</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("bg-black border border-[#1a1a1a] overflow-hidden", className)}>
      <canvas
        ref={canvasRef}
        width={400}
        height={96}
        className="w-full h-24"
      />
      {!initialized && isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <p className="text-body-sm text-white">Initializing...</p>
        </div>
      )}
    </div>
  );
}

// Before/After spectrogram comparison for sculpted vs original
const COMPARISON_FFT = 2048;
const COMPARISON_HOP = 512;
const COMPARISON_H = 80;

function computeSpectrogramFrames(buffer: AudioBuffer, fftSize: number, hop: number): Float32Array[] {
  const raw = buffer.getChannelData(0);
  const hann = new Float32Array(fftSize);
  for (let i = 0; i < fftSize; i++) {
    hann[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
  }

  const frames: Float32Array[] = [];
  const bins = fftSize / 2;

  for (let offset = 0; offset + fftSize <= raw.length; offset += hop) {
    const magnitudes = new Float32Array(bins);
    // Sparse DFT — sample every 4th time point for speed
    for (let k = 0; k < bins; k++) {
      let re = 0, im = 0;
      for (let n = 0; n < fftSize; n += 4) {
        const val = raw[offset + n] * hann[n];
        const angle = (2 * Math.PI * k * n) / fftSize;
        re += val * Math.cos(angle);
        im -= val * Math.sin(angle);
      }
      magnitudes[k] = Math.sqrt(re * re + im * im);
    }
    frames.push(magnitudes);
  }
  return frames;
}

function renderSpectrogram(
  canvas: HTMLCanvasElement,
  frames: Float32Array[],
  color: [number, number, number],
) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx || frames.length === 0) return;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;
  const displayBins = Math.min(frames[0].length, 128);

  let globalMax = 0;
  for (const f of frames) {
    for (let b = 0; b < displayBins; b++) {
      if (f[b] > globalMax) globalMax = f[b];
    }
  }
  if (globalMax === 0) globalMax = 1;

  const colW = w / frames.length;
  const binH = h / displayBins;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < frames.length; i++) {
    const x = i * colW;
    for (let b = 0; b < displayBins; b++) {
      const val = frames[i][b] / globalMax;
      const dB = Math.max(0, Math.min(1, 1 + Math.log10(val + 0.001) / 3));
      const alpha = dB * dB;
      const y = h - (b + 1) * binH;
      ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
      ctx.fillRect(x, y, Math.ceil(colW) + 1, Math.ceil(binH) + 1);
    }
  }
}

interface SpectrogramComparisonProps {
  originalUrl?: string;
  sculptedUrl?: string;
}

export function SpectrogramComparison({ originalUrl, sculptedUrl }: SpectrogramComparisonProps) {
  const origRef = useRef<HTMLCanvasElement>(null);
  const sculptRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!originalUrl || !sculptedUrl) return;
    let cancelled = false;
    setLoading(true);

    const actx = new AudioContext();
    const abort = new AbortController();
    Promise.all([
      fetch(originalUrl, { signal: abort.signal }).then((r) => r.arrayBuffer()).then((buf) => actx.decodeAudioData(buf)),
      fetch(sculptedUrl, { signal: abort.signal }).then((r) => r.arrayBuffer()).then((buf) => actx.decodeAudioData(buf)),
    ])
      .then(([origBuf, sculptBuf]) => {
        if (cancelled) return;
        const origFrames = computeSpectrogramFrames(origBuf, COMPARISON_FFT, COMPARISON_HOP);
        const sculptFrames = computeSpectrogramFrames(sculptBuf, COMPARISON_FFT, COMPARISON_HOP);
        if (origRef.current) renderSpectrogram(origRef.current, origFrames, [140, 140, 180]);
        if (sculptRef.current) renderSpectrogram(sculptRef.current, sculptFrames, [180, 60, 140]);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; abort.abort(); actx.close(); };
  }, [originalUrl, sculptedUrl]);

  if (!originalUrl || !sculptedUrl) return null;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-gray-500">Original</p>
        {loading && <p className="text-[10px] text-gray-600 animate-pulse">Computing...</p>}
      </div>
      <canvas ref={origRef} className="w-full" style={{ height: COMPARISON_H }} />
      <p className="text-[10px] text-gray-500">Sculpted</p>
      <canvas ref={sculptRef} className="w-full" style={{ height: COMPARISON_H }} />
    </div>
  );
}

// Simplified static spectrogram for non-playing audio
export function StaticSpectrogram({
  peaks,
  className,
}: {
  peaks: number[];
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || peaks.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw peaks as bars
    const barWidth = canvas.width / peaks.length;
    peaks.forEach((peak, i) => {
      const barHeight = peak * canvas.height;
      const intensity = peak;
      const r = Math.floor(102 + (200 - 102) * intensity);
      const g = Math.floor(2 + (100 - 2) * intensity);
      const b = Math.floor(60 + (120 - 60) * intensity);

      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(
        i * barWidth,
        (canvas.height - barHeight) / 2,
        barWidth - 1,
        barHeight
      );
    });
  }, [peaks]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={48}
      className={cn("w-full h-12 bg-black border border-[#1a1a1a]", className)}
    />
  );
}
