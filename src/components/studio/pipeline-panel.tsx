"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { PipelineStage, PipelineStageKind } from "@/lib/pipeline/types";

type StageOption = {
  kind: PipelineStageKind;
  label: string;
  role: "base" | "transform" | "render" | "signature";
  description: string;
  ready: boolean;
};

const STAGE_OPTIONS: StageOption[] = [
  { kind: "ace-step", label: "ACE-Step 1.5", role: "base", description: "Musical foundation", ready: false },
  { kind: "audiox", label: "AudioX", role: "base", description: "Multimodal conditioning", ready: false },
  { kind: "stable-audio", label: "Stable Audio (LoRA)", role: "base", description: "Personalised base", ready: true },
  { kind: "vampnet", label: "VampNet", role: "base", description: "Legacy baseline", ready: true },
  { kind: "fugatto", label: "Fugatto", role: "transform", description: "Text-instructed mutation", ready: false },
  { kind: "musichifi", label: "MusicHiFi", role: "render", description: "HiFi stereo render", ready: false },
  { kind: "custom-dsp", label: "Custom DSP", role: "signature", description: "Signature polish layer", ready: true },
];

export interface PipelinePanelValue {
  stages: PipelineStage[];
  fugattoStrength: number;
  musichifiEnabled: boolean;
  customDspEnabled: boolean;
  baseStage: PipelineStageKind;
}

export function defaultPipelineValue(): PipelinePanelValue {
  return {
    stages: [
      { kind: "stable-audio" },
      { kind: "custom-dsp", parameters: { tilt: 0, saturate: 0.15, widen: 1.0, limiter: -1.0 } },
    ],
    fugattoStrength: 0.35,
    musichifiEnabled: false,
    customDspEnabled: true,
    baseStage: "stable-audio",
  };
}

function rebuildStages(value: PipelinePanelValue): PipelineStage[] {
  const stages: PipelineStage[] = [{ kind: value.baseStage }];
  if (value.fugattoStrength > 0) {
    stages.push({ kind: "fugatto", parameters: { strength: value.fugattoStrength }, optional: true });
  }
  if (value.musichifiEnabled) {
    stages.push({ kind: "musichifi", optional: true });
  }
  if (value.customDspEnabled) {
    stages.push({
      kind: "custom-dsp",
      parameters: { tilt: 0, saturate: 0.15, widen: 1.0, limiter: -1.0 },
    });
  }
  return stages;
}

interface Props {
  value: PipelinePanelValue;
  onChange: (v: PipelinePanelValue) => void;
  className?: string;
}

export function PipelinePanel({ value, onChange, className }: Props) {
  const stages = useMemo(() => rebuildStages(value), [value]);

  const setBase = (kind: PipelineStageKind) => {
    const next = { ...value, baseStage: kind };
    onChange({ ...next, stages: rebuildStages(next) });
  };

  const set = <K extends keyof PipelinePanelValue>(key: K, v: PipelinePanelValue[K]) => {
    const next = { ...value, [key]: v };
    onChange({ ...next, stages: rebuildStages(next) });
  };

  const baseOptions = STAGE_OPTIONS.filter((o) => o.role === "base");

  return (
    <div className={cn("bg-black border border-white/[0.06] p-5 space-y-5", className)}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] tracking-wide text-gray-400">Pipeline</p>
        <span className="text-[9px] text-gray-600">08 Protocol + C2PA auto-stamp</span>
      </div>

      {/* Base */}
      <div className="space-y-2">
        <p className="text-[10px] tracking-wide text-gray-500 uppercase">Base</p>
        <div className="flex flex-wrap gap-1.5">
          {baseOptions.map((opt) => (
            <button
              key={opt.kind}
              onClick={() => setBase(opt.kind)}
              className={cn(
                "px-2.5 py-1.5 text-[10px] border transition",
                value.baseStage === opt.kind
                  ? "border-white/30 text-white bg-white/[0.04]"
                  : "border-white/[0.06] text-gray-500 hover:text-gray-300",
                !opt.ready && "opacity-60",
              )}
              title={opt.ready ? opt.description : `${opt.description} (backend not wired)`}
            >
              {opt.label}
              {!opt.ready && <span className="ml-1 text-[9px] text-gray-600">soon</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Fugatto strength */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] tracking-wide text-gray-500 uppercase">Fugatto transform</p>
          <span className="text-[10px] text-gray-500">{Math.round(value.fugattoStrength * 100)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={value.fugattoStrength}
          onChange={(e) => set("fugattoStrength", parseFloat(e.target.value))}
          className="w-full accent-white/60"
        />
        <p className="text-[9px] text-gray-600">
          0 disables. Backend not wired yet — stamped as not_wired in manifest.
        </p>
      </div>

      {/* MusicHiFi + custom DSP */}
      <div className="space-y-2">
        <label className="flex items-center justify-between text-[10px] text-gray-400">
          <span>MusicHiFi render</span>
          <input
            type="checkbox"
            checked={value.musichifiEnabled}
            onChange={(e) => set("musichifiEnabled", e.target.checked)}
          />
        </label>
        <label className="flex items-center justify-between text-[10px] text-gray-400">
          <span>Custom DSP (signature)</span>
          <input
            type="checkbox"
            checked={value.customDspEnabled}
            onChange={(e) => set("customDspEnabled", e.target.checked)}
          />
        </label>
      </div>

      {/* Trace preview */}
      <div className="pt-3 border-t border-white/[0.04]">
        <p className="text-[10px] tracking-wide text-gray-500 uppercase mb-2">Compiled spec</p>
        <div className="space-y-1">
          {stages.map((s, i) => (
            <div key={i} className="flex items-center justify-between text-[10px] text-gray-500">
              <span>
                {i + 1}. <span className="text-gray-300">{s.kind}</span>
                {s.optional ? " (optional)" : ""}
              </span>
              <span className="text-gray-600 font-mono">
                {Object.keys(s.parameters ?? {}).length ? `${Object.keys(s.parameters ?? {}).length} params` : "—"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
