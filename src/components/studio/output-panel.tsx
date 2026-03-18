"use client";

import { AudioPlayerControls } from "@/components/audio-player-controls";
import { ProvenanceBadge, ProvenanceStampButton } from "@/components/provenance-badge";
import { StemExportPanel } from "@/components/stem-export-panel";
import { HistoryControls, GenerationHistory } from "@/components/generation-history";
import type { SoundGeneration } from "@/types";
import type { ProviderId } from "@/components/provider-selector";
import type { O8Identity, O8Provenance } from "@/lib/o8/types";
import type { GenerationHistoryEntry } from "@/hooks/useGenerationHistory";

export function OutputPanel({
  currentSound,
  selectedProvider,
  o8Identity,
  currentProvenance,
  onProvenanceStamped,
  onSaveToLibrary,
  showStemExport,
  onToggleStemExport,
  onStemExported,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  history,
  historyIndex,
  onHistorySelect,
  onClearHistory,
}: {
  currentSound: SoundGeneration | null;
  selectedProvider: ProviderId;
  o8Identity: O8Identity | null;
  currentProvenance: O8Provenance | null;
  onProvenanceStamped: (provenance: O8Provenance) => void;
  onSaveToLibrary: () => void;
  showStemExport: boolean;
  onToggleStemExport: () => void;
  onStemExported: (config: { stems: unknown[] }) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  history: GenerationHistoryEntry[];
  historyIndex: number;
  onHistorySelect: (index: number) => void;
  onClearHistory: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="bg-black border border-white/[0.06] p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-400">Output</p>
          <HistoryControls
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={onUndo}
            onRedo={onRedo}
          />
        </div>

        {currentSound ? (
          <div className="mt-4">
            <div className="border-b border-white/[0.06] pb-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-white truncate max-w-[240px]">{currentSound.name}</p>
                <p className="text-[10px] text-gray-600 capitalize">{currentSound.status}</p>
              </div>
              <p className="mt-1 text-[11px] text-gray-500 line-clamp-2">{currentSound.prompt}</p>
              {currentSound.provenanceCid && (
                <p className="mt-1.5 text-[10px] text-gray-600 font-mono truncate">
                  {currentSound.provenanceCid.slice(0, 24)}...
                </p>
              )}
            </div>

            {currentSound.status === "error" ? (
              <div className="mt-4 py-4">
                <p className="text-sm text-red-400">
                  {currentSound.errorMessage ?? "Generation failed."}
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <AudioPlayerControls
                  key={currentSound.audioUrl ?? currentSound.id}
                  audioUrl={currentSound.audioUrl}
                  disabled={currentSound.status !== "ready"}
                />

                {/* Provenance */}
                {currentSound.status === "ready" && (
                  <div className="flex items-center justify-between py-3">
                    {currentProvenance ? (
                      <ProvenanceBadge provenance={currentProvenance} />
                    ) : (
                      <ProvenanceStampButton
                        identityId={o8Identity?.identity_id ?? "anonymous"}
                        prompt={currentSound.prompt}
                        audioFingerprint={`swanblade-${currentSound.id}-${Date.now()}`}
                        parameters={{
                          lengthSeconds: currentSound.lengthSeconds,
                          type: currentSound.type,
                          provider: selectedProvider,
                        }}
                        provider={selectedProvider}
                        onStamped={(result) => {
                          onProvenanceStamped({
                            identity_id: o8Identity?.identity_id ?? "anonymous",
                            fingerprint: result.declaration_cid,
                            timestamp: new Date().toISOString(),
                            content_type: "audio",
                          });
                        }}
                      />
                    )}
                  </div>
                )}

                <button
                  onClick={onSaveToLibrary}
                  disabled={currentSound.status !== "ready"}
                  className="w-full px-6 py-3 text-body-sm font-medium text-white border border-white/[0.06] hover:border-white/[0.12] transition-colors duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Save to Library
                </button>

                {/* Stem Export */}
                {currentSound.status === "ready" && currentSound.audioUrl && (
                  <div className="border-t border-white/[0.06] pt-3">
                    <button
                      onClick={onToggleStemExport}
                      className="flex w-full items-center justify-between text-left"
                    >
                      <span className="text-body-sm font-light text-gray-500">
                        Export to Burn the Square
                      </span>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        className={`text-gray-500 transition-transform ${showStemExport ? "rotate-180" : ""}`}
                      >
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </button>
                    {showStemExport && (
                      <div className="mt-3">
                        <StemExportPanel
                          soundId={currentSound.id}
                          soundName={currentSound.name}
                          audioUrl={currentSound.audioUrl}
                          onExport={onStemExported}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 py-12 text-center">
            <p className="text-sm font-light text-gray-500">
              Enter a brief and generate to create audio.
            </p>
          </div>
        )}
      </div>

      {/* Generation History */}
      <GenerationHistory
        history={history}
        currentIndex={historyIndex}
        onSelect={onHistorySelect}
        onClear={onClearHistory}
      />
    </div>
  );
}
