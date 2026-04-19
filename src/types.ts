export type SoundGenerationStatus = "pending" | "ready" | "error";

export type SoundCategory = "FX" | "Ambience" | "UI" | "Foley" | "Melody" | "Bass" | "Percussion";

export interface SoundGeneration {
  id: string;
  name: string;
  prompt: string;
  createdAt: string;
  type: SoundCategory;
  moodTags: string[];
  lengthSeconds: number;
  bpm?: number;
  key?: string;
  intensity: number;
  texture: number;
  brightness: number;
  noisiness: number;
  seed?: number;
  audioUrl: string | null;
  status: SoundGenerationStatus;
  errorMessage?: string;
  variantOfId?: string;
  // Sound World (LoRA)
  loraId?: string;
  loraName?: string;
  loraStrength?: number;
  // Remix
  remixSourceName?: string;
  remixStrength?: number;
  remixEngine?: string;
  // o8 Provenance
  provenanceCid?: string;
  identityId?: string;
  // 08 Protocol + C2PA (server-stamped)
  manifestId?: string;
  origin8Fingerprint?: string;
  signature?: string;
  privateCanon?: boolean;
  watermarkStatus?: "sidecar" | "embedded" | "pending";
  pipelineSteps?: Array<{
    stage: string;
    adapter: string;
    status: string;
    parameters?: Record<string, unknown>;
    elapsed_ms?: number;
  }>;
}

export interface AudioReferencePayload {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  data: string;
}

export interface GenerateSoundRequestBody {
  prompt: string;
  parameters: Omit<SoundGeneration, "id" | "name" | "prompt" | "createdAt" | "audioUrl" | "status" | "errorMessage" | "variantOfId">;
  references?: AudioReferencePayload[];
}

export interface GenerateSoundResponse {
  audioUrl: string;
  provenanceCid?: string;
}

// ==================== Sound DNA Types ====================

export interface SoundDNARef {
  id: string;
  name: string;
  bpm: number;
  key: string | null;
  energy: number;
  brightness: number;
  texture: number;
}

// ==================== Sound Lineage Types ====================

export interface SoundLineage {
  id: string;
  rootSoundId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  totalGenerations: number;
  totalVariations: number;
}

export interface LineageNode {
  soundId: string;
  parentId: string | null;
  lineageId: string;
  generation: number;
  variationType: VariationType;
  parameterShifts?: ParameterShift[];
  createdAt: string;
}

export type VariationType =
  | "root"
  | "parameter_shift"
  | "style_transfer"
  | "combine"
  | "evolve"
  | "mutate"
  | "remix";

export interface ParameterShift {
  parameter: "intensity" | "texture" | "brightness" | "noisiness" | "bpm";
  originalValue: number;
  newValue: number;
  shiftAmount: number;
}

export interface VariationRequest {
  parentSoundId: string;
  variationType: VariationType;
  count: number;
  parameterShifts?: Partial<Record<ParameterShift["parameter"], number>>;
  combineWithSoundId?: string;
  evolutionStrength?: number;
  mutationRate?: number;
  preserveCore?: boolean;
}

export interface VariationResult {
  sounds: SoundGeneration[];
  lineageId: string;
  generation: number;
}

// ==================== Sound Transform Types ====================

export interface TransformRequest {
  sourceAudioUrl: string;
  transformPrompt: string;
  preserveRhythm?: boolean;
  preservePitch?: boolean;
  preserveTimbre?: boolean;
  transformStrength?: number;
}

export interface TransformResult {
  audioUrl: string;
  provenanceCid?: string;
  transformApplied: string;
}

// ==================== Voice Fusion Types ====================

export type VoiceFusionType =
  | "creature"
  | "alien_language"
  | "effort"
  | "ambient_vocal"
  | "choir"
  | "processed";

export interface VoiceFusionRequest {
  type: VoiceFusionType;
  prompt: string;
  baseVoiceId?: string;
  creatureType?: string;
  emotionalIntensity?: number;
  alienLanguageParams?: {
    syllablePattern: string;
    tonality: "tonal" | "atonal" | "whispered";
  };
  effortType?: "attack" | "hit" | "jump" | "climb" | "death" | "custom";
  layerWithSound?: string;
  duration?: number;
}

export interface VoiceFusionResult {
  audioUrl: string;
  provenanceCid?: string;
  voiceMetadata: {
    type: VoiceFusionType;
    duration: number;
    layers?: string[];
  };
}
