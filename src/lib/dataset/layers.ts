export const DATASET_LAYERS = [
  "vocal_canon",
  "paired_controls",
  "preference_rankings",
  "automatic_writing",
  "influence_corpus",
  "live_captures",
  "contextual_notes",
] as const;

export type DatasetLayer = (typeof DATASET_LAYERS)[number];

export interface LayerMeta {
  key: DatasetLayer;
  title: string;
  purpose: string;
  accepts: Array<"text" | "audio" | "image">;
  placeholder: string;
}

export const LAYER_META: Record<DatasetLayer, LayerMeta> = {
  vocal_canon: {
    key: "vocal_canon",
    title: "Vocal canon",
    purpose: "Reference takes and stems that mark the allowed vocal universe.",
    accepts: ["audio", "text"],
    placeholder: "e.g. Lead take — hushed, low-mids forward, no vibrato.",
  },
  paired_controls: {
    key: "paired_controls",
    title: "Paired controls",
    purpose: "A/B pairs labelled with a single parameter contrast (brighter, softer, etc.).",
    accepts: ["audio", "text"],
    placeholder: "Axis + magnitude. e.g. brightness +0.6, everything else held.",
  },
  preference_rankings: {
    key: "preference_rankings",
    title: "Preference rankings",
    purpose: "Your thumbs on pairs or batches. Trains the taste reranker.",
    accepts: ["text"],
    placeholder: "Which of A / B / tie, and one sentence on why.",
  },
  automatic_writing: {
    key: "automatic_writing",
    title: "Automatic writing",
    purpose: "Stream-of-consciousness lyrics and prose — raw semantic material.",
    accepts: ["text"],
    placeholder: "No editing. Fragments fine. Mood > grammar.",
  },
  influence_corpus: {
    key: "influence_corpus",
    title: "Influence corpus",
    purpose: "External reference works and why they matter.",
    accepts: ["text", "image"],
    placeholder: "Artist — work — why. One specific quality, not a vibe.",
  },
  live_captures: {
    key: "live_captures",
    title: "Live captures",
    purpose: "Field recordings, rehearsal tapes, demos. Raw, unpolished.",
    accepts: ["audio", "text"],
    placeholder: "Where + when + what caught it.",
  },
  contextual_notes: {
    key: "contextual_notes",
    title: "Contextual notes",
    purpose: "Production notes, intent statements, creative briefs.",
    accepts: ["text"],
    placeholder: "What this record is trying to be. What it is not.",
  },
};
