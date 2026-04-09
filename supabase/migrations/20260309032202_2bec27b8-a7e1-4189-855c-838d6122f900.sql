ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS source character varying NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS notes text;