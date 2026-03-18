"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { GenerationPreset } from "@/hooks/usePresets";

interface PresetsPanelProps {
  presets: GenerationPreset[];
  onSelect: (preset: GenerationPreset) => void;
  onSave: (name: string) => void;
  onDelete: (id: string) => void;
  className?: string;
}

export function PresetsPanel({
  presets,
  onSelect,
  onSave,
  onDelete,
  className,
}: PresetsPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");

  const handleSave = () => {
    if (!newPresetName.trim()) return;
    onSave(newPresetName.trim());
    setNewPresetName("");
    setShowSaveDialog(false);
  };

  return (
    <div className={cn("border border-[#1a1a1a]/30", className)}>
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-black transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-[#66023C]">
            <rect x="3" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1.5" />
            <rect x="14" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1.5" />
            <rect x="3" y="14" width="7" height="7" stroke="currentColor" strokeWidth="1.5" />
            <rect x="14" y="14" width="7" height="7" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <div>
            <p className="text-body-sm text-gray-500">Presets</p>
            <p className="text-body-sm text-white">{presets.length} saved</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowSaveDialog(true);
              setExpanded(true);
            }}
            className="px-2 py-1 text-body-sm border border-[#1a1a1a] hover:border-[#66023C] hover:text-[#66023C] transition-colors"
          >
            + Save
          </button>
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
      </div>

      {expanded && (
        <div className="border-t border-[#1a1a1a]">
          {/* Save Dialog */}
          {showSaveDialog && (
            <div className="p-4 bg-black border-b border-[#1a1a1a]">
              <p className="text-body-sm text-gray-500 mb-2">
                Save Current Settings
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                  placeholder="Preset name..."
                  className="flex-1 px-3 py-2 border border-[#1a1a1a] bg-black text-body text-white placeholder:text-gray-500 focus:outline-none focus:border-white"
                  autoFocus
                />
                <Button
                  onClick={handleSave}
                  disabled={!newPresetName.trim()}
                  className="bg-[#66023C] hover:bg-[#520230] text-white border-0"
                >
                  Save
                </Button>
                <Button
                  onClick={() => {
                    setShowSaveDialog(false);
                    setNewPresetName("");
                  }}
                  variant="ghost"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Presets List */}
          {presets.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-body-sm text-gray-500">No presets saved yet</p>
              <p className="text-body-sm text-gray-500/60 mt-1">
                Configure your settings and save them as a preset
              </p>
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  className="px-4 py-3 border-b border-[#1a1a1a] last:border-b-0 hover:bg-black transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => onSelect(preset)}
                      className="flex-1 text-left"
                    >
                      <p className="text-body-sm font-medium text-white">
                        {preset.name}
                      </p>
                      <p className="text-body-sm text-gray-500 truncate">
                        {preset.prompt.slice(0, 40)}...
                      </p>
                      <div className="flex gap-2 mt-1">
                        <span className="text-[10px] px-1.5 py-0.5 bg-black border border-[#1a1a1a] text-gray-500">
                          {preset.lengthSeconds}s
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-black border border-[#1a1a1a] text-gray-500">
                          {preset.provider}
                        </span>
                        {preset.gameState && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-[#66023C]/10 border border-[#66023C]/20 text-[#66023C]">
                            {preset.gameState}
                          </span>
                        )}
                      </div>
                    </button>
                    <button
                      onClick={() => onDelete(preset.id)}
                      className="p-1.5 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete preset"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
