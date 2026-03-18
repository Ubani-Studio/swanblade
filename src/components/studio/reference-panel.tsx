"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { uuid } from "@/lib/utils";

export type ReferenceClip = {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  previewUrl: string;
};

const MAX_REFERENCE_FILES = 10;
const MAX_REFERENCE_FILE_BYTES = 25 * 1024 * 1024;
const MAX_REFERENCE_FILE_SIZE_LABEL = "25 MB";

function formatDisplayBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "unknown";
  const units = ["B", "KB", "MB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const decimals = unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[unitIndex]}`;
}

export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        const [, base64] = result.split(",");
        resolve(base64 ?? "");
      } else {
        reject(new Error("Failed to read audio reference."));
      }
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error("Failed to read audio reference."));
    };
    reader.readAsDataURL(file);
  });
}

function ClipCard({
  clip,
  onRemove,
  dataProtected,
}: {
  clip: ReferenceClip;
  onRemove: (id: string) => void;
  dataProtected?: boolean;
}) {
  return (
    <div className="border border-white/[0.06] bg-black p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {dataProtected && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-emerald-500 shrink-0">
              <path d="M12 2L4 6v6c0 5.25 3.4 10.2 8 12 4.6-1.8 8-6.75 8-12V6l-8-4z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.15" />
            </svg>
          )}
          <div>
            <p className="text-sm font-medium text-white">{clip.name}</p>
            <p className="text-body-sm font-light text-gray-500">{formatDisplayBytes(clip.size)}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onRemove(clip.id)}
          className="text-body-sm font-light text-gray-500 hover:text-white"
        >
          Remove
        </button>
      </div>
      <div className="mt-3">
        <audio
          controls
          src={clip.previewUrl}
          preload="metadata"
          controlsList="nodownload noplaybackrate"
          className="h-8 w-full"
        />
      </div>
    </div>
  );
}

export function ReferencePanel({
  clips,
  onClipsChange,
  dataProtected,
  onDataProtectedChange,
  onToast,
}: {
  clips: ReferenceClip[];
  onClipsChange: (clips: ReferenceClip[]) => void;
  dataProtected: boolean;
  onDataProtectedChange: (value: boolean) => void;
  onToast: (message: string, tone?: "neutral" | "success" | "error") => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrls = useRef(new Set<string>());

  const addFiles = useCallback(
    (fileList: FileList | File[] | null) => {
      if (!fileList || fileList.length === 0) return;
      const allFiles = Array.from(fileList);
      const audioFiles = allFiles.filter((f) => f.type.startsWith("audio/"));
      if (!audioFiles.length) {
        onToast("Only audio files can be used as references.", "error");
        return;
      }
      if (audioFiles.length !== allFiles.length) {
        onToast("Non-audio files were ignored.", "neutral");
      }

      const availableSlots = Math.max(0, MAX_REFERENCE_FILES - clips.length);
      if (availableSlots <= 0) {
        onToast(`You can attach up to ${MAX_REFERENCE_FILES} audio references.`, "error");
        return;
      }

      const accepted: ReferenceClip[] = [];
      const oversized: string[] = [];
      for (const file of audioFiles) {
        if (accepted.length >= availableSlots) break;
        if (file.size > MAX_REFERENCE_FILE_BYTES) {
          oversized.push(file.name);
          continue;
        }
        const previewUrl = URL.createObjectURL(file);
        previewUrls.current.add(previewUrl);
        accepted.push({
          id: uuid(),
          file,
          name: file.name,
          size: file.size,
          type: file.type || "audio/mpeg",
          previewUrl,
        });
      }

      if (accepted.length) {
        onClipsChange([...clips, ...accepted]);
      }
      if (oversized.length) {
        onToast(`These files exceeded ${MAX_REFERENCE_FILE_SIZE_LABEL}: ${oversized.join(", ")}`, "error");
      }
    },
    [clips, onClipsChange, onToast],
  );

  const removeClip = useCallback(
    (id: string) => {
      const clip = clips.find((c) => c.id === id);
      if (clip) {
        URL.revokeObjectURL(clip.previewUrl);
        previewUrls.current.delete(clip.previewUrl);
      }
      onClipsChange(clips.filter((c) => c.id !== id));
    },
    [clips, onClipsChange],
  );

  const clearAll = useCallback(() => {
    clips.forEach((clip) => {
      URL.revokeObjectURL(clip.previewUrl);
      previewUrls.current.delete(clip.previewUrl);
    });
    onClipsChange([]);
  }, [clips, onClipsChange]);

  useEffect(() => {
    const urls = previewUrls.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  const onFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
    e.target.value = "";
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const openPicker = () => fileInputRef.current?.click();

  return (
    <div className="bg-black border border-white/[0.06] p-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-400">Audio References</p>
        {clips.length > 0 && (
          <p className="text-body-sm font-light text-gray-500">
            {clips.length} of {MAX_REFERENCE_FILES} slots used
          </p>
        )}
      </div>
      <p className="mt-2 text-body-sm font-light text-gray-500">
        Upload audio files as inspiration for generation.
      </p>

      {/* Data Protection Toggle */}
      <div className="mt-4 flex items-center justify-between py-3">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className={dataProtected ? "text-emerald-500" : "text-gray-600"}>
            <path d="M12 2L4 6v6c0 5.25 3.4 10.2 8 12 4.6-1.8 8-6.75 8-12V6l-8-4z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.15" />
          </svg>
          <span className="text-body-sm font-light text-white">Data Protection</span>
        </div>
        <button
          type="button"
          onClick={() => onDataProtectedChange(!dataProtected)}
          className={`relative w-9 h-5 rounded-full transition-colors ${dataProtected ? "bg-emerald-600" : "bg-[#333]"}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${dataProtected ? "translate-x-4" : "translate-x-0"}`}
          />
        </button>
      </div>
      {!dataProtected && (
        <p className="mt-2 text-body-sm font-light text-amber-500/80">
          Your audio may be used to improve generation quality.
        </p>
      )}

      {/* Drop Zone */}
      <div
        className={`group mt-4 relative cursor-pointer overflow-hidden border transition-all duration-300 ${
          isDragging
            ? "border-white/30 bg-white/[0.03]"
            : "border-white/[0.06] hover:border-white/[0.12]"
        }`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={openPicker}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          multiple
          className="hidden"
          onChange={onFileInput}
        />
        <div className={`absolute top-0 left-0 right-0 h-px transition-opacity duration-300 ${isDragging ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`} style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)" }} />

        <div className="flex items-center gap-5 px-6 py-5">
          <div className={`flex items-center justify-center w-10 h-10 border transition-all duration-300 ${isDragging ? "border-white/20 bg-white/5" : "border-white/[0.06] group-hover:border-white/[0.12]"}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={`transition-all duration-300 ${isDragging ? "text-white -translate-y-0.5" : "text-gray-500 group-hover:text-gray-300"}`}>
              <path d="M12 16V4m0 0l-4 4m4-4l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M20 16v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-light transition-colors duration-300 ${isDragging ? "text-white" : "text-gray-400 group-hover:text-gray-300"}`}>
              {isDragging ? "Drop to add references" : "Drop audio files or click to browse"}
            </p>
            <p className="mt-0.5 text-body-sm font-light text-gray-600">
              {MAX_REFERENCE_FILE_SIZE_LABEL} max per file
            </p>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-gray-600 group-hover:text-gray-400 transition-colors duration-300 shrink-0">
            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Clip List */}
      {clips.length > 0 && (
        <div className="mt-4">
          {clips.length > 1 && (
            <div className="flex justify-end mb-3">
              <button
                type="button"
                onClick={clearAll}
                className="text-body-sm font-light text-gray-500 hover:text-white transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
          <div className="space-y-3">
            {clips.map((clip) => (
              <ClipCard key={clip.id} clip={clip} onRemove={removeClip} dataProtected={dataProtected} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
