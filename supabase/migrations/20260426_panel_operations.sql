-- ============================================================
-- Tenant Panel Operations
-- Connect requirements, study listings, incentives, and insight
-- closeout into one research-operations workflow.
-- ============================================================

ALTER TABLE public.requirements
  ADD COLUMN IF NOT EXISTS decision_needed TEXT,
  ADD COLUMN IF NOT EXISTS business_risk TEXT,
  ADD COLUMN IF NOT EXISTS success_decision TEXT,
  ADD COLUMN IF NOT EXISTS required_sample_size INTEGER,
  ADD COLUMN IF NOT EXISTS incentive_range_cents JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS linked_study_listing_ids UUID[] DEFAULT '{}';

ALTER TABLE public.study_listings
  ADD COLUMN IF NOT EXISTS linked_requirement_id UUID REFERENCES public.requirements(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS launch_readiness JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS recruitment_source TEXT DEFAULT 'marketplace_and_owned'
    CHECK (recruitment_source IN ('marketplace_and_owned','marketplace','owned_panel'));

CREATE INDEX IF NOT EXISTS idx_study_listings_requirement
  ON public.study_listings(linked_requirement_id);

CREATE INDEX IF NOT EXISTS idx_requirements_linked_studies
  ON public.requirements USING GIN(linked_study_listing_ids);
