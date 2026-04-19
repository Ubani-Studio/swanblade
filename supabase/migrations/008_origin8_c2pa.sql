-- ============================================
-- 08 PROTOCOL + C2PA PROVENANCE
-- ============================================
-- Spine schema for Origin 8 Protocol fingerprinting and C2PA manifests.
-- Every generation in Swanblade writes a provenance_manifests row; the sound
-- row then carries a fingerprint + manifest reference.

-- Sovereignty toggles on the profile
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS private_canon BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_training_opt_in BOOLEAN NOT NULL DEFAULT FALSE;

-- Provenance columns on sounds
ALTER TABLE public.sounds
  ADD COLUMN IF NOT EXISTS origin8_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS c2pa_manifest_id UUID,
  ADD COLUMN IF NOT EXISTS pipeline_steps JSONB,
  ADD COLUMN IF NOT EXISTS private_canon BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_training_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS watermark_status TEXT NOT NULL DEFAULT 'sidecar'
    CHECK (watermark_status IN ('sidecar', 'embedded', 'pending'));

CREATE INDEX IF NOT EXISTS idx_sounds_fingerprint ON public.sounds(origin8_fingerprint);

-- 7-layer dataset tagging on training jobs (scaffolding only; no enforcement yet)
ALTER TABLE public.training_jobs
  ADD COLUMN IF NOT EXISTS dataset_layer TEXT
    CHECK (dataset_layer IN (
      'vocal_canon',
      'paired_controls',
      'preference_rankings',
      'automatic_writing',
      'influence_corpus',
      'live_captures',
      'contextual_notes'
    ));

-- Provenance manifests: one row per signed C2PA manifest.
CREATE TABLE IF NOT EXISTS public.provenance_manifests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sound_id UUID REFERENCES public.sounds(id) ON DELETE SET NULL,

  -- 08 Protocol
  origin8_fingerprint TEXT NOT NULL,
  origin8_version TEXT NOT NULL DEFAULT 'origin8/0.1',
  watermark_status TEXT NOT NULL DEFAULT 'sidecar'
    CHECK (watermark_status IN ('sidecar', 'embedded', 'pending')),

  -- C2PA manifest (JSON body + HMAC signature)
  manifest JSONB NOT NULL,
  signature TEXT NOT NULL,
  signature_alg TEXT NOT NULL DEFAULT 'hmac-sha256',
  claim_generator TEXT NOT NULL DEFAULT 'swanblade/0.2',

  -- Pipeline provenance
  pipeline_steps JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Mode
  private_canon BOOLEAN NOT NULL DEFAULT FALSE,
  ai_training_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  content_type TEXT NOT NULL DEFAULT 'audio'
    CHECK (content_type IN ('audio', 'image', 'video')),

  -- Lifecycle
  revoked_at TIMESTAMPTZ,
  revoke_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manifests_user ON public.provenance_manifests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_manifests_sound ON public.provenance_manifests(sound_id);
CREATE INDEX IF NOT EXISTS idx_manifests_fingerprint ON public.provenance_manifests(origin8_fingerprint);

ALTER TABLE public.provenance_manifests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own manifests"
  ON public.provenance_manifests
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can revoke own manifests"
  ON public.provenance_manifests
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access"
  ON public.provenance_manifests
  FOR ALL
  USING (auth.role() = 'service_role');

-- Link sounds -> manifests (deferred FK added after table exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'sounds_c2pa_manifest_id_fkey'
  ) THEN
    ALTER TABLE public.sounds
      ADD CONSTRAINT sounds_c2pa_manifest_id_fkey
      FOREIGN KEY (c2pa_manifest_id)
      REFERENCES public.provenance_manifests(id)
      ON DELETE SET NULL;
  END IF;
END $$;
