"use client";

import { useState } from "react";


import { cn } from "@/lib/utils";
import type { StemType } from "@/lib/o8/types";

interface StemConfig {
  type: StemType;
  enabled: boolean;
  volume: number;
}

interface StemExportPanelProps {
  soundId: string;
  soundName: string;
  audioUrl: string | null;
  onExport?: (config: { stems: StemConfig[]; format: string; gameState?: string }) => void;
  className?: string;
}

const STEM_TYPES: { type: StemType; label: string; description: string }[] = [
  { type: 'drums', label: 'Drums', description: 'Percussion, beats, rhythmic elements' },
  { type: 'bass', label: 'Bass', description: 'Low frequency, bass lines' },
  { type: 'melody', label: 'Melody', description: 'Lead instruments, main themes' },
  { type: 'harmony', label: 'Harmony', description: 'Chords, pads, supporting elements' },
  { type: 'vocals', label: 'Vocals', description: 'Voice, vocal samples' },
  { type: 'atmosphere', label: 'Atmosphere', description: 'Ambient, drones, textures' },
  { type: 'fx', label: 'FX', description: 'Sound effects, risers, impacts' },
];

const GAME_STATES = [
  'explore',
  'combat',
  'stealth',
  'victory',
  'defeat',
  'tension',
  'menu',
];

const BURN_THE_SQUARE_URL = process.env.NEXT_PUBLIC_BTS_URL || 'http://localhost:3002';

// Generate deep link for Burn the Square
function generateDeepLink(params: {
  soundId: string;
  soundName: string;
  stems: StemType[];
  gameState: string;
  format: string;
}): string {
  const searchParams = new URLSearchParams({
    source: 'swanblade',
    soundId: params.soundId,
    name: params.soundName,
    stems: params.stems.join(','),
    state: params.gameState,
    format: params.format,
  });
  return `${BURN_THE_SQUARE_URL}/import?${searchParams.toString()}`;
}

export function StemExportPanel({
  soundId,
  soundName,
  audioUrl,
  onExport,
  className,
}: StemExportPanelProps) {
  const [stems, setStems] = useState<StemConfig[]>(
    STEM_TYPES.map((s) => ({ type: s.type, enabled: true, volume: 1 }))
  );
  const [format, setFormat] = useState<'wav' | 'mp3' | 'ogg'>('wav');
  const [targetState, setTargetState] = useState<string>('explore');
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);

  const toggleStem = (type: StemType) => {
    setStems((prev) =>
      prev.map((s) => (s.type === type ? { ...s, enabled: !s.enabled } : s))
    );
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      // In production, this would call an API to separate stems
      // For now, we simulate the export
      await new Promise((resolve) => setTimeout(resolve, 2000));

      onExport?.({
        stems: stems.filter((s) => s.enabled),
        format,
        gameState: targetState,
      });

      setExported(true);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setExporting(false);
    }
  };

  const enabledCount = stems.filter((s) => s.enabled).length;

  return (
    <div className={cn("border border-[#1a1a1a] bg-black", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a1a]">
        <div>
          <p className="text-sm text-gray-400">
            Export to Burn the Square
          </p>
          <p className="text-body-sm text-white font-medium">{soundName}</p>
        </div>
        <span className="text-[10px] text-[#66023C]">
          {enabledCount} stems
        </span>
      </div>

      {/* Stem Selection */}
      <div className="p-4 border-b border-[#1a1a1a]">
        <p className="text-sm text-gray-400 mb-3">
          Stem Layers
        </p>
        <div className="grid grid-cols-2 gap-2">
          {STEM_TYPES.map((stemType) => {
            const config = stems.find((s) => s.type === stemType.type);
            const isEnabled = config?.enabled ?? false;

            return (
              <button
                key={stemType.type}
                onClick={() => toggleStem(stemType.type)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 border transition-colors text-left",
                  isEnabled
                    ? "border-[#66023C] bg-[#66023C]/10 text-white"
                    : "border-[#1a1a1a] text-gray-500 hover:border-white"
                )}
              >
                <div
                  className={cn(
                    "w-3 h-3 border",
                    isEnabled ? "bg-[#66023C] border-[#66023C]" : "border-[#1a1a1a]"
                  )}
                />
                <p className="text-[11px]">{stemType.label}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Game State Target */}
      <div className="p-4 border-b border-[#1a1a1a]">
        <p className="text-sm text-gray-400 mb-3">
          Primary Game State
        </p>
        <div className="flex flex-wrap gap-2">
          {GAME_STATES.map((state) => (
            <button
              key={state}
              onClick={() => setTargetState(state)}
              className={cn(
                "px-3 py-1.5 border text-sm transition-colors",
                targetState === state
                  ? "border-[#66023C] bg-[#66023C] text-white"
                  : "border-[#1a1a1a] text-gray-500 hover:border-white"
              )}
            >
              {state}
            </button>
          ))}
        </div>
      </div>

      {/* Format Selection */}
      <div className="p-4 border-b border-[#1a1a1a]">
        <p className="text-sm text-gray-400 mb-3">
          Format
        </p>
        <div className="flex gap-2">
          {(['wav', 'mp3', 'ogg'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={cn(
                "px-4 py-2 border text-sm transition-colors",
                format === f
                  ? "border-white bg-white text-black"
                  : "border-[#1a1a1a] text-gray-500 hover:border-white"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Export Button */}
      <div className="p-4">
        {exported ? (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 py-3 bg-[#66023C]/10 text-[#66023C]">
              <svg width="20" height="20" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="none" />
                <path d="M8 12l2.5 2.5L16 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className="text-body font-medium">
                Exported to Burn the Square
              </span>
            </div>
            <a
              href={generateDeepLink({
                soundId,
                soundName,
                stems: stems.filter((s) => s.enabled).map((s) => s.type),
                gameState: targetState,
                format,
              })}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2 border border-[#66023C] text-[#66023C] hover:bg-[#66023C] hover:text-white transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M7 17L17 7M17 7H7M17 7v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-body-sm font-medium">Open in Burn the Square</span>
            </a>
          </div>
        ) : (
          <button
            onClick={handleExport}
            disabled={!audioUrl || exporting || enabledCount === 0}
            className="w-full py-2.5 bg-[#66023C] hover:bg-[#520230] text-white text-[11px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {exporting ? "Separating..." : `Export ${enabledCount} stems`}
          </button>
        )}

        <p className="text-body-sm text-gray-500 text-center mt-2">
          Stems will be available in your Burn the Square project
        </p>
      </div>
    </div>
  );
}
