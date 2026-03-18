"use client";

type BriefMode = "sound" | "song" | "stem" | "catalog" | "album";

const BRIEF_MODES: { id: BriefMode; label: string }[] = [
  { id: "sound", label: "Sound" },
  { id: "song", label: "Song" },
  { id: "stem", label: "Stem" },
  { id: "catalog", label: "Catalog" },
  { id: "album", label: "Album" },
];

const BRIEF_PLACEHOLDERS: Record<BriefMode, string> = {
  sound: "Describe the sound you need...",
  song: "Describe the mood, genre, and energy...",
  stem: "Describe the layer — instrument, feel, role...",
  catalog: "Describe the family of sounds...",
  album: "Describe the world — arc, palette, flow...",
};

export type { BriefMode };

export function BriefPanel({
  briefMode,
  onBriefModeChange,
  prompt,
  onPromptChange,
  disabled,
}: {
  briefMode: BriefMode;
  onBriefModeChange: (mode: BriefMode) => void;
  prompt: string;
  onPromptChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="bg-black border border-white/[0.06] p-5">
      <p className="text-sm font-medium text-gray-400">Brief</p>

      <div className="mt-3 flex gap-1.5">
        {BRIEF_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onBriefModeChange(m.id)}
            className={`px-2 py-1 text-[11px] border transition-colors duration-150 ${
              briefMode === m.id
                ? "border-white/20 bg-white/[0.06] text-white"
                : "border-white/[0.04] text-gray-600 hover:text-gray-400"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <textarea
        className="w-full bg-black border-0 border-b border-white/[0.06] px-3 py-3 text-white text-sm font-light placeholder:text-gray-600 focus:outline-none focus:border-white/[0.12] transition-colors mt-3 resize-none"
        rows={3}
        placeholder={BRIEF_PLACEHOLDERS[briefMode]}
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}
