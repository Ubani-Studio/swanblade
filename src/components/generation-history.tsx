"use client";

import { useState } from "react";
import { cn, secondsToTimecode } from "@/lib/utils";
import type { SoundGeneration } from "@/types";
import type { GenerationHistoryEntry } from "@/hooks/useGenerationHistory";

interface GenerationHistoryProps {
  history: GenerationHistoryEntry[];
  currentIndex: number;
  onSelect: (index: number) => void;
  onClear: () => void;
  className?: string;
}

export function GenerationHistory({
  history,
  currentIndex,
  onSelect,
  onClear,
  className,
}: GenerationHistoryProps) {
  const [expanded, setExpanded] = useState(false);

  if (history.length === 0) {
    return null;
  }

  return (
    <div className={cn("border border-[#1a1a1a] bg-black", className)}>
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-black transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-gray-500">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <div>
            <p className="text-sm font-medium text-gray-400">History</p>
            <p className="text-body-sm text-white">{history.length} generations</p>
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
        <div className="border-t border-[#1a1a1a]">
          <div className="max-h-64 overflow-y-auto">
            {history.map((entry, index) => (
              <div
                key={entry.id}
                onClick={() => onSelect(index)}
                className={cn(
                  "px-4 py-3 cursor-pointer border-b border-[#1a1a1a] last:border-b-0 transition-colors",
                  index === currentIndex
                    ? "bg-[#66023C]/10"
                    : "hover:bg-black"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-body-sm font-medium text-white truncate">
                      {entry.sound.name}
                    </p>
                    <p className="text-body-sm text-gray-500 truncate">
                      {entry.sound.prompt.slice(0, 50)}...
                    </p>
                  </div>
                  <div className="text-right ml-3">
                    <p className="text-body-sm text-gray-500">
                      {new Date(entry.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    {index === currentIndex && (
                      <span className="text-[9px] uppercase tracking-wider text-[#66023C]">
                        Current
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-[#1a1a1a]">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="text-body-sm text-gray-500 hover:text-red-400 transition-colors"
            >
              Clear History
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface HistoryControlsProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  className?: string;
}

export function HistoryControls({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  className,
}: HistoryControlsProps) {
  return (
    <div className={cn("flex gap-1", className)}>
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className="p-2 border border-[#1a1a1a] hover:border-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="Undo (previous generation)"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-gray-500">
          <path d="M3 10h10a5 5 0 0 1 0 10H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M7 6l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        onClick={onRedo}
        disabled={!canRedo}
        className="p-2 border border-[#1a1a1a] hover:border-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="Redo (next generation)"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-gray-500">
          <path d="M21 10H11a5 5 0 0 0 0 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M17 6l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
