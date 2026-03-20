"use client";

import { useState, useCallback, useEffect } from "react";
import { uuid } from "@/lib/utils";
import type { SoundCategory, GameState } from "@/types";
import type { SoundPalette } from "@/lib/soundPalette";
import type { RemixEngineId, StereoMode, VampnetMode, TransplantCodebooks } from "@/components/studio/remix-panel";

const STORAGE_KEY = "swanblade-presets";
const CHAINS_KEY = "swanblade-chain-recipes";

export interface GenerationPreset {
  id: string;
  name: string;
  createdAt: string;
  prompt: string;
  lengthSeconds: number;
  palette?: SoundPalette | null;
  gameState?: GameState | null;
  type?: SoundCategory;
  tags?: string[];
  // Sculpt params (optional — only set when saved from sculpt mode)
  engine?: RemixEngineId;
  strength?: number;
  periodicPrompt?: number;
  upperCodebookMask?: number;
  onsetMaskWidth?: number;
  temperature?: number;
  feedbackSteps?: number;
  stereoMode?: StereoMode;
  dryWet?: number;
  spectralMatch?: boolean;
  normalizeLoudness?: boolean;
  compressEnabled?: boolean;
  hpssEnabled?: boolean;
  demucsStems?: string[];
  enhanceEnabled?: boolean;
  magnetTemperature?: number;
  magnetTopK?: number;
  vampnetMode?: VampnetMode;
  transplantCodebooks?: TransplantCodebooks;
}

export interface ChainStep {
  presetId: string;
}

export interface ChainRecipe {
  id: string;
  name: string;
  createdAt: string;
  steps: ChainStep[];
}

function loadPresets(): GenerationPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function savePresets(presets: GenerationPreset[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // Storage full or unavailable
  }
}

function loadChains(): ChainRecipe[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(CHAINS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveChains(chains: ChainRecipe[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CHAINS_KEY, JSON.stringify(chains));
  } catch {}
}

// Default presets to start with
const DEFAULT_PRESETS: GenerationPreset[] = [
  {
    id: "default-texture",
    name: "Texture Pass",
    createdAt: new Date().toISOString(),
    prompt: "Gentle ambient atmosphere with soft pads and subtle textures",
    lengthSeconds: 30,
    engine: "vampnet",
    periodicPrompt: 3,
    upperCodebookMask: 5,
    temperature: 0.8,
  },
  {
    id: "default-sculpt",
    name: "Deep Sculpt",
    createdAt: new Date().toISOString(),
    prompt: "Aggressive transformation with bold character",
    lengthSeconds: 15,
    engine: "vampnet",
    periodicPrompt: 4,
    upperCodebookMask: 2,
    temperature: 1.0,
  },
  {
    id: "default-radical",
    name: "Radical Reimagine",
    createdAt: new Date().toISOString(),
    prompt: "Wild, unpredictable reimagining",
    lengthSeconds: 10,
    engine: "vampnet",
    periodicPrompt: 3,
    upperCodebookMask: 1,
    temperature: 1.3,
  },
];

export function usePresets() {
  const [presets, setPresets] = useState<GenerationPreset[]>([]);
  const [chains, setChains] = useState<ChainRecipe[]>([]);

  // Load presets + chains on mount
  useEffect(() => {
    const loaded = loadPresets();
    if (loaded.length === 0) {
      setPresets(DEFAULT_PRESETS);
      savePresets(DEFAULT_PRESETS);
    } else {
      setPresets(loaded);
    }
    setChains(loadChains());
  }, []);

  // Save preset
  const savePreset = useCallback((preset: Omit<GenerationPreset, "id" | "createdAt">) => {
    const newPreset: GenerationPreset = {
      ...preset,
      id: uuid(),
      createdAt: new Date().toISOString(),
    };

    setPresets((prev) => {
      const updated = [newPreset, ...prev];
      savePresets(updated);
      return updated;
    });

    return newPreset;
  }, []);

  // Update preset
  const updatePreset = useCallback((id: string, updates: Partial<GenerationPreset>) => {
    setPresets((prev) => {
      const updated = prev.map((p) => (p.id === id ? { ...p, ...updates } : p));
      savePresets(updated);
      return updated;
    });
  }, []);

  // Delete preset + clean up any chains referencing it
  const deletePreset = useCallback((id: string) => {
    setPresets((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      savePresets(updated);
      return updated;
    });
    // Remove the deleted preset from any chain steps; drop chains that become empty
    setChains((prev) => {
      const cleaned = prev
        .map((c) => ({ ...c, steps: c.steps.filter((s) => s.presetId !== id) }))
        .filter((c) => c.steps.length > 0);
      saveChains(cleaned);
      return cleaned;
    });
  }, []);

  // Duplicate preset
  const duplicatePreset = useCallback((id: string) => {
    const original = presets.find((p) => p.id === id);
    if (!original) return null;

    const duplicate: GenerationPreset = {
      ...original,
      id: uuid(),
      name: `${original.name} (Copy)`,
      createdAt: new Date().toISOString(),
    };

    setPresets((prev) => {
      const updated = [duplicate, ...prev];
      savePresets(updated);
      return updated;
    });

    return duplicate;
  }, [presets]);

  // Chain recipes
  const saveChain = useCallback((name: string, steps: ChainStep[]) => {
    const chain: ChainRecipe = {
      id: uuid(),
      name,
      createdAt: new Date().toISOString(),
      steps,
    };
    setChains((prev) => {
      const updated = [chain, ...prev];
      saveChains(updated);
      return updated;
    });
    return chain;
  }, []);

  const deleteChain = useCallback((id: string) => {
    setChains((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      saveChains(updated);
      return updated;
    });
  }, []);

  return {
    presets,
    savePreset,
    updatePreset,
    deletePreset,
    duplicatePreset,
    chains,
    saveChain,
    deleteChain,
  };
}
