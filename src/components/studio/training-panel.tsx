"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DataProtectionContract } from "./data-protection-contract";
import {
  generateTrainingKey,
  exportKeyAsBase64,
  encryptAudioFile,
} from "@/lib/crypto";

/** Convert File to base64 data URL */
async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

type TrainingStage =
  | "idle"
  | "selecting"
  | "contract"
  | "encrypting"
  | "uploading"
  | "training"
  | "completed"
  | "failed";

interface SourceFile {
  name: string;
  size: number;
  mime_type?: string;
}

interface TrainingPanelProps {
  onToast: (message: string, tone?: "neutral" | "success" | "error") => void;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatEta(seconds: number): string {
  if (seconds <= 0) return "finishing...";
  if (seconds < 60) return `~${seconds}s remaining`;
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (min < 60) return `~${min}m ${sec > 0 ? `${sec}s` : ""} remaining`;
  const hrs = Math.floor(min / 60);
  return `~${hrs}h ${min % 60}m remaining`;
}

export function TrainingPanel({ onToast }: TrainingPanelProps) {
  const [stage, setStage] = useState<TrainingStage>("idle");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modelName, setModelName] = useState("");
  const [modelDescription, setModelDescription] = useState("");
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState<number | null>(null);
  const [totalSteps, setTotalSteps] = useState(1000);
  const [sourceFiles, setSourceFiles] = useState<SourceFile[]>([]);
  const [finalLoss, setFinalLoss] = useState<number | null>(null);
  const [trainingPhase, setTrainingPhase] = useState<string>("");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      const audioFiles = files.filter((f) => f.type.startsWith("audio/"));
      if (audioFiles.length === 0) {
        onToast("No audio files selected.", "error");
        return;
      }
      setSelectedFiles((prev) => [...prev, ...audioFiles]);
      setStage("selecting");
    },
    [onToast]
  );

  const removeFile = useCallback((index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleBeginTraining = useCallback(() => {
    if (selectedFiles.length === 0) {
      onToast("Select at least one audio file.", "error");
      return;
    }
    setStage("contract");
  }, [selectedFiles.length, onToast]);

  const handleContractAccept = useCallback(
    async (consentTimestamp: string) => {
      setStage("encrypting");
      setProgress(0);

      try {
        const canEncryptLocally = typeof crypto !== "undefined" && !!crypto.subtle;

        let uploadBody: Record<string, unknown>;

        if (canEncryptLocally) {
          const key = await generateTrainingKey();
          const keyB64 = await exportKeyAsBase64(key);

          const encryptedFiles = [];
          for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            const encrypted = await encryptAudioFile(file, key);

            const bytes = new Uint8Array(encrypted.encrypted);
            let binary = "";
            const chunkSize = 8192;
            for (let j = 0; j < bytes.length; j += chunkSize) {
              binary += String.fromCharCode(...bytes.subarray(j, j + chunkSize));
            }
            const encB64 = btoa(binary);

            encryptedFiles.push({
              encrypted_b64: encB64,
              iv: encrypted.iv,
              original_name: encrypted.originalName,
              original_size: encrypted.originalSize,
              mime_type: encrypted.mimeType,
            });

            setProgress(Math.round(((i + 1) / selectedFiles.length) * 50));
          }

          uploadBody = {
            files: encryptedFiles,
            session_key_b64: keyB64,
            consent_timestamp: consentTimestamp,
            model_name: modelName.trim() || null,
            model_description: modelDescription.trim() || null,
          };
        } else {
          const rawFiles = [];
          for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            const b64 = await fileToBase64(file);
            rawFiles.push({
              data_b64: b64,
              original_name: file.name,
              original_size: file.size,
              mime_type: file.type || "audio/mpeg",
            });
            setProgress(Math.round(((i + 1) / selectedFiles.length) * 50));
          }

          uploadBody = {
            raw_files: rawFiles,
            encrypt_server_side: true,
            consent_timestamp: consentTimestamp,
            model_name: modelName.trim() || null,
            model_description: modelDescription.trim() || null,
          };
        }

        // Upload
        setStage("uploading");
        setProgress(50);

        const uploadRes = await fetch("/api/training/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(uploadBody),
        });

        if (!uploadRes.ok) {
          const err = await uploadRes.json().catch(() => ({}));
          throw new Error(err.error || "Upload failed.");
        }

        const { job_id } = await uploadRes.json();
        setJobId(job_id);
        setProgress(70);

        // Trigger training
        setStage("training");
        setTrainingPhase("Launching GPU...");
        const triggerRes = await fetch("/api/training/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ job_id }),
        });

        if (!triggerRes.ok) {
          const err = await triggerRes.json().catch(() => ({}));
          throw new Error(err.error || "Failed to trigger training.");
        }

        setProgress(5);

        // Poll for status with progress
        pollingRef.current = setInterval(async () => {
          try {
            const statusRes = await fetch(
              `/api/training/status?job_id=${job_id}`
            );
            if (!statusRes.ok) return;
            const status = await statusRes.json();

            if (status.status === "completed") {
              if (pollingRef.current) clearInterval(pollingRef.current);
              setStage("completed");
              setProgress(100);
              setSourceFiles(status.source_files || []);
              setFinalLoss(status.final_loss);
              onToast("Training complete. Your model is ready.", "success");
            } else if (status.status === "failed") {
              if (pollingRef.current) clearInterval(pollingRef.current);
              setStage("failed");
              setErrorMessage(status.error_message || "Training failed.");
              onToast("Training failed.", "error");
            } else if (status.status === "training") {
              // Update progress
              setProgress(status.progress || 0);
              setEtaSeconds(status.eta_seconds);
              setCurrentStep(status.current_step);
              setTotalSteps(status.total_steps || 1000);

              // Set phase description
              if (status.current_step !== null && status.current_step > 0) {
                setTrainingPhase(
                  `Step ${status.current_step} / ${status.total_steps}`
                );
              } else if (status.progress < 15) {
                setTrainingPhase("Loading model + encoding audio...");
              }
            }
          } catch {
            // Polling error, will retry
          }
        }, 3000);
      } catch (err) {
        setStage("failed");
        const msg = err instanceof Error ? err.message : "Training failed.";
        setErrorMessage(msg);
        onToast(msg, "error");
      }
    },
    [selectedFiles, onToast, modelName, modelDescription]
  );

  const handleContractCancel = useCallback(() => {
    setStage("selecting");
  }, []);

  const handleDownload = useCallback(async () => {
    if (!jobId) return;
    try {
      const res = await fetch(`/api/training/download?job_id=${jobId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Download failed." }));
        onToast(err.error || "Download not available yet.", "error");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = (modelName || "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
      a.download = safeName
        ? `${safeName}.safetensors`
        : `swanblade-lora-${jobId.slice(0, 8)}.safetensors`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onToast("Model downloaded.", "success");
    } catch {
      onToast("Download failed.", "error");
    }
  }, [jobId, onToast, modelName]);

  const reset = useCallback(() => {
    setStage("idle");
    setSelectedFiles([]);
    setProgress(0);
    setJobId(null);
    setErrorMessage(null);
    setModelName("");
    setModelDescription("");
    setEtaSeconds(null);
    setCurrentStep(null);
    setSourceFiles([]);
    setFinalLoss(null);
    setTrainingPhase("");
    if (pollingRef.current) clearInterval(pollingRef.current);
  }, []);

  return (
    <>
      <div className="bg-black border border-white/[0.06] p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-400">LoRA Training</p>
          {stage !== "idle" && stage !== "selecting" && (
            <span className="text-xs text-gray-600 uppercase tracking-wider">
              {stage}
            </span>
          )}
        </div>

        <p className="mt-2 text-xs text-gray-500">
          Train a custom model on your own audio. Files are encrypted in your
          browser before upload and deleted after training.
        </p>

        {/* Idle / Selecting */}
        {(stage === "idle" || stage === "selecting") && (
          <div className="mt-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 border border-dashed border-white/[0.12] text-sm text-gray-500 hover:text-white hover:border-white/[0.24] transition-colors"
            >
              + Add Audio Files
            </button>

            {selectedFiles.length > 0 && (
              <div className="mt-3 space-y-1">
                {selectedFiles.map((file, i) => (
                  <div
                    key={`${file.name}-${i}`}
                    className="flex items-center justify-between py-1.5 px-2 border border-white/[0.06] text-sm"
                  >
                    <span className="text-gray-300 truncate flex-1 mr-2">
                      {file.name}
                    </span>
                    <span className="text-gray-600 text-xs shrink-0 mr-2">
                      {formatSize(file.size)}
                    </span>
                    <button
                      onClick={() => removeFile(i)}
                      className="text-gray-600 hover:text-red-400 transition-colors shrink-0"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M6 6l12 12M6 18L18 6"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </div>
                ))}

                <div className="mt-3 space-y-2">
                  <input
                    type="text"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    placeholder="Name your Sound World"
                    maxLength={60}
                    className="w-full px-3 py-2 bg-transparent border border-white/[0.08] text-sm text-white placeholder-gray-600 focus:border-white/[0.2] focus:outline-none transition-colors"
                  />
                  <input
                    type="text"
                    value={modelDescription}
                    onChange={(e) => setModelDescription(e.target.value)}
                    placeholder="Short description (optional)"
                    maxLength={120}
                    className="w-full px-3 py-2 bg-transparent border border-white/[0.08] text-sm text-white placeholder-gray-600 focus:border-white/[0.2] focus:outline-none transition-colors"
                  />
                </div>

                <button
                  onClick={handleBeginTraining}
                  className="mt-3 w-full px-4 py-2.5 text-sm font-medium text-black bg-white hover:bg-gray-200 transition-colors"
                >
                  Begin Training ({selectedFiles.length} file
                  {selectedFiles.length !== 1 ? "s" : ""})
                </button>
              </div>
            )}
          </div>
        )}

        {/* Progress States */}
        {(stage === "encrypting" ||
          stage === "uploading" ||
          stage === "training") && (
          <div className="mt-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span className="text-sm text-gray-300">
                {stage === "encrypting" && "Encrypting files..."}
                {stage === "uploading" && "Uploading encrypted files..."}
                {stage === "training" && "Training model..."}
              </span>
            </div>

            <div className="w-full h-1.5 bg-white/[0.06] overflow-hidden rounded-full">
              <div
                className="h-full bg-white transition-all duration-1000 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-gray-600">
                {stage === "encrypting" &&
                  "AES-256-GCM encryption in your browser."}
                {stage === "uploading" &&
                  "Server receives only encrypted data."}
                {stage === "training" && trainingPhase}
              </p>
              {stage === "training" && (
                <p className="text-xs text-gray-500 tabular-nums">
                  {etaSeconds !== null ? formatEta(etaSeconds) : "Estimating..."}
                </p>
              )}
            </div>

            {/* Step counter during training */}
            {stage === "training" && currentStep !== null && currentStep > 0 && (
              <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
                <span>{Math.round(progress)}%</span>
                <span>
                  {currentStep.toLocaleString()} / {totalSteps.toLocaleString()} steps
                </span>
              </div>
            )}
          </div>
        )}

        {/* Completed */}
        {stage === "completed" && (
          <div className="mt-4">
            <div className="flex items-center gap-2 text-emerald-500 mb-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M8 12l2.5 2.5L16 9"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-sm">Training complete</span>
              {finalLoss !== null && (
                <span className="text-xs text-gray-600 ml-auto tabular-nums">
                  loss: {finalLoss.toFixed(4)}
                </span>
              )}
            </div>

            <p className="text-xs text-gray-500 mb-3">
              Your audio files have been permanently deleted. The LoRA model is
              yours to download.
            </p>

            {/* Source files that trained this model */}
            {sourceFiles.length > 0 && (
              <div className="mb-3 border border-white/[0.04] p-3">
                <p className="text-xs text-gray-600 mb-2">Trained on:</p>
                <div className="space-y-1">
                  {sourceFiles.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="text-gray-400 truncate flex-1 mr-2">
                        {f.name}
                      </span>
                      <span className="text-gray-600 shrink-0">
                        {formatSize(f.size)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleDownload}
                className="flex-1 px-4 py-2 text-sm text-black bg-white hover:bg-gray-200 transition-colors"
              >
                Download Model
              </button>
              <button
                onClick={reset}
                className="px-4 py-2 text-sm text-gray-400 border border-white/[0.06] hover:text-white transition-colors"
              >
                New Training
              </button>
            </div>
          </div>
        )}

        {/* Failed */}
        {stage === "failed" && (
          <div className="mt-4">
            <div className="flex items-center gap-2 text-red-400 mb-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M8 8l8 8M8 16l8-8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-sm">Training failed</span>
            </div>

            {errorMessage && (
              <p className="text-xs text-gray-500 mb-3">{errorMessage}</p>
            )}

            <button
              onClick={reset}
              className="px-4 py-2 text-sm text-gray-400 border border-white/[0.06] hover:text-white transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
      </div>

      {/* Data Protection Contract Modal */}
      {stage === "contract" && (
        <DataProtectionContract
          fileCount={selectedFiles.length}
          onAccept={handleContractAccept}
          onCancel={handleContractCancel}
        />
      )}
    </>
  );
}
