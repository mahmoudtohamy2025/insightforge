ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS meeting_url text;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS summary text;