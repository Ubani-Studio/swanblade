-- ============================================
-- ACE-STEP CANON LORA
-- ============================================
-- Extend model_type to include 'ace_step_lora': LoRA fine-tune of ACE-Step
-- 1.5 on the artist's opted-in 7-layer canon audio. Co-exists with the
-- existing 'lora' (Stable Audio) and 'rave' catalog training jobs.

ALTER TABLE public.training_jobs
  DROP CONSTRAINT IF EXISTS training_jobs_model_type_check;

ALTER TABLE public.training_jobs
  ADD CONSTRAINT training_jobs_model_type_check
    CHECK (model_type IN ('lora', 'rave', 'ace_step_lora'));

-- Optional per-run metadata: which dataset entries fed the training.
ALTER TABLE public.training_jobs
  ADD COLUMN IF NOT EXISTS source_entry_ids UUID[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS model_name TEXT DEFAULT NULL;
