"use client";

import { StatusBadge } from "@/components/status-badge";
import type { SoundGeneration } from "@/types";
import { formatRelativeTimestamp, cn } from "@/lib/utils";

interface SoundHistoryListProps {
  items: SoundGeneration[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function SoundHistoryList({ items, selectedId, onSelect }: SoundHistoryListProps) {
  if (!items.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center border border-dashed border-[#1a1a1a] bg-black p-6 text-center">
        <p className="text-body text-gray-500">Describe a sound and I&apos;ll design it.</p>
        <p className="mt-2 text-body-sm text-gray-500/60">Your sound history will live here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((sound) => (
        <button
          key={sound.id}
          type="button"
          onClick={() => onSelect(sound.id)}
          className={cn(
            "w-full border border-[#1a1a1a] p-4 text-left transition hover:border-white",
            selectedId === sound.id && "border-white bg-black",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-body font-medium text-white">{sound.name}</p>
              <p className="text-sm text-gray-400">
                {sound.type} • {formatRelativeTimestamp(sound.createdAt)}
              </p>
            </div>
            <StatusBadge status={sound.status} />
          </div>
          <p className="mt-3 line-clamp-2 text-body-sm text-gray-500">{sound.prompt}</p>
        </button>
      ))}
    </div>
  );
}
