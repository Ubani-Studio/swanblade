"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { GenerationPreset, ChainRecipe, ChainStep } from "@/hooks/usePresets";

interface PresetsPanelProps {
  presets: GenerationPreset[];
  onSelect: (preset: GenerationPreset) => void;
  onSave: (name: string) => void;
  onDelete: (id: string) => void;
  chains: ChainRecipe[];
  onSaveChain: (name: string, steps: ChainStep[]) => void;
  onDeleteChain: (id: string) => void;
  onRunChain: (chain: ChainRecipe) => void;
  className?: string;
}

export function PresetsPanel({
  presets,
  onSelect,
  onSave,
  onDelete,
  chains,
  onSaveChain,
  onDeleteChain,
  onRunChain,
  className,
}: PresetsPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newPresetName, setNewPresetName] = useState("");
  const [tab, setTab] = useState<"presets" | "chains">("presets");
  const [showChainBuilder, setShowChainBuilder] = useState(false);
  const [chainName, setChainName] = useState("");
  const [chainSteps, setChainSteps] = useState<ChainStep[]>([]);

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
          {/* Tabs */}
          <div className="flex border-b border-[#1a1a1a]">
            {(["presets", "chains"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 px-3 py-2 text-body-sm transition-colors ${
                  tab === t ? "text-white border-b border-white" : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {t === "presets" ? `Presets (${presets.length})` : `Chains (${chains.length})`}
              </button>
            ))}
          </div>

          {tab === "presets" ? (
            <>
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
                          <div className="flex gap-2 mt-1 flex-wrap">
                            <span className="text-[10px] px-1.5 py-0.5 bg-black border border-[#1a1a1a] text-gray-500">
                              {preset.lengthSeconds}s
                            </span>
                            {preset.engine && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-black border border-[#1a1a1a] text-gray-500">
                                {preset.engine === "stable-audio" ? "Diffusion" : preset.engine === "vampnet" ? "VampNet" : "MAGNeT"}
                              </span>
                            )}
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
            </>
          ) : (
            <>
              {/* Chain Builder */}
              {showChainBuilder ? (
                <div className="p-4 bg-black border-b border-[#1a1a1a] space-y-3">
                  <input
                    type="text"
                    value={chainName}
                    onChange={(e) => setChainName(e.target.value)}
                    placeholder="Chain name..."
                    className="w-full px-3 py-2 border border-[#1a1a1a] bg-black text-body text-white placeholder:text-gray-500 focus:outline-none focus:border-white"
                    autoFocus
                  />
                  {/* Steps */}
                  <div className="space-y-1">
                    {chainSteps.map((step, i) => {
                      const p = presets.find((pr) => pr.id === step.presetId);
                      return (
                        <div key={i} className="flex items-center gap-2 px-2 py-1.5 border border-[#1a1a1a]">
                          <span className="text-[10px] text-gray-600 w-4">{i + 1}.</span>
                          <span className="text-[11px] text-white flex-1 truncate">{p?.name ?? "?"}</span>
                          <button
                            onClick={() => setChainSteps((prev) => prev.filter((_, j) => j !== i))}
                            className="text-[10px] text-gray-500 hover:text-red-400"
                          >&times;</button>
                        </div>
                      );
                    })}
                    {chainSteps.length === 0 && (
                      <p className="text-[10px] text-gray-600 py-1">No steps yet. Add presets below.</p>
                    )}
                  </div>
                  {/* Add step from presets */}
                  <div className="max-h-32 overflow-y-auto border border-[#1a1a1a]">
                    {presets.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setChainSteps((prev) => [...prev, { presetId: p.id }])}
                        className="w-full text-left px-3 py-1.5 text-[11px] text-gray-400 hover:text-white hover:bg-white/[0.03] border-b border-[#1a1a1a] last:border-b-0"
                      >
                        + {p.name}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        if (chainName.trim() && chainSteps.length >= 2) {
                          onSaveChain(chainName.trim(), chainSteps);
                          setChainName("");
                          setChainSteps([]);
                          setShowChainBuilder(false);
                        }
                      }}
                      disabled={!chainName.trim() || chainSteps.length < 2}
                      className="bg-[#66023C] hover:bg-[#520230] text-white border-0"
                    >
                      Save Chain
                    </Button>
                    <Button
                      onClick={() => { setShowChainBuilder(false); setChainSteps([]); setChainName(""); }}
                      variant="ghost"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-3 border-b border-[#1a1a1a]">
                  <button
                    onClick={() => setShowChainBuilder(true)}
                    className="w-full px-3 py-2 text-body-sm border border-[#1a1a1a] hover:border-[#66023C] hover:text-[#66023C] transition-colors"
                  >
                    + New Chain
                  </button>
                </div>
              )}

              {/* Chains List */}
              {chains.length === 0 && !showChainBuilder ? (
                <div className="p-4 text-center">
                  <p className="text-body-sm text-gray-500">No chains yet</p>
                  <p className="text-body-sm text-gray-500/60 mt-1">
                    Create a chain to replay multi-step pipelines
                  </p>
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto">
                  {chains.map((chain) => (
                    <div
                      key={chain.id}
                      className="px-4 py-3 border-b border-[#1a1a1a] last:border-b-0 hover:bg-black transition-colors group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-body-sm font-medium text-white">{chain.name}</p>
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {chain.steps.map((step, i) => {
                              const p = presets.find((pr) => pr.id === step.presetId);
                              return (
                                <span key={i} className="text-[10px] px-1.5 py-0.5 bg-black border border-[#1a1a1a] text-gray-500">
                                  {i + 1}. {p?.name ?? "?"}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <button
                            onClick={() => onRunChain(chain)}
                            className="px-2 py-1 text-[10px] border border-white/10 text-white hover:bg-white hover:text-black transition-colors"
                            title="Run chain"
                          >
                            Run
                          </button>
                          <button
                            onClick={() => onDeleteChain(chain.id)}
                            className="p-1.5 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                            title="Delete chain"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                              <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
