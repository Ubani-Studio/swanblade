"use client";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { WaveformPlaceholder } from "@/components/waveform-placeholder";
import { AudioPlayerControls } from "@/components/audio-player-controls";
import type { SoundGeneration } from "@/types";

interface SoundDetailPanelProps {
  sound: SoundGeneration | null;
  onRegenerate: (sound: SoundGeneration) => void;
  onVariation: (sound: SoundGeneration) => void;
  onDownload: (sound: SoundGeneration) => void;
  onCopyPreset: (sound: SoundGeneration) => void;
}

export function SoundDetailPanel({ sound, onRegenerate, onVariation, onDownload, onCopyPreset }: SoundDetailPanelProps) {
  if (!sound) {
    return (
      <div className="flex h-full flex-col items-center justify-center border border-dashed border-[#1a1a1a] bg-black p-12 text-center">
        <p className="font-display text-display-lg text-white">Swanblade is idle.</p>
        <p className="mt-3 max-w-md text-body text-gray-500">
          Describe a sound using the composer below to generate audio mockups.
        </p>
      </div>
    );
  }

  const disabled = sound.status !== "ready";

  return (
    <div className="flex h-full flex-col gap-6 border border-[#1a1a1a] bg-black p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-400">{sound.type}</p>
          <h2 className="mt-2 font-display text-display-lg text-white">{sound.name}</h2>
          <p className="mt-2 text-body text-gray-500">{sound.prompt}</p>
        </div>
        <StatusBadge status={sound.status} />
      </div>

      <WaveformPlaceholder isActive={sound.status === "ready"} isLoading={sound.status === "pending"} />

      <AudioPlayerControls audioUrl={sound.audioUrl} disabled={disabled} />

      {sound.status === "error" && (
        <div className="border border-red-400 bg-black px-4 py-3 text-body text-red-400">
          {sound.errorMessage ?? "Generation failed. Try again with a different prompt or parameters."}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <Button
          variant="secondary"
          onClick={() => onRegenerate(sound)}
          disabled={sound.status === "pending"}
          className="w-full"
        >
          Regenerate
        </Button>
        <Button
          variant="secondary"
          onClick={() => onVariation(sound)}
          disabled={sound.status === "pending"}
          className="w-full"
        >
          Make Variation
        </Button>
        <Button variant="ghost" onClick={() => onDownload(sound)} disabled={!sound.audioUrl} className="w-full">
          Download
        </Button>
        <Button variant="ghost" onClick={() => onCopyPreset(sound)} className="w-full">
          Copy Preset
        </Button>
      </div>
    </div>
  );
}
