"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { SoundGeneration } from "@/types";

interface BatchGenerationProps {
  prompt: string;
  onGenerate: (count: number, seeds: number[]) => Promise<SoundGeneration[]>;
  onSelect: (sound: SoundGeneration) => void;
  isGenerating: boolean;
  className?: string;
}

export function BatchGeneration({
  prompt,
  onGenerate,
  onSelect,
  isGenerating,
  className,
}: BatchGenerationProps) {
  const [expanded, setExpanded] = useState(false);
  const [count, setCount] = useState(4);
  const [results, setResults] = useState<SoundGeneration[]>([]);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || generating) return;

    setGenerating(true);
    setProgress(0);
    setResults([]);

    // Generate unique seeds
    const seeds = Array.from({ length: count }, () => Math.floor(Math.random() * 10000));

    try {
      const sounds = await onGenerate(count, seeds);
      setResults(sounds);
    } catch (error) {
      console.error("Batch generation failed:", error);
    } finally {
      setGenerating(false);
      setProgress(100);
    }
  }, [prompt, count, generating, onGenerate]);

  return (
    <div className={cn("border border-[#1a1a1a] bg-black", className)}>
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-black transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-[#66023C]">
            <rect x="3" y="3" width="6" height="6" stroke="currentColor" strokeWidth="1.5" />
            <rect x="15" y="3" width="6" height="6" stroke="currentColor" strokeWidth="1.5" />
            <rect x="3" y="15" width="6" height="6" stroke="currentColor" strokeWidth="1.5" />
            <rect x="15" y="15" width="6" height="6" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <div>
            <p className="text-sm text-gray-400">Batch Generate</p>
            <p className="text-body-sm text-white">Generate multiple variations</p>
          </div>
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          className={cn("text-gray-500 transition-transform", expanded && "rotate-180")}
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>

      {expanded && (
        <div className="border-t border-[#1a1a1a] p-4">
          {/* Count Selection */}
          <div className="mb-4">
            <p className="text-sm text-gray-400 mb-2">
              Number of Variations
            </p>
            <div className="flex gap-2">
              {[2, 4, 6, 8].map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  disabled={generating}
                  className={cn(
                    "px-4 py-2 border text-body-sm transition-colors",
                    count === n
                      ? "border-[#66023C] bg-[#66023C] text-white"
                      : "border-[#1a1a1a] text-gray-500 hover:border-white"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={!prompt.trim() || generating || isGenerating}
            className="w-full bg-[#66023C] hover:bg-[#520230] text-white border-0"
          >
            {generating ? (
              <span className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" className="animate-spin">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="40 20" fill="none" />
                </svg>
                Generating {count} variations...
              </span>
            ) : (
              `Generate ${count} Variations`
            )}
          </Button>

          {/* Progress */}
          {generating && (
            <div className="mt-4">
              <div className="h-1 bg-[#1a1a1a]">
                <div
                  className="h-full bg-[#66023C] transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Results Grid */}
          {results.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-gray-400 mb-2">
                Results
              </p>
              <div className="grid grid-cols-2 gap-2">
                {results.map((sound, index) => (
                  <button
                    key={sound.id}
                    onClick={() => onSelect(sound)}
                    className="p-3 border border-[#1a1a1a] hover:border-[#66023C] text-left transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-body-sm font-medium text-white">
                        Variation {index + 1}
                      </span>
                      <span
                        className={cn(
                          "text-[9px] uppercase tracking-wider px-1.5 py-0.5 border",
                          sound.status === "ready"
                            ? "bg-emerald-400/10 border-emerald-400/20 text-emerald-400"
                            : sound.status === "error"
                            ? "bg-red-400/10 border-red-400/20 text-red-400"
                            : "bg-black border-[#1a1a1a] text-gray-500"
                        )}
                      >
                        {sound.status}
                      </span>
                    </div>
                    {sound.status === "ready" && sound.audioUrl && (
                      <audio
                        src={sound.audioUrl}
                        controls
                        className="w-full h-8 mt-2"
                        controlsList="nodownload noplaybackrate"
                      />
                    )}
                    {sound.status === "error" && (
                      <p className="text-body-sm text-red-400 mt-1">
                        {sound.errorMessage || "Generation failed"}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
