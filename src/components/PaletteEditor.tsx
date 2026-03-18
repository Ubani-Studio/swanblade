"use client";

import { useState, useMemo } from "react";
import {
  type SoundPalette,
  PALETTE_PRESETS,
  createPaletteFromPreset,
  SoundPaletteStore,
} from "@/lib/soundPalette";

interface PaletteEditorProps {
  value: SoundPalette | null;
  onChange: (palette: SoundPalette | null) => void;
  onCreateFromDNA?: () => void;
}

const paletteStore = new SoundPaletteStore();

export function PaletteEditor({ value, onChange, onCreateFromDNA }: PaletteEditorProps) {
  const [showCustomEditor, setShowCustomEditor] = useState(false);
  const [customName, setCustomName] = useState("");

  const savedPalettes = useMemo(() => paletteStore.getAll(), []);

  const handlePresetSelect = (presetId: string) => {
    if (presetId === "none") {
      onChange(null);
      return;
    }

    const palette = createPaletteFromPreset(presetId as keyof typeof PALETTE_PRESETS);
    onChange(palette);
  };

  const handleSavedSelect = (id: string) => {
    const palette = savedPalettes.find((p) => p.id === id);
    if (palette) {
      onChange(palette);
    }
  };

  const savePalette = () => {
    if (!value || !customName.trim()) return;

    const paletteToSave: SoundPalette = {
      ...value,
      name: customName.trim(),
    };

    paletteStore.save(paletteToSave);
    setShowCustomEditor(false);
    setCustomName("");
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-body-sm text-gray-500">Sound Palette</p>
        {value && (
          <button
            onClick={() => onChange(null)}
            className="text-body-sm text-gray-500 hover:text-white"
          >
            Clear
          </button>
        )}
      </div>

      {/* Preset Selection */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => handlePresetSelect("none")}
          className={`px-3 py-1.5 text-xs transition ${
            !value
              ? "border border-white bg-white text-black"
              : "border border-[#1a1a1a] text-gray-400 hover:border-[#333] hover:text-white"
          }`}
        >
          No Palette
        </button>

        {Object.entries(PALETTE_PRESETS).map(([id, preset]) => (
          <button
            key={id}
            onClick={() => handlePresetSelect(id)}
            className={`px-3 py-1.5 text-xs transition ${
              value?.name === preset.name
                ? "border border-white bg-white text-black"
                : "border border-[#1a1a1a] text-gray-400 hover:border-[#333] hover:text-white"
            }`}
          >
            {preset.name}
          </button>
        ))}
      </div>

      {/* Saved Palettes */}
      {savedPalettes.length > 0 && (
        <div className="mt-3">
          <p className="text-body-sm text-gray-500">Saved Palettes</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {savedPalettes.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSavedSelect(p.id)}
                className={`px-3 py-1.5 text-xs transition ${
                  value?.id === p.id
                    ? "border border-white bg-white text-black"
                    : "border border-[#1a1a1a] text-gray-400 hover:border-[#333] hover:text-white"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Current Palette Details */}
      {value && (
        <div className="mt-4 space-y-3">
          <div className="border border-[#1a1a1a] bg-black p-3">
            <p className="text-body-lg font-medium text-white">{value.name}</p>
            <p className="mt-1 text-body-sm text-gray-500">{value.description}</p>

            {/* Genres & Moods */}
            <div className="mt-2 flex flex-wrap gap-1">
              {value.genres.map((g) => (
                <span
                  key={g}
                  className="bg-white px-2 py-0.5 text-caption text-black"
                >
                  {g}
                </span>
              ))}
              {value.moods.map((m) => (
                <span
                  key={m}
                  className="bg-[#1a1a1a] px-2 py-0.5 text-caption text-white"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>

          {/* Constraint Sliders */}
          <button
            onClick={() => setShowCustomEditor(!showCustomEditor)}
            className="text-body-sm text-gray-500 hover:text-white"
          >
            {showCustomEditor ? "Hide" : "Edit"} Constraints
          </button>

          {showCustomEditor && (
            <div className="space-y-3 border border-[#1a1a1a] bg-black p-3">
              {/* BPM Range */}
              {value.constraints.bpmRange && (
                <ConstraintSlider
                  label="BPM"
                  min={60}
                  max={200}
                  value={value.constraints.bpmRange}
                  onChange={(range) => {
                    onChange({
                      ...value,
                      constraints: { ...value.constraints, bpmRange: range },
                    });
                  }}
                />
              )}

              {/* Energy Range */}
              {value.constraints.energyRange && (
                <ConstraintSlider
                  label="Energy"
                  min={0}
                  max={100}
                  value={value.constraints.energyRange}
                  onChange={(range) => {
                    onChange({
                      ...value,
                      constraints: { ...value.constraints, energyRange: range },
                    });
                  }}
                />
              )}

              {/* Brightness Range */}
              {value.constraints.brightnessRange && (
                <ConstraintSlider
                  label="Brightness"
                  min={0}
                  max={100}
                  value={value.constraints.brightnessRange}
                  onChange={(range) => {
                    onChange({
                      ...value,
                      constraints: { ...value.constraints, brightnessRange: range },
                    });
                  }}
                />
              )}

              {/* Save Custom */}
              <div className="flex gap-2 pt-2">
                <input
                  type="text"
                  placeholder="Palette name..."
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="flex-1 border border-[#1a1a1a] bg-black px-3 py-1.5 text-body text-white placeholder:text-gray-500 focus:border-white focus:outline-none"
                />
                <button
                  onClick={savePalette}
                  disabled={!customName.trim()}
                  className="bg-white px-4 py-1.5 text-body-sm text-black disabled:opacity-40"
                >
                  Save
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create from DNA */}
      {onCreateFromDNA && (
        <button
          onClick={onCreateFromDNA}
          className="mt-3 w-full border border-dashed border-[#1a1a1a] py-2 text-body-sm text-gray-500 hover:border-white hover:text-white"
        >
          + Create from Sound DNA
        </button>
      )}
    </div>
  );
}

interface ConstraintSliderProps {
  label: string;
  min: number;
  max: number;
  value: [number, number];
  onChange: (range: [number, number]) => void;
}

function ConstraintSlider({ label, min, max, value, onChange }: ConstraintSliderProps) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-body-sm text-gray-500">{label}</span>
        <span className="text-body-sm text-gray-500">
          {value[0]} - {value[1]}
        </span>
      </div>
      <div className="mt-1 flex gap-2">
        <input
          type="range"
          min={min}
          max={max}
          value={value[0]}
          onChange={(e) => onChange([parseInt(e.target.value), value[1]])}
          className="flex-1 accent-white"
        />
        <input
          type="range"
          min={min}
          max={max}
          value={value[1]}
          onChange={(e) => onChange([value[0], parseInt(e.target.value)])}
          className="flex-1 accent-white"
        />
      </div>
    </div>
  );
}
