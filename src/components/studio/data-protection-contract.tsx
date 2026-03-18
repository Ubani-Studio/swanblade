"use client";

import { useCallback, useState } from "react";

interface DataProtectionContractProps {
  fileCount: number;
  onAccept: (consentTimestamp: string) => void;
  onCancel: () => void;
}

export function DataProtectionContract({
  fileCount,
  onAccept,
  onCancel,
}: DataProtectionContractProps) {
  const [consented, setConsented] = useState(false);

  const handleAccept = useCallback(() => {
    if (!consented) return;
    onAccept(new Date().toISOString());
  }, [consented, onAccept]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onCancel}
    >
      <div
        className="bg-black border border-white/[0.06] p-8 max-w-lg w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-6">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            className="text-emerald-500 shrink-0"
          >
            <path
              d="M12 2L4 6v6c0 5.25 3.4 10.15 8 11.25C16.6 22.15 20 17.25 20 12V6l-8-4z"
              stroke="currentColor"
              strokeWidth="1.5"
              fill="none"
            />
            <path
              d="M9 12l2 2 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <h3
            className="text-lg text-white"
            style={{ fontFamily: "var(--font-canela), Georgia, serif" }}
          >
            Data Protection Contract
          </h3>
        </div>

        <p className="text-sm text-gray-400 mb-6">
          You&apos;re about to upload {fileCount} audio file
          {fileCount !== 1 ? "s" : ""} for LoRA training. Here&apos;s exactly
          what happens:
        </p>

        <div className="space-y-4 mb-6">
          <Commitment
            icon="lock"
            title="Encrypted in your browser"
            description="Files are encrypted with AES-256-GCM before leaving your device. The server never sees raw audio."
          />
          <Commitment
            icon="box"
            title="Sandboxed training"
            description="Your audio trains only your model in an isolated GPU container. No other user or system can access it."
          />
          <Commitment
            icon="trash"
            title="Deleted after training"
            description="Encrypted audio files are permanently deleted once training completes. Deletion is logged with a timestamp."
          />
          <Commitment
            icon="download"
            title="The model is yours"
            description="The trained LoRA model belongs to you. Download it anytime. We don't use it for anything else."
          />
        </div>

        <label className="flex items-start gap-3 cursor-pointer mb-6 group">
          <input
            type="checkbox"
            checked={consented}
            onChange={(e) => setConsented(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-emerald-500"
          />
          <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
            I understand and consent to these terms. My audio will be encrypted,
            used solely for training my LoRA model, and deleted afterward.
          </span>
        </label>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-sm text-gray-400 border border-white/[0.06] hover:text-white hover:border-white/[0.12] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAccept}
            disabled={!consented}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-black bg-emerald-500 hover:bg-emerald-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Begin Training
          </button>
        </div>
      </div>
    </div>
  );
}

function Commitment({
  icon,
  title,
  description,
}: {
  icon: "lock" | "box" | "trash" | "download";
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-5 h-5 mt-0.5 text-emerald-500/70 shrink-0">
        {icon === "lock" && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="5" y="11" width="14" height="10" rx="1" />
            <path d="M8 11V7a4 4 0 118 0v4" />
          </svg>
        )}
        {icon === "box" && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 7l9-4 9 4v10l-9 4-9-4V7z" />
            <path d="M3 7l9 4m0 0l9-4m-9 4v11" />
          </svg>
        )}
        {icon === "trash" && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
          </svg>
        )}
        {icon === "download" && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <div>
        <p className="text-sm text-white">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
    </div>
  );
}
