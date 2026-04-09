ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_visited_path text;