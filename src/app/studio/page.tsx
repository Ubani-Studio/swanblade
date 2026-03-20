"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ToastItem, ToastStack } from "@/components/toast-stack";
import { LibraryPanel } from "@/components/library-panel";
import { ProviderSelector, type ProviderId, recommendProvider } from "@/components/provider-selector";
import { PaletteEditor } from "@/components/PaletteEditor";
import { GameStateSelector } from "@/components/GameStateSelector";
import { O8IdentityPanel } from "@/components/o8-identity-panel";
type BriefMode = "sound" | "song" | "stem" | "catalog" | "album";
import { ReferencePanel, type ReferenceClip, readFileAsBase64 } from "@/components/studio/reference-panel";
import { OutputPanel } from "@/components/studio/output-panel";
import type { AudioReferencePayload, SoundGeneration, SoundCategory, GameState } from "@/types";
import { uuid, generateSoundName } from "@/lib/utils";
import type { SoundPalette } from "@/lib/soundPalette";
import type { StemBundle } from "@/lib/stemGenerator";
import type { O8Identity, O8Provenance } from "@/lib/o8/types";
import { useKeyboardShortcuts, getShortcutsList } from "@/hooks/useKeyboardShortcuts";
import { useTheme } from "@/hooks/useTheme";
import { useGenerationHistory } from "@/hooks/useGenerationHistory";
import { usePresets, type GenerationPreset, type ChainRecipe, type ChainStep } from "@/hooks/usePresets";
import { PresetsPanel } from "@/components/presets-panel";
import { ProfileDropdown } from "@/components/studio/profile-dropdown";
import { TrainingPanel } from "@/components/studio/training-panel";
import { LoraSelector, type LoraSelection } from "@/components/studio/lora-selector";
import { RemixPanel, type RemixFile, type RemixEngineId, type StereoMode, type VampnetMode, type TransplantCodebooks } from "@/components/studio/remix-panel";
import { useSessionPersistence, type SessionSettings } from "@/hooks/useSessionPersistence";

type AppMode = "generate" | "game-audio" | "library" | "training";

const DEFAULT_PARAMETERS = {
  type: "FX" as SoundCategory,
  moodTags: ["Futuristic"],
  lengthSeconds: 10,
  intensity: 60,
  texture: 45,
  brightness: 0,
  noisiness: 0.1,
  bpm: 110,
  key: "D Minor",
  seed: 128,
};

const LENGTH_PRESETS = [5, 12, 30, 60];

export default function Home() {
  const [mode, setMode] = useState<AppMode>("generate");
  const [briefMode, setBriefMode] = useState<BriefMode>("sound");
  const [prompt, setPrompt] = useState("");
  const [currentSound, setCurrentSound] = useState<SoundGeneration | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>("replicate");
  const [lengthSeconds, setLengthSeconds] = useState(DEFAULT_PARAMETERS.lengthSeconds);
  const [providerPinned, setProviderPinned] = useState(false);
  const [referenceClips, setReferenceClips] = useState<ReferenceClip[]>([]);
  const [dataProtected, setDataProtected] = useState(true);
  const [selectedLora, setSelectedLora] = useState<LoraSelection | null>(null);
  const [remixFile, setRemixFile] = useState<RemixFile | null>(null);
  const [remixStrength, setRemixStrength] = useState(0.5);
  const [remixEngine, setRemixEngine] = useState<RemixEngineId>("stable-audio");
  const [vampnetPeriodicPrompt, setVampnetPeriodicPrompt] = useState(7);
  const [vampnetUpperCodebookMask, setVampnetUpperCodebookMask] = useState(3);
  const [vampnetOnsetMaskWidth, setVampnetOnsetMaskWidth] = useState(0);
  const [vampnetTemperature, setVampnetTemperature] = useState(1.0);
  const [vampnetFeedbackSteps, setVampnetFeedbackSteps] = useState(1);
  const [vampnetStereoMode, setVampnetStereoMode] = useState<StereoMode>("mid-side");
  const [dryWet, setDryWet] = useState(100);
  const [spectralMatch, setSpectralMatch] = useState(false);
  const [normalizeLoudness, setNormalizeLoudness] = useState(true);
  const [compressEnabled, setCompressEnabled] = useState(false);
  const [hpssEnabled, setHpssEnabled] = useState(false);
  const [demucsStems, setDemucsStems] = useState<string[]>([]);
  const [enhanceEnabled, setEnhanceEnabled] = useState(false);
  const [magnetTemperature, setMagnetTemperature] = useState(3.0);
  const [magnetTopK, setMagnetTopK] = useState(250);
  const [referenceFile, setReferenceFile] = useState<RemixFile | null>(null);
  const [vampnetMode, setVampnetMode] = useState<VampnetMode>("full");
  const [inpaintStart, setInpaintStart] = useState(0);
  const [inpaintEnd, setInpaintEnd] = useState(0);
  const [donorFile, setDonorFile] = useState<RemixFile | null>(null);
  const [transplantCodebooks, setTransplantCodebooks] = useState<TransplantCodebooks>("low");

  // ── Session persistence ──
  const getSettings = useCallback((): SessionSettings => ({
    prompt,
    lengthSeconds,
    remixEngine,
    remixStrength,
    vampnetPeriodicPrompt,
    vampnetUpperCodebookMask,
    vampnetOnsetMaskWidth,
    vampnetTemperature,
    vampnetFeedbackSteps,
    vampnetStereoMode,
    vampnetMode,
    inpaintStart,
    inpaintEnd,
    transplantCodebooks,
    dryWet,
    spectralMatch,
    normalizeLoudness,
    hpssEnabled,
    demucsStems,
    enhanceEnabled,
    compressEnabled,
    magnetTemperature,
    magnetTopK,
  }), [prompt, lengthSeconds, remixEngine, remixStrength, vampnetPeriodicPrompt, vampnetUpperCodebookMask, vampnetOnsetMaskWidth, vampnetTemperature, vampnetFeedbackSteps, vampnetStereoMode, vampnetMode, inpaintStart, inpaintEnd, transplantCodebooks, dryWet, spectralMatch, normalizeLoudness, hpssEnabled, demucsStems, enhanceEnabled, compressEnabled, magnetTemperature, magnetTopK]);

  const applySettings = useCallback((s: SessionSettings) => {
    setPrompt(s.prompt);
    setLengthSeconds(s.lengthSeconds);
    setRemixEngine(s.remixEngine);
    setRemixStrength(s.remixStrength);
    setVampnetPeriodicPrompt(s.vampnetPeriodicPrompt);
    setVampnetUpperCodebookMask(s.vampnetUpperCodebookMask);
    setVampnetOnsetMaskWidth(s.vampnetOnsetMaskWidth);
    setVampnetTemperature(s.vampnetTemperature);
    setVampnetFeedbackSteps(s.vampnetFeedbackSteps);
    setVampnetStereoMode(s.vampnetStereoMode);
    if (s.vampnetMode != null) setVampnetMode(s.vampnetMode);
    if (s.inpaintStart != null) setInpaintStart(s.inpaintStart);
    if (s.inpaintEnd != null) setInpaintEnd(s.inpaintEnd);
    if (s.transplantCodebooks != null) setTransplantCodebooks(s.transplantCodebooks);
    setDryWet(s.dryWet);
    setSpectralMatch(s.spectralMatch);
    setNormalizeLoudness(s.normalizeLoudness);
    setHpssEnabled(s.hpssEnabled);
    setDemucsStems(s.demucsStems);
    setEnhanceEnabled(s.enhanceEnabled);
    if (s.compressEnabled != null) setCompressEnabled(s.compressEnabled);
    setMagnetTemperature(s.magnetTemperature);
    setMagnetTopK(s.magnetTopK);
  }, []);

  const { saveSettings, saveRemixFile, saveReferenceFile } = useSessionPersistence(
    getSettings,
    applySettings,
    setRemixFile,
    setReferenceFile,
  );

  // Auto-save settings on any change
  useEffect(() => { saveSettings(); }, [getSettings, saveSettings]);

  // Blue Ocean state
  const [selectedPalette, setSelectedPalette] = useState<SoundPalette | null>(null);
  const [selectedGameState, setSelectedGameState] = useState<GameState | null>(null);
  const [currentBundle, setCurrentBundle] = useState<StemBundle | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // o8 Identity state
  const [o8Identity, setO8Identity] = useState<O8Identity | null>(null);
  const [o8PromptModifier, setO8PromptModifier] = useState<string>("");
  const [currentProvenance, setCurrentProvenance] = useState<O8Provenance | null>(null);
  const [showStemExport, setShowStemExport] = useState(false);

  const handleIdentityChange = useCallback((identity: O8Identity | null, promptModifier: string) => {
    setO8Identity(identity);
    setO8PromptModifier(promptModifier);
  }, []);

  // Keyboard shortcuts state
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Theme
  const { toggleTheme } = useTheme();

  // Generation history
  const {
    history: generationHistory,
    currentIndex: historyIndex,
    addToHistory,
    canUndo,
    canRedo,
    undo,
    redo,
    goTo: goToHistory,
    clearHistory,
  } = useGenerationHistory();

  const handleUndo = useCallback(() => {
    const sound = undo();
    if (sound) setCurrentSound(sound);
  }, [undo]);

  const handleRedo = useCallback(() => {
    const sound = redo();
    if (sound) setCurrentSound(sound);
  }, [redo]);

  const handleHistorySelect = useCallback((index: number) => {
    const sound = goToHistory(index);
    if (sound) setCurrentSound(sound);
  }, [goToHistory]);

  // Presets
  const { presets, savePreset, deletePreset, chains, saveChain, deleteChain } = usePresets();

  const handleSavePreset = useCallback((name: string) => {
    savePreset({
      name,
      prompt,
      provider: selectedProvider,
      lengthSeconds,
      palette: selectedPalette,
      gameState: selectedGameState,
      // Sculpt params
      engine: remixEngine,
      strength: remixStrength,
      periodicPrompt: vampnetPeriodicPrompt,
      upperCodebookMask: vampnetUpperCodebookMask,
      onsetMaskWidth: vampnetOnsetMaskWidth,
      temperature: vampnetTemperature,
      feedbackSteps: vampnetFeedbackSteps,
      stereoMode: vampnetStereoMode,
      dryWet,
      spectralMatch,
      normalizeLoudness,
      hpssEnabled,
      demucsStems,
      enhanceEnabled,
      compressEnabled,
      magnetTemperature,
      magnetTopK,
      vampnetMode,
      transplantCodebooks,
    });
  }, [savePreset, prompt, selectedProvider, lengthSeconds, selectedPalette, selectedGameState, remixEngine, remixStrength, vampnetPeriodicPrompt, vampnetUpperCodebookMask, vampnetOnsetMaskWidth, vampnetTemperature, vampnetFeedbackSteps, vampnetStereoMode, dryWet, spectralMatch, normalizeLoudness, hpssEnabled, demucsStems, enhanceEnabled, compressEnabled, magnetTemperature, magnetTopK, vampnetMode, transplantCodebooks]);

  const handleLoadPreset = useCallback((preset: GenerationPreset) => {
    setPrompt(preset.prompt);
    setSelectedProvider(preset.provider as ProviderId);
    setLengthSeconds(preset.lengthSeconds);
    if (preset.palette) setSelectedPalette(preset.palette as SoundPalette);
    if (preset.gameState) setSelectedGameState(preset.gameState as GameState);
    // Restore sculpt params if present
    if (preset.engine != null) setRemixEngine(preset.engine);
    if (preset.strength != null) setRemixStrength(preset.strength);
    if (preset.periodicPrompt != null) setVampnetPeriodicPrompt(preset.periodicPrompt);
    if (preset.upperCodebookMask != null) setVampnetUpperCodebookMask(preset.upperCodebookMask);
    if (preset.onsetMaskWidth != null) setVampnetOnsetMaskWidth(preset.onsetMaskWidth);
    if (preset.temperature != null) setVampnetTemperature(preset.temperature);
    if (preset.feedbackSteps != null) setVampnetFeedbackSteps(preset.feedbackSteps);
    if (preset.stereoMode != null) setVampnetStereoMode(preset.stereoMode);
    if (preset.dryWet != null) setDryWet(preset.dryWet);
    if (preset.spectralMatch != null) setSpectralMatch(preset.spectralMatch);
    if (preset.normalizeLoudness != null) setNormalizeLoudness(preset.normalizeLoudness);
    if (preset.hpssEnabled != null) setHpssEnabled(preset.hpssEnabled);
    if (preset.demucsStems != null) setDemucsStems(preset.demucsStems);
    if (preset.enhanceEnabled != null) setEnhanceEnabled(preset.enhanceEnabled);
    if (preset.compressEnabled != null) setCompressEnabled(preset.compressEnabled);
    if (preset.magnetTemperature != null) setMagnetTemperature(preset.magnetTemperature);
    if (preset.magnetTopK != null) setMagnetTopK(preset.magnetTopK);
    if (preset.vampnetMode != null) setVampnetMode(preset.vampnetMode);
    if (preset.transplantCodebooks != null) setTransplantCodebooks(preset.transplantCodebooks);
  }, []);

  const toast = useCallback((message: string, tone: ToastItem["tone"] = "neutral") => {
    const id = uuid();
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 4000);
  }, []);

  const serializeReferencePayloads = useCallback(async (): Promise<AudioReferencePayload[]> => {
    if (!referenceClips.length) return [];
    return Promise.all(
      referenceClips.map(async (clip) => ({
        id: clip.id,
        name: clip.name,
        mimeType: clip.type || "audio/mpeg",
        size: clip.size,
        data: await readFileAsBase64(clip.file),
      })),
    );
  }, [referenceClips]);

  const recommendedProvider = useMemo(() => {
    return recommendProvider(prompt, referenceClips.length > 0, lengthSeconds);
  }, [prompt, referenceClips.length, lengthSeconds]);

  useEffect(() => {
    if (!providerPinned && recommendedProvider && selectedProvider !== recommendedProvider) {
      setSelectedProvider(recommendedProvider);
    }
  }, [providerPinned, recommendedProvider, selectedProvider]);

  const handleProviderChange = useCallback((provider: ProviderId) => {
    setProviderPinned(true);
    setSelectedProvider(provider);
  }, []);

  // Wrap file setters to also persist to IndexedDB
  const handleRemixFileChange = useCallback((f: RemixFile | null) => {
    setRemixFile(f);
    saveRemixFile(f);
  }, [saveRemixFile]);

  const handleReferenceFileChange = useCallback((f: RemixFile | null) => {
    setReferenceFile(f);
    saveReferenceFile(f);
  }, [saveReferenceFile]);

  const handleReSculpt = useCallback(async (audioUrl: string, name: string) => {
    try {
      const response = await fetch(audioUrl);
      const blob = await response.blob();
      const file = new File([blob], `resculpt-${name}`, { type: blob.type || "audio/wav" });
      const previewUrl = URL.createObjectURL(file);
      handleRemixFileChange({ file, name: `resculpt-${name}`, size: blob.size, previewUrl });
      toast("Output loaded as input. Adjust settings and sculpt again.", "success");
    } catch {
      toast("Failed to load output as input.", "error");
    }
  }, [handleRemixFileChange, toast]);

  const handleInpaintRangeChange = useCallback((start: number, end: number) => {
    setInpaintStart(start);
    setInpaintEnd(end);
  }, []);

  const handleDonorFileChange = useCallback((f: RemixFile | null) => {
    setDonorFile(f);
  }, []);

  // Chain execution: load step 1 settings, user generates, re-sculpts, loads step 2, etc.
  const [activeChain, setActiveChain] = useState<{ chain: ChainRecipe; stepIndex: number; soundIdAtStart: string | null } | null>(null);

  const handleRunChain = useCallback((chain: ChainRecipe) => {
    if (!remixFile) {
      toast("Load an audio file first, then run the chain.", "error");
      return;
    }
    // Load first step's settings
    const firstStep = chain.steps[0];
    const preset = presets.find((p) => p.id === firstStep?.presetId);
    if (!preset) {
      toast("Chain step 1 preset not found.", "error");
      return;
    }
    handleLoadPreset(preset);
    setActiveChain({ chain, stepIndex: 0, soundIdAtStart: currentSound?.id ?? null });
    toast(`Chain "${chain.name}" — Step 1/${chain.steps.length}: ${preset.name}. Generate to continue.`, "neutral");
  }, [remixFile, presets, handleLoadPreset, toast]);

  // Advance chain after generation completes
  useEffect(() => {
    if (!activeChain || isGenerating || !currentSound || currentSound.status !== "ready") return;
    // Only advance when a NEW generation has completed (not the one that was already there)
    if (currentSound.id === activeChain.soundIdAtStart) return;

    const { chain, stepIndex } = activeChain;
    const nextIndex = stepIndex + 1;

    if (nextIndex >= chain.steps.length) {
      // Chain complete
      toast(`Chain "${chain.name}" complete!`, "success");
      setActiveChain(null);
      return;
    }

    // Auto re-sculpt and load next step
    const nextStep = chain.steps[nextIndex];
    const nextPreset = presets.find((p) => p.id === nextStep?.presetId);
    if (!nextPreset || !currentSound.audioUrl) {
      setActiveChain(null);
      return;
    }

    // Feed output back as input
    handleReSculpt(currentSound.audioUrl, currentSound.name).then(() => {
      handleLoadPreset(nextPreset);
      setActiveChain({ chain, stepIndex: nextIndex, soundIdAtStart: currentSound.id });
      toast(`Chain — Step ${nextIndex + 1}/${chain.steps.length}: ${nextPreset.name}. Generate to continue.`, "neutral");
    });
  }, [activeChain, isGenerating, currentSound?.status, currentSound?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-switch sculpt engine to Diffusion when a LoRA is selected (LoRAs are incompatible with VampNet)
  useEffect(() => {
    if (selectedLora && remixFile && remixEngine === "vampnet") {
      setRemixEngine("stable-audio");
    }
  }, [selectedLora, remixFile, remixEngine]);

  const resetProviderToAuto = useCallback(() => {
    setProviderPinned(false);
    if (recommendedProvider) {
      setSelectedProvider(recommendedProvider);
    }
  }, [recommendedProvider]);

  const saveToLibrary = async () => {
    if (!currentSound || currentSound.status !== "ready") {
      toast("No sound to save. Generate a sound first.", "error");
      return;
    }
    try {
      const response = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentSound),
      });
      if (!response.ok) throw new Error("Failed to save to library");
      toast("Saved to library.", "success");
    } catch {
      toast("Failed to save to library.", "error");
    }
  };

  const submitFeedback = useCallback(async (rating: -1 | 1, comment: string) => {
    if (!currentSound) return;
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generation_id: currentSound.id,
          engine: remixFile ? remixEngine : "generate",
          parameters: {
            prompt,
            engine: remixEngine,
            ...(remixEngine === "vampnet" ? {
              periodic_prompt: vampnetPeriodicPrompt,
              temperature: vampnetTemperature,
              onset_mask_width: vampnetOnsetMaskWidth,
              dry_wet: dryWet,
              spectral_match: spectralMatch,
            } : remixEngine === "magnet" ? {
              magnet_temperature: magnetTemperature,
              magnet_top_k: magnetTopK,
            } : {
              strength: remixStrength,
            }),
          },
          rating,
          comment,
        }),
      });
    } catch {
      // Non-critical — don't toast on feedback failure
    }
  }, [currentSound, remixFile, remixEngine, prompt, vampnetPeriodicPrompt, vampnetTemperature, vampnetOnsetMaskWidth, dryWet, spectralMatch, magnetTemperature, magnetTopK, remixStrength]);

  const runGeneration = async () => {
    if (isGenerating) {
      toast("Generation in progress.", "neutral");
      return;
    }

    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      toast("Enter a brief to generate.", "error");
      return;
    }

    const fullPrompt = o8PromptModifier
      ? `${trimmedPrompt}. Style: ${o8PromptModifier}`
      : trimmedPrompt;

    const seedValue = DEFAULT_PARAMETERS.seed ?? Math.floor(Math.random() * 1000);
    const requestParameters = { ...DEFAULT_PARAMETERS, lengthSeconds, seed: seedValue };
    const pendingSound: SoundGeneration = {
      id: uuid(),
      name: generateSoundName(trimmedPrompt),
      prompt: fullPrompt,
      createdAt: new Date().toISOString(),
      audioUrl: null,
      status: "pending",
      ...requestParameters,
    };

    // Warn if transplant mode but no donor file
    if (remixFile && remixEngine === "vampnet" && vampnetMode === "transplant" && !donorFile) {
      toast("No donor audio loaded. Running normal VampNet sculpt.", "neutral");
    }

    setCurrentSound(pendingSound);
    setIsGenerating(true);

    try {
      let data: { audioUrl: string; provenanceCid?: string };

      if (remixFile) {
        // Remix: encrypt audio -> POST to /api/remix -> get remixed audio back
        const { readFileAsBase64 } = await import("@/components/studio/reference-panel");
        const audioB64 = await readFileAsBase64(remixFile.file);

        // Build optional payloads
        const donorPayload = (remixEngine === "vampnet" && vampnetMode === "transplant" && donorFile)
          ? { donor_b64: await readFileAsBase64(donorFile.file), transplant: true, transplant_codebooks: transplantCodebooks }
          : {};
        const inpaintPayload = (remixEngine === "vampnet" && vampnetMode === "inpaint" && (inpaintStart > 0 || inpaintEnd > 0))
          ? { inpaint_start: inpaintStart, inpaint_end: inpaintEnd }
          : {};

        const response = await fetch("/api/remix", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audio_b64: audioB64,
            original_name: remixFile.name,
            prompt: fullPrompt,
            strength: remixStrength,
            duration_seconds: lengthSeconds,
            seed: seedValue,
            lora_job_id: selectedLora?.id,
            engine: remixEngine,
            periodic_prompt: vampnetPeriodicPrompt,
            upper_codebook_mask: vampnetUpperCodebookMask,
            onset_mask_width: vampnetOnsetMaskWidth,
            temperature: vampnetTemperature,
            feedback_steps: vampnetFeedbackSteps,
            stereo_mode: vampnetStereoMode,
            dry_wet: dryWet / 100,
            spectral_match: spectralMatch,
            normalize_loudness: normalizeLoudness,
            hpss: hpssEnabled,
            demucs_stems: demucsStems.join(","),
            enhance: enhanceEnabled,
            compress: compressEnabled,
            magnet_temperature: magnetTemperature,
            magnet_top_k: magnetTopK,
            ...(referenceFile ? { reference_b64: await readFileAsBase64(referenceFile.file) } : {}),
            ...inpaintPayload,
            ...donorPayload,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error ?? "Remix failed");
        }

        data = await response.json();
      } else if (selectedLora) {
        // Use LoRA generation endpoint
        const response = await fetch("/api/generate-lora", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            job_id: selectedLora.id,
            prompt: fullPrompt,
            duration_seconds: lengthSeconds,
            seed: seedValue,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error ?? "LoRA generation failed");
        }

        data = await response.json();
      } else {
        // Standard generation
        const referencePayloads = await serializeReferencePayloads();
        const response = await fetch("/api/generate-sound", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: trimmedPrompt,
            brief_mode: briefMode,
            parameters: requestParameters,
            provider: selectedProvider,
            references: referencePayloads,
            palette: selectedPalette,
            gameState: selectedGameState,
            data_protection: dataProtected,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error ?? "Generation failed");
        }

        data = await response.json();
      }

      const completedSound: SoundGeneration = {
        ...pendingSound,
        audioUrl: data.audioUrl,
        status: "ready" as const,
        provenanceCid: data.provenanceCid,
        ...(selectedLora ? { loraId: selectedLora.id, loraName: selectedLora.name } : {}),
        ...(remixFile ? { remixSourceName: remixFile.name, remixStrength, remixEngine } : {}),
      };
      setCurrentSound(completedSound);
      addToHistory(completedSound);

      // Auto-save to library
      fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(completedSound),
      }).catch(() => {});

      toast(remixFile ? "Sculpt complete." : "Generation complete.", "success");
    } catch (error) {
      setCurrentSound((prev) =>
        prev ? { ...prev, status: "error", errorMessage: error instanceof Error ? error.message : "Unknown error." } : prev
      );
      toast("Generation failed.", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const runGameAudioGeneration = async () => {
    if (isGenerating) {
      toast("Generation in progress.", "neutral");
      return;
    }
    if (!selectedGameState) {
      toast("Select a game state.", "error");
      return;
    }

    setIsGenerating(true);
    setCurrentBundle(null);

    try {
      const response = await fetch("/api/generate-game-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameState: selectedGameState,
          palette: selectedPalette,
          duration: lengthSeconds,
          bpm: DEFAULT_PARAMETERS.bpm,
          key: DEFAULT_PARAMETERS.key,
          basePrompt: prompt.trim() || undefined,
          provider: selectedProvider,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error ?? "Generation failed");
      }

      const data = await response.json();
      if (data.success && data.bundle) {
        setCurrentBundle(data.bundle);
        toast(`Generated ${data.bundle.stems.length} stems.`, "success");
      } else {
        throw new Error(data.error || "Unknown error");
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : "Generation failed.", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  // Keyboard shortcuts
  const shortcuts = useMemo(
    () => [
      {
        key: "g",
        description: "Generate sound",
        action: () => {
          if (mode === "generate") runGeneration();
          else if (mode === "game-audio") runGameAudioGeneration();
        },
      },
      {
        key: "s",
        ctrl: true,
        description: "Save to library",
        action: () => {
          if (currentSound?.status === "ready") saveToLibrary();
        },
      },
      { key: "1", description: "Generate mode", action: () => setMode("generate") },
      { key: "2", description: "Game Audio mode", action: () => setMode("game-audio") },
      { key: "3", description: "Library", action: () => setMode("library") },
      { key: "4", description: "Training", action: () => setMode("training") },
      { key: "?", description: "Keyboard shortcuts", action: () => setShowShortcuts((p) => !p) },
      { key: "d", description: "Toggle dark mode", action: toggleTheme },
      { key: "z", ctrl: true, description: "Undo", action: handleUndo },
      { key: "z", ctrl: true, shift: true, description: "Redo", action: handleRedo },
      { key: "Escape", description: "Close dialogs", action: () => { setShowShortcuts(false); setShowStemExport(false); } },
    ],
    [mode, currentSound?.status, toggleTheme, handleUndo, handleRedo]
  );

  useKeyboardShortcuts(shortcuts);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-black border-r border-white/[0.06] flex flex-col z-30">
        <div className="p-6 border-b border-white/[0.06]">
          <span className="text-sm font-display font-normal text-white tracking-wide">
            Swanblade
          </span>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {(["generate", "game-audio", "library", "training"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setMode(tab)}
              className={`block w-full text-left px-4 py-2.5 text-sm tracking-wide transition-all duration-300 ${
                mode === tab
                  ? "text-white"
                  : "text-gray-600 hover:text-gray-300"
              }`}
            >
              {tab === "game-audio" ? "Game Audio" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-white/[0.06]">
          <div className="px-4 py-3 text-xs text-gray-600">
            Press <kbd className="px-1 border border-white/[0.06] text-gray-500">?</kbd> for shortcuts
          </div>
        </div>
      </aside>

      {/* Header */}
      <header className="fixed top-0 left-64 right-0 h-16 bg-black border-b border-white/[0.06] flex items-center px-6 z-20">
        <div className="relative w-96 flex items-center">
          <svg className="absolute left-3 w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5" />
            <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="Search sounds..."
            className="w-full h-10 pl-10 pr-4 bg-black border border-white/[0.06] text-white text-sm font-light placeholder:text-gray-500 focus:outline-none focus:border-white/[0.12] transition-all duration-200"
          />
        </div>
        <div className="ml-auto flex items-center gap-4">
          <button
            onClick={() => setShowShortcuts(true)}
            className="flex items-center justify-center w-10 h-10 text-gray-500 hover:text-white transition-colors"
            title="Keyboard shortcuts"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M6 16h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <ProfileDropdown />
        </div>
      </header>

      {/* Main Content */}
      <main className="ml-64 pt-20 min-h-screen px-8 pb-12">
        {mode === "training" ? (
          <>
            <p className="text-sm text-white mb-4">Training</p>
            <div className="max-w-xl">
              <TrainingPanel onToast={toast} />
            </div>
          </>
        ) : mode === "library" ? (
          <>
            <p className="text-sm text-white mb-4">Library</p>
            <LibraryPanel />
          </>
        ) : mode === "game-audio" ? (
          <GameAudioView
            prompt={prompt}
            onPromptChange={setPrompt}
            isGenerating={isGenerating}
            lengthSeconds={lengthSeconds}
            onLengthChange={setLengthSeconds}
            selectedProvider={selectedProvider}
            onProviderChange={handleProviderChange}
            providerPinned={providerPinned}
            recommendedProvider={recommendedProvider}
            onResetProviderAuto={providerPinned ? resetProviderToAuto : undefined}
            selectedPalette={selectedPalette}
            onPaletteChange={setSelectedPalette}
            selectedGameState={selectedGameState}
            onGameStateChange={setSelectedGameState}
            currentBundle={currentBundle}
            o8Identity={o8Identity}
            onIdentityChange={handleIdentityChange}
            onGenerate={runGameAudioGeneration}
            onToast={toast}
          />
        ) : (
          <>
            <p className="text-sm text-white/40 mb-4">Studio</p>
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Left: Instrument */}
              <div className="space-y-4">
                {/* 1. AUDIO INPUT — hero position */}
                <RemixPanel
                  file={remixFile}
                  onFileChange={handleRemixFileChange}
                  strength={remixStrength}
                  onStrengthChange={setRemixStrength}
                  engine={remixEngine}
                  onEngineChange={setRemixEngine}
                  periodicPrompt={vampnetPeriodicPrompt}
                  onPeriodicPromptChange={setVampnetPeriodicPrompt}
                  upperCodebookMask={vampnetUpperCodebookMask}
                  onUpperCodebookMaskChange={setVampnetUpperCodebookMask}
                  onsetMaskWidth={vampnetOnsetMaskWidth}
                  onOnsetMaskWidthChange={setVampnetOnsetMaskWidth}
                  temperature={vampnetTemperature}
                  onTemperatureChange={setVampnetTemperature}
                  feedbackSteps={vampnetFeedbackSteps}
                  onFeedbackStepsChange={setVampnetFeedbackSteps}
                  stereoMode={vampnetStereoMode}
                  onStereoModeChange={setVampnetStereoMode}
                  dryWet={dryWet}
                  onDryWetChange={setDryWet}
                  spectralMatch={spectralMatch}
                  onSpectralMatchChange={setSpectralMatch}
                  normalizeLoudness={normalizeLoudness}
                  onNormalizeLoudnessChange={setNormalizeLoudness}
                  hpssEnabled={hpssEnabled}
                  onHpssChange={setHpssEnabled}
                  demucsStems={demucsStems}
                  onDemucsStemsChange={setDemucsStems}
                  enhanceEnabled={enhanceEnabled}
                  onEnhanceChange={setEnhanceEnabled}
                  compressEnabled={compressEnabled}
                  onCompressChange={setCompressEnabled}
                  magnetTemperature={magnetTemperature}
                  onMagnetTemperatureChange={setMagnetTemperature}
                  magnetTopK={magnetTopK}
                  onMagnetTopKChange={setMagnetTopK}
                  referenceFile={referenceFile}
                  onReferenceFileChange={handleReferenceFileChange}
                  onToast={toast}
                  vampnetMode={vampnetMode}
                  onVampnetModeChange={setVampnetMode}
                  inpaintStart={inpaintStart}
                  inpaintEnd={inpaintEnd}
                  onInpaintRangeChange={handleInpaintRangeChange}
                  donorFile={donorFile}
                  onDonorFileChange={handleDonorFileChange}
                  transplantCodebooks={transplantCodebooks}
                  onTransplantCodebooksChange={setTransplantCodebooks}
                />

                {/* 2. DURATION */}
                <div className="bg-black border border-white/[0.06] p-5">
                  <p className="text-[11px] text-gray-500 mb-2">Duration</p>
                  <div className="flex flex-wrap gap-1.5">
                    {LENGTH_PRESETS.map((value) => (
                      <button
                        key={value}
                        onClick={() => setLengthSeconds(value)}
                        className={`px-3 py-1 text-[11px] border transition ${
                          lengthSeconds === value
                            ? "border-white/20 bg-white/[0.06] text-white"
                            : "border-white/[0.04] text-gray-600 hover:text-gray-400"
                        }`}
                      >
                        {value < 60 ? `${value}s` : `${value / 60}m`}
                      </button>
                    ))}
                    <div className="flex items-center border border-white/[0.04] px-2 py-1">
                      <input
                        type="number"
                        min={2}
                        max={120}
                        value={lengthSeconds}
                        onChange={(e) => setLengthSeconds(Math.max(2, Math.min(120, Number(e.target.value))))}
                        className="w-10 bg-transparent text-center text-[11px] text-white focus:outline-none"
                      />
                      <span className="text-[11px] text-gray-600">s</span>
                    </div>
                  </div>
                </div>

                {/* 3. CONTEXT — text input + provider */}
                <div className="bg-black border border-white/[0.06] p-5">
                  <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe context..."
                    disabled={isGenerating}
                    style={{ backgroundColor: "#0a0a0a" }}
                    className="w-full bg-[#0a0a0a] border border-white/[0.04] px-3 py-2 text-[11px] text-white placeholder:text-gray-600 focus:outline-none focus:border-white/20 transition"
                  />
                  <div className="mt-3">
                    <ProviderSelector
                      value={selectedProvider}
                      onChange={handleProviderChange}
                      prompt={prompt}
                      recommendation={recommendedProvider}
                      isAuto={!providerPinned}
                      onResetAuto={providerPinned ? resetProviderToAuto : undefined}
                      durationSeconds={lengthSeconds}
                      hasReferences={referenceClips.length > 0}
                      sculptActive={!!remixFile}
                    />
                  </div>
                </div>

                {/* 4. ADVANCED — collapsed */}
                <div className="bg-black border border-white/[0.06]">
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="w-full flex items-center justify-between p-5 text-[11px] text-gray-500 hover:text-gray-400 transition"
                  >
                    <span>Advanced</span>
                    <span>{showAdvanced ? "−" : "+"}</span>
                  </button>

                  {showAdvanced && (
                    <div className="px-5 pb-5 space-y-4 border-t border-white/[0.06] pt-4">
                      <LoraSelector
                        value={selectedLora}
                        onChange={setSelectedLora}
                      />
                      <ReferencePanel
                        clips={referenceClips}
                        onClipsChange={setReferenceClips}
                        dataProtected={dataProtected}
                        onDataProtectedChange={setDataProtected}
                        onToast={toast}
                      />
                      <PresetsPanel
                        presets={presets}
                        onSelect={handleLoadPreset}
                        onSave={handleSavePreset}
                        onDelete={deletePreset}
                        chains={chains}
                        onSaveChain={saveChain}
                        onDeleteChain={deleteChain}
                        onRunChain={handleRunChain}
                        className="bg-black border border-white/[0.06]"
                      />
                      <O8IdentityPanel
                        onIdentityChange={handleIdentityChange}
                        className="bg-black border border-white/[0.06]"
                      />
                      <div>
                        <p className="text-[11px] text-gray-500 mb-2">Sound Palette</p>
                        <PaletteEditor value={selectedPalette} onChange={setSelectedPalette} />
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-500 mb-2">Game State</p>
                        <GameStateSelector value={selectedGameState} onChange={setSelectedGameState} showDetails={false} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Active config tags */}
                {(selectedPalette || selectedGameState || selectedLora) && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedLora && (
                      <span className={`border px-2 py-1 text-[10px] ${
                        remixFile && remixEngine === "vampnet"
                          ? "border-white/[0.04] text-gray-600 line-through"
                          : "border-white/[0.08] text-gray-400"
                      }`}>
                        {selectedLora.name}{remixFile && remixEngine === "vampnet" ? " (n/a)" : ""}
                      </span>
                    )}
                    {selectedPalette && (
                      <span className="border border-white/[0.06] px-2 py-1 text-[10px] text-gray-500">
                        {selectedPalette.name}
                      </span>
                    )}
                    {selectedGameState && (
                      <span className="border border-white/[0.06] px-2 py-1 text-[10px] text-gray-500 capitalize">
                        {selectedGameState}
                      </span>
                    )}
                  </div>
                )}

                {/* 5. GENERATE BUTTON */}
                <button
                  onClick={runGeneration}
                  disabled={isGenerating}
                  className="w-full py-3 text-xs tracking-wide text-white border border-white/20 hover:bg-white hover:text-black transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isGenerating
                    ? (remixFile ? "Sculpting..." : "Generating...")
                    : remixFile
                      ? "Sculpt"
                      : selectedLora ? "Generate with LoRA" : "Generate"}
                </button>
              </div>

              {/* Right: Output */}
              <OutputPanel
                currentSound={currentSound}
                isGenerating={isGenerating}
                selectedProvider={selectedProvider}
                o8Identity={o8Identity}
                currentProvenance={currentProvenance}
                onProvenanceStamped={(prov) => {
                  setCurrentProvenance(prov);
                  toast("Audio stamped with provenance.", "success");
                }}
                onSaveToLibrary={saveToLibrary}
                showStemExport={showStemExport}
                onToggleStemExport={() => setShowStemExport(!showStemExport)}
                onStemExported={(config) => {
                  toast(`Exported ${config.stems.length} stems to Burn the Square.`, "success");
                  setShowStemExport(false);
                }}
                canUndo={canUndo}
                canRedo={canRedo}
                onUndo={handleUndo}
                onRedo={handleRedo}
                history={generationHistory}
                historyIndex={historyIndex}
                onHistorySelect={handleHistorySelect}
                onClearHistory={clearHistory}
                onFeedback={submitFeedback}
                onReSculpt={handleReSculpt}
                originalAudioUrl={remixFile?.previewUrl}
              />
            </div>
          </>
        )}
      </main>

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="bg-black border border-white/[0.06] p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-medium text-white">Shortcuts</h3>
              <button onClick={() => setShowShortcuts(false)} className="text-gray-500 hover:text-white">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="space-y-2">
              {getShortcutsList(shortcuts).map(({ key, description }) => (
                <div key={key} className="flex items-center justify-between py-2 border-b border-white/[0.06] last:border-b-0">
                  <span className="text-sm font-light text-gray-400">{description}</span>
                  <kbd className="px-2 py-1 bg-black border border-white/[0.06] text-caption font-mono text-gray-300">{key}</kbd>
                </div>
              ))}
            </div>
            <p className="mt-4 text-caption text-gray-600 text-center">
              Press <kbd className="px-1 bg-black border border-white/[0.06] text-gray-400">?</kbd> anytime
            </p>
          </div>
        </div>
      )}

      <ToastStack items={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}

/* ─── Game Audio View (kept inline, it's tightly coupled to page state) ─── */

function GameAudioView({
  prompt,
  onPromptChange,
  isGenerating,
  lengthSeconds,
  onLengthChange,
  selectedProvider,
  onProviderChange,
  providerPinned,
  recommendedProvider,
  onResetProviderAuto,
  selectedPalette,
  onPaletteChange,
  selectedGameState,
  onGameStateChange,
  currentBundle,
  o8Identity,
  onIdentityChange,
  onGenerate,
  onToast,
}: {
  prompt: string;
  onPromptChange: (v: string) => void;
  isGenerating: boolean;
  lengthSeconds: number;
  onLengthChange: (v: number) => void;
  selectedProvider: ProviderId;
  onProviderChange: (v: ProviderId) => void;
  providerPinned: boolean;
  recommendedProvider: ProviderId | null;
  onResetProviderAuto?: () => void;
  selectedPalette: SoundPalette | null;
  onPaletteChange: (v: SoundPalette | null) => void;
  selectedGameState: GameState | null;
  onGameStateChange: (v: GameState | null) => void;
  currentBundle: StemBundle | null;
  o8Identity: O8Identity | null;
  onIdentityChange: (identity: O8Identity | null, promptModifier: string) => void;
  onGenerate: () => void;
  onToast: (message: string, tone?: "neutral" | "success" | "error") => void;
}) {
  return (
    <>
      <p className="text-sm text-white mb-4">Game Audio</p>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <O8IdentityPanel
            onIdentityChange={onIdentityChange}
            className="bg-black border border-white/[0.06]"
          />

          <div className="bg-black border border-white/[0.06] p-6">
            <p className="text-sm font-medium text-gray-400">Game State</p>
            <p className="mt-2 text-body-sm font-light text-gray-500">
              Generate coherent stem bundles for specific game contexts.
            </p>
            <div className="mt-4">
              <GameStateSelector value={selectedGameState} onChange={onGameStateChange} showDetails={true} />
            </div>
          </div>

          <div className="bg-black border border-white/[0.06] p-6">
            <p className="text-sm font-medium text-gray-400">Sound Palette</p>
            <p className="mt-2 text-body-sm font-light text-gray-500">
              Constrain generation to a consistent aesthetic.
            </p>
            <div className="mt-4">
              <PaletteEditor value={selectedPalette} onChange={onPaletteChange} />
            </div>
          </div>

          <div className="bg-black border border-white/[0.06] p-6">
            <p className="text-sm font-medium text-gray-400">Parameters</p>

            <div className="mt-4">
              <p className="text-body-sm font-light text-gray-500">Duration</p>
              <div className="mt-2 flex gap-2">
                {[15, 30, 60].map((value) => (
                  <button
                    key={value}
                    onClick={() => onLengthChange(value)}
                    className={`px-4 py-2 text-body-sm border transition ${
                      lengthSeconds === value
                        ? "border-white bg-white text-black"
                        : "border-white/[0.06] text-gray-500 hover:border-white hover:text-white"
                    }`}
                  >
                    {value}s
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <ProviderSelector
                value={selectedProvider}
                onChange={onProviderChange}
                prompt=""
                recommendation={recommendedProvider}
                isAuto={!providerPinned}
                onResetAuto={onResetProviderAuto}
                durationSeconds={lengthSeconds}
                hasReferences={false}
              />
            </div>

            <div className="mt-4">
              <p className="text-body-sm font-light text-gray-500">Style Direction (Optional)</p>
              <textarea
                className="w-full bg-black border-0 border-b border-white/[0.06] px-3 py-3 text-white font-light placeholder:text-gray-600 focus:outline-none focus:border-white/[0.12] transition-colors mt-2 resize-none"
                rows={2}
                placeholder="e.g., orchestral, epic, brass..."
                value={prompt}
                onChange={(e) => onPromptChange(e.target.value)}
                disabled={isGenerating}
              />
            </div>

            <div className="mt-6">
              <button
                onClick={onGenerate}
                disabled={isGenerating || !selectedGameState}
                className="w-full px-6 py-3 text-body-sm font-medium text-black bg-white hover:bg-gray-200 transition-colors duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isGenerating ? "Generating..." : "Generate Stem Bundle"}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Result */}
        <div className="bg-black border border-white/[0.06] p-6">
          <p className="text-sm font-medium text-gray-400">Output</p>

          {currentBundle ? (
            <div className="mt-4">
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <div>
                  <p className="text-sm font-medium capitalize text-white">{currentBundle.gameState} Bundle</p>
                  <p className="text-body-sm font-light text-gray-500">{currentBundle.stems.length} stems generated</p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {currentBundle.stems.map((stem) => (
                  <div key={stem.stemType} className="border border-white/[0.06] p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium capitalize">{stem.stemType}</p>
                        <p className="text-body-sm font-light text-gray-500">
                          {stem.duration}s · {stem.metadata.bpm} BPM
                          {stem.provenanceCid && " · Provenance verified"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2">
                      <audio controls src={stem.audioUrl} preload="metadata" controlsList="nodownload noplaybackrate" className="h-8 w-full" />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 border-t border-white/[0.06] pt-4">
                <p className="text-body-sm font-light text-gray-500">Bundle ID: {currentBundle.id}</p>
                <div className="mt-3">
                  {o8Identity ? (
                    <div className="flex items-center gap-2 text-[#66023C]">
                      <svg width="14" height="14" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="none" />
                        <path d="M8 12l2.5 2.5L16 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                      <span className="text-body-sm">Created by {o8Identity.creator.name}</span>
                    </div>
                  ) : (
                    <p className="text-body-sm font-light text-gray-500">Connect an ∞8 identity to stamp provenance</p>
                  )}
                </div>

                {currentBundle.stems.length > 0 && (
                  <button
                    onClick={() => onToast(`Exported ${currentBundle.stems.length} stems to Burn the Square.`, "success")}
                    className="mt-3 w-full border border-[#66023C] bg-[#66023C]/10 px-4 py-2 text-[#66023C] transition-colors hover:bg-[#66023C] hover:text-white"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      Export to Burn the Square
                    </span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-4 py-12 text-center">
              <p className="text-sm font-light text-gray-500">Select a game state and generate to create a stem bundle.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
