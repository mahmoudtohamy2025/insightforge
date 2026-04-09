
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS objective text,
  ADD COLUMN IF NOT EXISTS methodology character varying NOT NULL DEFAULT 'qualitative',
  ADD COLUMN IF NOT EXISTS discussion_guide jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS screener_criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS target_participants integer,
  ADD COLUMN IF NOT EXISTS target_sessions integer,
  ADD COLUMN IF NOT EXISTS ai_plan jsonb,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.projects ALTER COLUMN status SET DEFAULT 'draft';
