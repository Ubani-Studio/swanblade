"use client";

import { useEffect, useState } from "react";
import { AudioPlayerControls } from "@/components/audio-player-controls";
import { GenerationProgress } from "@/components/studio/generation-progress";
import { ProvenanceBadge, ProvenanceStampButton } from "@/components/provenance-badge";
import { HistoryControls, GenerationHistory } from "@/components/generation-history";
import { SpectrogramComparison } from "@/components/spectrogram";
import type { SoundGeneration } from "@/types";
import type { O8Identity, O8Provenance } from "@/lib/o8/types";
import type { GenerationHistoryEntry } from "@/hooks/useGenerationHistory";

export function OutputPanel({
  currentSound,
  isGenerating,
  o8Identity,
  currentProvenance,
  onProvenanceStamped,
  onSaveToLibrary,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  history,
  historyIndex,
  onHistorySelect,
  onClearHistory,
  onFeedback,
  onReSculpt,
  originalAudioUrl,
}: {
  currentSound: SoundGeneration | null;
  isGenerating: boolean;
  o8Identity: O8Identity | null;
  currentProvenance: O8Provenance | null;
  onProvenanceStamped: (provenance: O8Provenance) => void;
  onSaveToLibrary: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  history: GenerationHistoryEntry[];
  historyIndex: number;
  onHistorySelect: (index: number) => void;
  onClearHistory: () => void;
  onFeedback?: (rating: -1 | 1, comment: string) => void;
  onReSculpt?: (audioUrl: string, name: string) => void;
  originalAudioUrl?: string;
}) {
  const [feedbackSent, setFeedbackSent] = useState<-1 | 1 | null>(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [showComment, setShowComment] = useState(false);
  const [abMode, setAbMode] = useState<"a" | "b">("b");
  const [showSpectrogram, setShowSpectrogram] = useState(false);

  // Reset all ephemeral state when sound changes
  useEffect(() => {
    setAbMode("b");
    setFeedbackSent(null);
    setFeedbackComment("");
    setShowComment(false);
    setShowSpectrogram(false);
  }, [currentSound?.id]);
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
                {currentSound.status === "pending" ? (
                  <GenerationProgress
                    isActive={isGenerating}
                    label={currentSound.remixSourceName ? "Sculpting" : "Generating"}
                  />
                ) : (
                  <>
                    {/* A/B Compare */}
                    {originalAudioUrl && currentSound.status === "ready" && currentSound.remixSourceName && (
                      <div className="flex gap-1.5 mb-2">
                        <button
                          onClick={() => setAbMode("a")}
                          className={`flex-1 px-2 py-1 text-[11px] border transition-colors duration-150 ${
                            abMode === "a"
                              ? "border-white/20 bg-white/[0.06] text-white"
                              : "border-white/[0.04] text-gray-600 hover:text-gray-400"
                          }`}
                        >A (Original)</button>
                        <button
                          onClick={() => setAbMode("b")}
                          className={`flex-1 px-2 py-1 text-[11px] border transition-colors duration-150 ${
                            abMode === "b"
                              ? "border-white/20 bg-white/[0.06] text-white"
                              : "border-white/[0.04] text-gray-600 hover:text-gray-400"
                          }`}
                        >B (Sculpted)</button>
                      </div>
                    )}
                    <AudioPlayerControls
                      key={abMode === "a" && originalAudioUrl ? `orig-${originalAudioUrl}` : (currentSound.audioUrl ?? currentSound.id)}
                      audioUrl={abMode === "a" && originalAudioUrl ? originalAudioUrl : currentSound.audioUrl}
                      disabled={currentSound.status !== "ready"}
                    />

                    {/* Spectrogram Before/After */}
                    {originalAudioUrl && currentSound.status === "ready" && currentSound.audioUrl && currentSound.remixSourceName && (
                      <div>
                        <button
                          onClick={() => setShowSpectrogram(!showSpectrogram)}
                          className="flex w-full items-center justify-between text-left py-1"
                        >
                          <span className="text-[10px] text-gray-600">Spectrogram</span>
                          <svg
                            width="10" height="10" viewBox="0 0 24 24" fill="none"
                            className={`text-gray-600 transition-transform ${showSpectrogram ? "rotate-180" : ""}`}
                          >
                            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        </button>
                        {showSpectrogram && (
                          <SpectrogramComparison
                            originalUrl={originalAudioUrl}
                            sculptedUrl={currentSound.audioUrl}
                          />
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* Provenance */}
                {currentSound.status === "ready" && (
                  <div className="flex items-center justify-between py-3">
                    {currentSound.manifestId ? (
                      <ProvenanceBadge
                        signed={{
                          manifest_id: currentSound.manifestId,
                          fingerprint: currentSound.origin8Fingerprint ?? "",
                          signature: currentSound.signature ?? "",
                          private_canon: currentSound.privateCanon,
                          watermark_status: currentSound.watermarkStatus ?? "sidecar",
                        }}
                      />
                    ) : currentProvenance ? (
                      <ProvenanceBadge provenance={currentProvenance} />
                    ) : (
                      <ProvenanceStampButton
                        identityId={o8Identity?.identity_id ?? "anonymous"}
                        prompt={currentSound.prompt}
                        audioFingerprint={`swanblade-${currentSound.id}-${Date.now()}`}
                        parameters={{
                          lengthSeconds: currentSound.lengthSeconds,
                          type: currentSound.type,
                        }}
                        provider={currentSound.remixEngine ?? "swanblade"}
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

                <div className="flex gap-2">
                  <button
                    onClick={onSaveToLibrary}
                    disabled={currentSound.status !== "ready"}
                    className="flex-1 px-4 py-3 text-body-sm font-medium text-white border border-white/[0.06] hover:border-white/[0.12] transition-colors duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Save
                  </button>
                  {currentSound.status === "ready" && currentSound.remixSourceName && onReSculpt && currentSound.audioUrl && (
                    <button
                      onClick={() => onReSculpt(currentSound.audioUrl!, currentSound.name)}
                      disabled={isGenerating}
                      className="flex-1 px-4 py-3 text-body-sm font-medium text-white border border-white/20 hover:bg-white hover:text-black transition-colors duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Re-Sculpt
                    </button>
                  )}
                </div>

                {/* Feedback */}
                {currentSound.status === "ready" && onFeedback && (
                  <div className="flex items-center gap-2">
                    {feedbackSent ? (
                      <p className="text-[10px] text-gray-500">
                        {feedbackSent === 1 ? "Liked" : "Disliked"} — thanks
                      </p>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setFeedbackSent(1);
                            setShowComment(true);
                            onFeedback(1, "");
                          }}
                          className="px-2 py-1 text-[10px] border border-white/[0.04] text-gray-600 hover:text-white hover:border-white/20 transition-colors"
                          title="Good result"
                        >
                          &uarr;
                        </button>
                        <button
                          onClick={() => {
                            setFeedbackSent(-1);
                            setShowComment(true);
                            onFeedback(-1, "");
                          }}
                          className="px-2 py-1 text-[10px] border border-white/[0.04] text-gray-600 hover:text-white hover:border-white/20 transition-colors"
                          title="Poor result"
                        >
                          &darr;
                        </button>
                        <span className="text-[10px] text-gray-600">Rate this output</span>
                      </>
                    )}
                    {showComment && feedbackSent && (
                      <input
                        type="text"
                        value={feedbackComment}
                        onChange={(e) => setFeedbackComment(e.target.value)}
                        onBlur={() => {
                          if (feedbackComment.trim()) {
                            onFeedback(feedbackSent, feedbackComment.trim());
                          }
                          setShowComment(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            onFeedback(feedbackSent, feedbackComment.trim());
                            setShowComment(false);
                          }
                        }}
                        placeholder="What could be better?"
                        className="flex-1 bg-transparent border-b border-white/[0.06] text-[10px] text-white placeholder:text-gray-600 focus:outline-none focus:border-white/20 px-1 py-0.5"
                        autoFocus
                      />
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
