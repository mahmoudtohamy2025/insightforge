-- B7 — persist the super-admin feature flags.
--
-- AdminSystem's 8 feature flags were local useState only (the page admitted
-- "connect to a platform_config table to persist"). This adds that table.

CREATE TABLE IF NOT EXISTS public.platform_config (
  key        TEXT PRIMARY KEY,
  enabled    BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;

-- Flags are non-sensitive booleans the app may read to gate features; allow read
-- broadly, restrict writes to super-admins.
DROP POLICY IF EXISTS platform_config_read ON public.platform_config;
CREATE POLICY platform_config_read ON public.platform_config
  FOR SELECT USING (true);

DROP POLICY IF EXISTS platform_config_super_admin_write ON public.platform_config;
CREATE POLICY platform_config_super_admin_write ON public.platform_config
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid()));

-- Seed the 8 flags (enabled by default; matches DEFAULT_FLAGS in AdminSystem.tsx).
INSERT INTO public.platform_config (key, enabled) VALUES
  ('ai_simulations', true),
  ('participant_portal', true),
  ('incentive_payouts', true),
  ('transactional_emails', true),
  ('segment_marketplace', true),
  ('data_export', true),
  ('white_label', true),
  ('api_access', true)
ON CONFLICT (key) DO NOTHING;
