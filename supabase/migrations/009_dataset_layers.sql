-- ============================================
-- 7-LAYER PRIVATE DATASET
-- ============================================
-- The private dataset is the moat: per-artist structured corpus that feeds
-- LoRA personalization and a future preference reranker. Seven layers:
--
--   vocal_canon          — reference takes / stems marking the "allowed"
--                          vocal universe for this artist
--   paired_controls      — A/B pairs with labelled parameter contrasts
--                          (e.g. "darker", "softer attack")
--   preference_rankings  — thumbs on pairs or batches; the reranker training
--                          signal
--   automatic_writing    — stream-of-consciousness lyrics / prose
--   influence_corpus     — external reference works + why they matter
--   live_captures        — field recordings, rehearsal tapes, demos
--   contextual_notes     — production notes, intent statements, creative briefs

CREATE TABLE IF NOT EXISTS public.dataset_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  layer TEXT NOT NULL
    CHECK (layer IN (
      'vocal_canon',
      'paired_controls',
      'preference_rankings',
      'automatic_writing',
      'influence_corpus',
      'live_captures',
      'contextual_notes'
    )),

  -- Flexible sub-type within a layer (e.g. 'lead', 'harmony' inside vocal_canon)
  kind TEXT,

  title TEXT NOT NULL,
  content_text TEXT,
  audio_url TEXT,
  image_url TEXT,

  -- Layer-specific structured data.
  -- paired_controls: { axis: "brightness", positive_ref: <id>, negative_ref: <id>, magnitude: 0..1 }
  -- preference_rankings: { pair_a: <id>, pair_b: <id>, winner: "a"|"b"|"tie", notes: string }
  -- influence_corpus: { artist: string, work: string, why: string, url?: string }
  data JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Provenance: link to a signed manifest if this entry carries audio.
  c2pa_manifest_id UUID REFERENCES public.provenance_manifests(id) ON DELETE SET NULL,

  -- Consent / lifecycle
  ai_training_opt_in BOOLEAN NOT NULL DEFAULT TRUE,
  archived BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dataset_user_layer ON public.dataset_entries(user_id, layer, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dataset_opt_in ON public.dataset_entries(user_id, ai_training_opt_in) WHERE ai_training_opt_in = TRUE;

ALTER TABLE public.dataset_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own dataset entries"
  ON public.dataset_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own dataset entries"
  ON public.dataset_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own dataset entries"
  ON public.dataset_entries FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own dataset entries"
  ON public.dataset_entries FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access"
  ON public.dataset_entries FOR ALL
  USING (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS dataset_entries_updated_at ON public.dataset_entries;
CREATE TRIGGER dataset_entries_updated_at
  BEFORE UPDATE ON public.dataset_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
