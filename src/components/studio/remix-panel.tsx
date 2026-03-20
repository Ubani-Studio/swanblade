"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";

export interface RemixFile {
  file: File;
  name: string;
  size: number;
  previewUrl: string;
}

const MAX_FILE_BYTES = 100 * 1024 * 1024;

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "unknown";
  const units = ["B", "KB", "MB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export type RemixEngineId = "stable-audio" | "vampnet" | "magnet";
export type StereoMode = "mid-side" | "independent" | "mono-widen";
export type VampnetMode = "full" | "inpaint" | "transplant";
export type TransplantCodebooks = "low" | "mid" | "high";

interface RemixPanelProps {
  file: RemixFile | null;
  onFileChange: (file: RemixFile | null) => void;
  strength: number;
  onStrengthChange: (value: number) => void;
  engine: RemixEngineId;
  onEngineChange: (engine: RemixEngineId) => void;
  periodicPrompt: number;
  onPeriodicPromptChange: (value: number) => void;
  upperCodebookMask: number;
  onUpperCodebookMaskChange: (value: number) => void;
  onsetMaskWidth: number;
  onOnsetMaskWidthChange: (value: number) => void;
  temperature: number;
  onTemperatureChange: (value: number) => void;
  feedbackSteps: number;
  onFeedbackStepsChange: (value: number) => void;
  stereoMode: StereoMode;
  onStereoModeChange: (mode: StereoMode) => void;
  dryWet: number;
  onDryWetChange: (value: number) => void;
  spectralMatch: boolean;
  onSpectralMatchChange: (value: boolean) => void;
  normalizeLoudness: boolean;
  onNormalizeLoudnessChange: (value: boolean) => void;
  hpssEnabled: boolean;
  onHpssChange: (value: boolean) => void;
  demucsStems: string[];
  onDemucsStemsChange: (stems: string[]) => void;
  enhanceEnabled: boolean;
  onEnhanceChange: (value: boolean) => void;
  compressEnabled: boolean;
  onCompressChange: (value: boolean) => void;
  magnetTemperature: number;
  onMagnetTemperatureChange: (value: number) => void;
  magnetTopK: number;
  onMagnetTopKChange: (value: number) => void;
  referenceFile: RemixFile | null;
  onReferenceFileChange: (file: RemixFile | null) => void;
  onToast: (message: string, tone?: "neutral" | "success" | "error") => void;
  // VampNet advanced modes
  vampnetMode: VampnetMode;
  onVampnetModeChange: (mode: VampnetMode) => void;
  inpaintStart: number;
  inpaintEnd: number;
  onInpaintRangeChange: (start: number, end: number) => void;
  donorFile: RemixFile | null;
  onDonorFileChange: (file: RemixFile | null) => void;
  transplantCodebooks: TransplantCodebooks;
  onTransplantCodebooksChange: (cb: TransplantCodebooks) => void;
}

export function RemixPanel({
  file,
  onFileChange,
  strength,
  onStrengthChange,
  engine,
  onEngineChange,
  periodicPrompt,
  onPeriodicPromptChange,
  upperCodebookMask,
  onUpperCodebookMaskChange,
  onsetMaskWidth,
  onOnsetMaskWidthChange,
  temperature,
  onTemperatureChange,
  feedbackSteps,
  onFeedbackStepsChange,
  stereoMode,
  onStereoModeChange,
  dryWet,
  onDryWetChange,
  spectralMatch,
  onSpectralMatchChange,
  normalizeLoudness,
  onNormalizeLoudnessChange,
  hpssEnabled,
  onHpssChange,
  demucsStems,
  onDemucsStemsChange,
  enhanceEnabled,
  onEnhanceChange,
  compressEnabled,
  onCompressChange,
  magnetTemperature,
  onMagnetTemperatureChange,
  magnetTopK,
  onMagnetTopKChange,
  referenceFile,
  onReferenceFileChange,
  onToast,
  vampnetMode,
  onVampnetModeChange,
  inpaintStart,
  inpaintEnd,
  onInpaintRangeChange,
  donorFile,
  onDonorFileChange,
  transplantCodebooks,
  onTransplantCodebooksChange,
}: RemixPanelProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  const setFile = useCallback(
    (f: File | null) => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      if (!f) {
        onFileChange(null);
        return;
      }
      if (!f.type.startsWith("audio/")) {
        onToast("Audio files only.", "error");
        return;
      }
      if (f.size > MAX_FILE_BYTES) {
        onToast("File exceeds 100 MB limit.", "error");
        return;
      }
      const previewUrl = URL.createObjectURL(f);
      previewUrlRef.current = previewUrl;
      onFileChange({ file: f, name: f.name, size: f.size, previewUrl });
    },
    [onFileChange, onToast]
  );

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
    e.target.value = "";
  };

  const openPicker = () => fileInputRef.current?.click();

  return (
    <div className="bg-black border border-white/[0.06] p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-400">Input</p>
        {file && (
          <button
            onClick={() => setFile(null)}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Drop zone */}
      {!file && (
        <div
          className={`group mt-3 relative cursor-pointer overflow-hidden border transition-colors duration-200 ${
            isDragging
              ? "border-white/20 bg-white/[0.02]"
              : "border-white/[0.06] hover:border-white/[0.12]"
          }`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={openPicker}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={onFileInput}
          />
          <div className="flex items-center gap-4 px-4 py-4">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              className={`text-gray-500 transition-colors ${isDragging ? "text-white" : "group-hover:text-gray-300"}`}
            >
              <path
                d="M12 16V4m0 0l-4 4m4-4l4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M20 16v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-light ${isDragging ? "text-white" : "text-gray-500 group-hover:text-gray-300"}`}>
                {isDragging ? "Drop to sculpt" : "Drop audio to sculpt"}
              </p>
              <p className="text-[10px] text-gray-600">100 MB</p>
            </div>
          </div>
        </div>
      )}

      {/* File loaded — preview + controls */}
      {file && (
        <div className="mt-3 space-y-3">
          {/* Player */}
          <WaveformPlayer
            src={file.previewUrl}
            name={file.name}
            size={file.size}
            inpaintMode={engine === "vampnet" && vampnetMode === "inpaint"}
            inpaintStart={inpaintStart}
            inpaintEnd={inpaintEnd}
            onInpaintRangeChange={onInpaintRangeChange}
          />

          {/* Engine */}
          <div className="flex gap-1.5">
            {(["stable-audio", "vampnet", "magnet"] as const).map((eng) => (
              <button
                key={eng}
                onClick={() => onEngineChange(eng)}
                className={`flex-1 px-2 py-1.5 text-[11px] border transition-colors duration-150 ${
                  engine === eng
                    ? "border-white/20 bg-white/[0.06] text-white"
                    : "border-white/[0.04] text-gray-600 hover:text-gray-400"
                }`}
              >
                {eng === "stable-audio" ? "Diffusion" : eng === "vampnet" ? "VampNet" : "MAGNeT"}
              </button>
            ))}
          </div>

          {/* VampNet mode toggle */}
          {engine === "vampnet" && (
            <div className="flex gap-1.5">
              {(["full", "inpaint", "transplant"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => onVampnetModeChange(m)}
                  className={`flex-1 px-2 py-1 text-[11px] border transition-colors duration-150 ${
                    vampnetMode === m
                      ? "border-white/20 bg-white/[0.06] text-white"
                      : "border-white/[0.04] text-gray-600 hover:text-gray-400"
                  }`}
                >
                  {m === "full" ? "Full" : m === "inpaint" ? "Inpaint" : "Transplant"}
                </button>
              ))}
            </div>
          )}

          {/* Inpaint hint */}
          {engine === "vampnet" && vampnetMode === "inpaint" && (
            <p className="text-[9px] text-gray-600">
              {(inpaintStart ?? 0) > 0 || (inpaintEnd ?? 0) > 0
                ? `Region: ${formatTime(inpaintStart ?? 0)} — ${formatTime(inpaintEnd ?? 0)}. Only this section will be regenerated.`
                : "Drag on the waveform to select a region to regenerate."}
            </p>
          )}

          {/* Transplant: donor audio drop zone + codebook presets */}
          {engine === "vampnet" && vampnetMode === "transplant" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-gray-500">Donor Audio</p>
                {donorFile && (
                  <button
                    onClick={() => onDonorFileChange(null)}
                    className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
              {donorFile ? (
                <div className="border border-white/[0.08] bg-white/[0.02] px-3 py-2 flex items-center justify-between">
                  <p className="text-[10px] text-gray-400 truncate max-w-[180px]">{donorFile.name}</p>
                  <p className="text-[10px] text-gray-600 shrink-0 ml-2">{formatBytes(donorFile.size)}</p>
                </div>
              ) : (
                <ReferenceDropZone label="Drop donor audio" onFile={(f) => {
                  if (!f.type.startsWith("audio/")) {
                    onToast("Audio files only.", "error");
                    return;
                  }
                  if (f.size > MAX_FILE_BYTES) {
                    onToast("File exceeds 100 MB limit.", "error");
                    return;
                  }
                  const previewUrl = URL.createObjectURL(f);
                  onDonorFileChange({ file: f, name: f.name, size: f.size, previewUrl });
                }} />
              )}
              <div>
                <p className="text-[11px] text-gray-500 mb-1.5">Take From Donor</p>
                <div className="flex gap-1.5">
                  {([
                    { id: "low" as const, label: "Rhythm", desc: "Donor's rhythm + your texture" },
                    { id: "mid" as const, label: "Tone", desc: "Donor's tone + your structure" },
                    { id: "high" as const, label: "Texture", desc: "Donor's texture + your rhythm" },
                  ]).map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => onTransplantCodebooksChange(preset.id)}
                      title={preset.desc}
                      className={`flex-1 px-2 py-1 text-[11px] border transition-colors duration-150 ${
                        transplantCodebooks === preset.id
                          ? "border-white/20 bg-white/[0.06] text-white"
                          : "border-white/[0.04] text-gray-600 hover:text-gray-400"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[9px] text-gray-600">Mix codebook layers from two audio sources.</p>
            </div>
          )}

          {/* Engine-specific controls */}
          {engine === "stable-audio" ? (
            <Slider
              label="Depth"
              value={strength}
              onChange={onStrengthChange}
              min={0.1}
              max={1.0}
              step={0.05}
              format={(v) => v.toFixed(2)}
              lo="Subtle"
              hi="Deep"
            />
          ) : engine === "magnet" ? (
            <>
              <Slider
                label="Temperature"
                value={magnetTemperature}
                onChange={onMagnetTemperatureChange}
                min={1.0}
                max={10.0}
                step={0.5}
                format={(v) => v.toFixed(1)}
                lo="Focused"
                hi="Wild"
              />
              <Slider
                label="Top-K"
                value={magnetTopK}
                onChange={onMagnetTopKChange}
                min={50}
                max={500}
                step={25}
                format={(v) => String(v)}
                lo="Narrow"
                hi="Diverse"
              />
              <p className="text-[10px] text-gray-600">
                Generates new audio from text prompt. Your input sets the mood.
              </p>
            </>
          ) : (
            <>
              {/* ── VampNet Presets ── */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[11px] text-gray-500">Preset</p>
                </div>
                <div className="flex gap-1.5">
                  {([
                    { label: "Texture", pp: 3, ucm: 5, temp: 0.8, desc: "Recognizable but noticeably different" },
                    { label: "Sculpt", pp: 4, ucm: 2, temp: 1.0, desc: "Creative transformation — clearly different" },
                    { label: "Radical", pp: 3, ucm: 1, temp: 1.3, desc: "Aggressive reimagining" },
                  ] as const).map((preset) => {
                    const active = periodicPrompt === preset.pp && upperCodebookMask === preset.ucm && Math.abs(temperature - preset.temp) < 0.05;
                    return (
                      <button
                        key={preset.label}
                        onClick={() => {
                          onPeriodicPromptChange(preset.pp);
                          onUpperCodebookMaskChange(preset.ucm);
                          onTemperatureChange(preset.temp);
                        }}
                        title={preset.desc}
                        className={`flex-1 px-2 py-1 text-[11px] border transition-colors duration-150 ${
                          active
                            ? "border-white/20 bg-white/[0.06] text-white"
                            : "border-white/[0.04] text-gray-600 hover:text-gray-400"
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Slider
                label="Depth"
                value={upperCodebookMask}
                onChange={onUpperCodebookMaskChange}
                min={1}
                max={7}
                step={1}
                format={(v) => (v <= 2 ? "Deep" : v <= 4 ? "Mid" : "Surface")}
                lo="Deep"
                hi="Surface"
              />
              <Slider
                label="Preservation"
                value={periodicPrompt}
                onChange={onPeriodicPromptChange}
                min={1}
                max={16}
                step={1}
                format={(v) => String(v)}
                lo="Faithful"
                hi="Radical"
              />
              <Slider
                label="Temperature"
                value={temperature}
                onChange={onTemperatureChange}
                min={0.3}
                max={2.0}
                step={0.1}
                format={(v) => v.toFixed(1)}
                lo="Precise"
                hi="Volatile"
              />
              <Slider
                label="Rhythm Lock"
                value={onsetMaskWidth}
                onChange={onOnsetMaskWidthChange}
                min={0}
                max={5}
                step={1}
                format={(v) => (v === 0 ? "Off" : String(v))}
                lo="Off"
                hi="Locked"
              />
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[11px] text-gray-500">Passes</p>
                  <p className="text-[11px] text-gray-400">{feedbackSteps}x</p>
                </div>
                <div className="flex gap-1.5">
                  {[1, 2, 3].map((n) => (
                    <button
                      key={n}
                      onClick={() => onFeedbackStepsChange(n)}
                      className={`flex-1 px-2 py-1 text-[11px] border transition-colors duration-150 ${
                        feedbackSteps === n
                          ? "border-white/20 bg-white/[0.06] text-white"
                          : "border-white/[0.04] text-gray-600 hover:text-gray-400"
                      }`}
                    >
                      {n}x
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[11px] text-gray-500">Stereo</p>
                  <p className="text-[11px] text-gray-400">
                    {stereoMode === "mid-side" ? "M/S" : stereoMode === "independent" ? "L/R" : "Widen"}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {(["mid-side", "independent", "mono-widen"] as StereoMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => onStereoModeChange(mode)}
                      className={`flex-1 px-2 py-1 text-[11px] border transition-colors duration-150 ${
                        stereoMode === mode
                          ? "border-white/20 bg-white/[0.06] text-white"
                          : "border-white/[0.04] text-gray-600 hover:text-gray-400"
                      }`}
                    >
                      {mode === "mid-side" ? "M/S" : mode === "independent" ? "L/R" : "Widen"}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Post-Processing ── */}
              <div className="border-t border-white/[0.06] pt-3 mt-1">
                <Slider
                  label="Dry / Wet"
                  value={dryWet}
                  onChange={onDryWetChange}
                  min={0}
                  max={100}
                  step={5}
                  format={(v) => `${v}%`}
                  lo="Original"
                  hi="Sculpted"
                />
              </div>

              {/* ── Pre-Processing ── */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[11px] text-gray-500">Pre-Process</p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => {
                      onHpssChange(!hpssEnabled);
                      if (!hpssEnabled) onDemucsStemsChange([]);
                    }}
                    className={`flex-1 px-2 py-1 text-[11px] border transition-colors duration-150 ${
                      hpssEnabled
                        ? "border-white/20 bg-white/[0.06] text-white"
                        : "border-white/[0.04] text-gray-600 hover:text-gray-400"
                    }`}
                  >
                    HPSS
                  </button>
                  <button
                    onClick={() => {
                      if (demucsStems.length > 0) {
                        onDemucsStemsChange([]);
                      } else {
                        onDemucsStemsChange(["vocals", "other"]);
                        onHpssChange(false);
                      }
                    }}
                    className={`flex-1 px-2 py-1 text-[11px] border transition-colors duration-150 ${
                      demucsStems.length > 0
                        ? "border-white/20 bg-white/[0.06] text-white"
                        : "border-white/[0.04] text-gray-600 hover:text-gray-400"
                    }`}
                  >
                    Stems
                  </button>
                </div>
                {demucsStems.length > 0 && (
                  <div className="flex gap-1 mt-1.5">
                    {["vocals", "drums", "bass", "other"].map((stem) => (
                      <button
                        key={stem}
                        onClick={() => {
                          const next = demucsStems.includes(stem)
                            ? demucsStems.filter((s) => s !== stem)
                            : [...demucsStems, stem];
                          onDemucsStemsChange(next);
                        }}
                        className={`px-1.5 py-0.5 text-[10px] border transition-colors duration-150 ${
                          demucsStems.includes(stem)
                            ? "border-white/20 bg-white/[0.06] text-white"
                            : "border-white/[0.04] text-gray-600 hover:text-gray-400"
                        }`}
                      >
                        {stem}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Toggles ── */}
              <div className="flex gap-1.5">
                <button
                  onClick={() => onSpectralMatchChange(!spectralMatch)}
                  className={`flex-1 px-2 py-1 text-[11px] border transition-colors duration-150 ${
                    spectralMatch
                      ? "border-white/20 bg-white/[0.06] text-white"
                      : "border-white/[0.04] text-gray-600 hover:text-gray-400"
                  }`}
                  title="Match output EQ curve to original"
                >
                  EQ Match
                </button>
                <button
                  onClick={() => onCompressChange(!compressEnabled)}
                  className={`flex-1 px-2 py-1 text-[11px] border transition-colors duration-150 ${
                    compressEnabled
                      ? "border-white/20 bg-white/[0.06] text-white"
                      : "border-white/[0.04] text-gray-600 hover:text-gray-400"
                  }`}
                  title="Light compression + limiting"
                >
                  Compress
                </button>
                <button
                  onClick={() => onNormalizeLoudnessChange(!normalizeLoudness)}
                  className={`flex-1 px-2 py-1 text-[11px] border transition-colors duration-150 ${
                    normalizeLoudness
                      ? "border-white/20 bg-white/[0.06] text-white"
                      : "border-white/[0.04] text-gray-600 hover:text-gray-400"
                  }`}
                >
                  Normalize
                </button>
                <button
                  onClick={() => onEnhanceChange(!enhanceEnabled)}
                  className={`flex-1 px-2 py-1 text-[11px] border transition-colors duration-150 ${
                    enhanceEnabled
                      ? "border-white/20 bg-white/[0.06] text-white"
                      : "border-white/[0.04] text-gray-600 hover:text-gray-400"
                  }`}
                  title="AudioSR: adds ~30s, improves high-frequency detail"
                >
                  Enhance
                </button>
              </div>
            </>
          )}

          {/* ── Reference Master ── */}
          <div className="border-t border-white/[0.06] pt-3 mt-1">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[11px] text-gray-500">Reference Master</p>
              {referenceFile && (
                <button
                  onClick={() => onReferenceFileChange(null)}
                  className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            {referenceFile ? (
              <div className="border border-white/[0.08] bg-white/[0.02] px-3 py-2 flex items-center justify-between">
                <p className="text-[10px] text-gray-400 truncate max-w-[180px]">{referenceFile.name}</p>
                <p className="text-[10px] text-gray-600 shrink-0 ml-2">{formatBytes(referenceFile.size)}</p>
              </div>
            ) : (
              <ReferenceDropZone onFile={(f) => {
                if (!f.type.startsWith("audio/")) {
                  onToast("Audio files only.", "error");
                  return;
                }
                if (f.size > MAX_FILE_BYTES) {
                  onToast("File exceeds 100 MB limit.", "error");
                  return;
                }
                const previewUrl = URL.createObjectURL(f);
                onReferenceFileChange({ file: f, name: f.name, size: f.size, previewUrl });
              }} />
            )}
            <p className="text-[9px] text-gray-600 mt-1">Match EQ and loudness to a reference track.</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Reference drop zone ── */

function ReferenceDropZone({ onFile, label = "Drop reference track" }: { onFile: (f: File) => void; label?: string }) {
  const [over, setOver] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div
      className={`border border-dashed px-3 py-2 cursor-pointer transition-colors ${
        over ? "border-white/20 bg-white/[0.02]" : "border-white/[0.06] hover:border-white/[0.12]"
      }`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={(e) => { e.preventDefault(); setOver(false); }}
      onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
      onClick={() => ref.current?.click()}
    >
      <input ref={ref} type="file" accept="audio/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
      <p className={`text-[10px] ${over ? "text-white" : "text-gray-500"}`}>{label}</p>
    </div>
  );
}

/* ── Waveform player ── */

function formatTime(s: number) {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function extractPeaks(buffer: AudioBuffer, count: number): number[] {
  const raw = buffer.getChannelData(0);
  const block = Math.floor(raw.length / count);
  const peaks: number[] = [];
  for (let i = 0; i < count; i++) {
    let sum = 0;
    const start = i * block;
    for (let j = 0; j < block; j++) {
      sum += raw[start + j] ** 2;
    }
    peaks.push(Math.sqrt(sum / block));
  }
  const max = Math.max(...peaks, 0.001);
  return peaks.map((p) => p / max);
}

function drawWaveform(
  canvas: HTMLCanvasElement,
  peaks: number[],
  progress: number,
  inpaintRegion?: { start: number; end: number },
) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  const ctx = canvas.getContext("2d");
  if (!ctx || peaks.length === 0) return;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;
  const centerY = h / 2;
  const maxAmp = h * 0.38;
  const step = w / peaks.length;

  // Build path once — top contour then mirrored bottom
  const buildPath = () => {
    ctx.beginPath();
    for (let i = 0; i < peaks.length; i++) {
      const x = i * step;
      const y = centerY - peaks[i] * maxAmp;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.lineTo(w, centerY);
    for (let i = peaks.length - 1; i >= 0; i--) {
      const x = i * step;
      const y = centerY + peaks[i] * maxAmp;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
  };

  // Unplayed fill
  buildPath();
  ctx.fillStyle = "rgba(255, 255, 255, 0.10)";
  ctx.fill();

  // Played fill (clipped)
  if (progress > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w * progress, h);
    ctx.clip();
    buildPath();
    ctx.fillStyle = "rgba(255, 255, 255, 0.50)";
    ctx.fill();
    ctx.restore();
  }

  // Playhead
  if (progress > 0 && progress < 1) {
    const px = w * progress;
    ctx.beginPath();
    ctx.moveTo(px, 2);
    ctx.lineTo(px, h - 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Inpaint region overlay
  if (inpaintRegion && inpaintRegion.start < inpaintRegion.end) {
    const x1 = w * inpaintRegion.start;
    const x2 = w * inpaintRegion.end;
    ctx.fillStyle = "rgba(102, 2, 60, 0.25)";
    ctx.fillRect(x1, 0, x2 - x1, h);
    // Edge lines
    ctx.strokeStyle = "rgba(180, 30, 100, 0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1, 0); ctx.lineTo(x1, h);
    ctx.moveTo(x2, 0); ctx.lineTo(x2, h);
    ctx.stroke();
  }
}

function WaveformPlayer({
  src,
  name,
  size,
  inpaintMode,
  inpaintStart,
  inpaintEnd,
  duration: externalDuration,
  onInpaintRangeChange,
}: {
  src: string;
  name: string;
  size: number;
  inpaintMode?: boolean;
  inpaintStart?: number;
  inpaintEnd?: number;
  duration?: number;
  onInpaintRangeChange?: (start: number, end: number) => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const peaksRef = useRef<number[]>([]);
  const rafRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [decoded, setDecoded] = useState(false);

  // Inpaint drag state
  const dragRef = useRef<{ active: boolean; startX: number }>({ active: false, startX: 0 });

  // Compute inpaint region as fraction (0-1) for rendering
  const activeDuration = duration || externalDuration || 1;
  const inpaintRegion = (inpaintMode && ((inpaintStart ?? 0) > 0 || (inpaintEnd ?? 0) > 0))
    ? { start: (inpaintStart ?? 0) / activeDuration, end: (inpaintEnd ?? 0) / activeDuration }
    : undefined;

  // Decode audio → extract peaks
  useEffect(() => {
    let cancelled = false;
    peaksRef.current = [];
    setDecoded(false);
    setCurrentTime(0);
    setIsPlaying(false);

    const actx = new AudioContext();
    fetch(src)
      .then((r) => r.arrayBuffer())
      .then((buf) => actx.decodeAudioData(buf))
      .then((buffer) => {
        if (cancelled) return;
        peaksRef.current = extractPeaks(buffer, 256);
        setDecoded(true);
        if (canvasRef.current) {
          drawWaveform(canvasRef.current, peaksRef.current, 0, inpaintRegion);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      actx.close();
    };
  }, [src]); // eslint-disable-line react-hooks/exhaustive-deps

  // Animation loop — smooth playhead
  useEffect(() => {
    const tick = () => {
      const audio = audioRef.current;
      const canvas = canvasRef.current;
      if (audio && canvas && peaksRef.current.length > 0) {
        const t = audio.currentTime;
        const d = audio.duration || 0;
        setCurrentTime(t);
        drawWaveform(canvas, peaksRef.current, d > 0 ? t / d : 0, inpaintRegion);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    if (isPlaying) {
      rafRef.current = requestAnimationFrame(tick);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying]);

  // Redraw static waveform when not playing (e.g. after seek or on mount)
  useEffect(() => {
    if (!isPlaying && decoded && canvasRef.current) {
      const d = duration || 1;
      drawWaveform(canvasRef.current, peaksRef.current, currentTime / d, inpaintRegion);
    }
  }, [isPlaying, decoded, currentTime, duration, inpaintRegion?.start, inpaintRegion?.end]); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play();
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  const seek = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (inpaintMode) return; // Inpaint mode uses drag, not click-to-seek
    const audio = audioRef.current;
    const canvas = canvasRef.current;
    if (!audio || !canvas || !duration) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
    setCurrentTime(audio.currentTime);
  };

  // Inpaint drag-to-select handlers
  const onCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!inpaintMode || !onInpaintRangeChange) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    dragRef.current = { active: true, startX: ratio };
    onInpaintRangeChange(ratio * activeDuration, ratio * activeDuration);
  };

  const onCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragRef.current.active || !onInpaintRangeChange) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const startRatio = dragRef.current.startX;
    const s = Math.min(startRatio, ratio) * activeDuration;
    const end = Math.max(startRatio, ratio) * activeDuration;
    onInpaintRangeChange(s, end);
  };

  const onCanvasMouseUp = () => {
    dragRef.current.active = false;
  };

  return (
    <div className="border border-white/[0.08] bg-white/[0.02] p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-white truncate max-w-[200px]">{name}</p>
        <div className="flex items-center gap-2">
          {inpaintMode && (inpaintStart ?? 0) > 0 && (inpaintEnd ?? 0) > 0 && (
            <p className="text-[10px] text-pink-400/70">
              {formatTime(inpaintStart ?? 0)}-{formatTime(inpaintEnd ?? 0)}
            </p>
          )}
          <p className="text-[10px] text-gray-500 shrink-0">{formatBytes(size)}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Play / Pause */}
        <button
          onClick={togglePlay}
          className="shrink-0 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <rect x="1" y="1" width="3" height="8" rx="0.5" />
              <rect x="6" y="1" width="3" height="8" rx="0.5" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <path d="M2 1l7 4-7 4V1z" />
            </svg>
          )}
        </button>

        {/* Waveform canvas */}
        <canvas
          ref={canvasRef}
          onClick={seek}
          onMouseDown={onCanvasMouseDown}
          onMouseMove={onCanvasMouseMove}
          onMouseUp={onCanvasMouseUp}
          onMouseLeave={onCanvasMouseUp}
          className={`flex-1 h-8 ${inpaintMode ? "cursor-crosshair" : "cursor-pointer"}`}
        />

        {/* Time */}
        <span className="shrink-0 text-[10px] text-gray-500 tabular-nums w-[70px] text-right">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      {/* Hidden audio element for actual playback */}
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={() => {
          if (audioRef.current) setDuration(audioRef.current.duration);
        }}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
          if (canvasRef.current) {
            drawWaveform(canvasRef.current, peaksRef.current, 0, inpaintRegion);
          }
        }}
      />
    </div>
  );
}

/* ── Compact slider ── */
function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  format,
  lo,
  hi,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  lo: string;
  hi: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[11px] text-gray-500">{label}</p>
        <p className="text-[11px] text-gray-400">{format(value)}</p>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-px appearance-none bg-white/[0.08] cursor-pointer accent-white"
      />
      <div className="flex justify-between mt-0.5">
        <span className="text-[9px] text-gray-600">{lo}</span>
        <span className="text-[9px] text-gray-600">{hi}</span>
      </div>
    </div>
  );
}
