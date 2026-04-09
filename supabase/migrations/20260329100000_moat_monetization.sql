-- =====================================================
-- Phase 4D: Moat & Monetization 
-- 1. Audit Logs for SOC 2 Trust Center
-- 2. Marketplace modifications for segment_profiles
-- =====================================================

-- 1. Audit Logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),     -- Who performed the action (can be null if system)
  action TEXT NOT NULL,                        -- e.g., 'simulation_run', 'segment_created', 'data_exported', 'api_key_generated'
  resource_type TEXT NOT NULL,                 -- e.g., 'simulation', 'segment_profile', 'workspace_api_key'
  resource_id UUID,                            -- ID of the affected resource
  details JSONB,                               -- Any payload details (e.g. settings changed)
  ip_address TEXT,                             -- Tracked for SOC2
  user_agent TEXT,                             -- Tracked for SOC2
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_logs_workspace ON public.audit_logs(workspace_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);

-- Audit logs RLS: Only admins/owners can see them (or all workspace members depending on policy, let's limit to members and filter in UI)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_members_select_audit_logs" ON public.audit_logs
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "system_insert_audit_logs" ON public.audit_logs
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
    )
    OR
    user_id = auth.uid()
  );

-- No updates or deletes allowed on audit logs for compliance
-- (Though Supabase service role can bypass this if necessary)


-- 2. Modify segment_profiles for Marketplace & Industry Packs
ALTER TABLE public.segment_profiles
  ADD COLUMN is_published BOOLEAN DEFAULT false,    -- If true, available in public marketplace
  ADD COLUMN price_credits INTEGER DEFAULT 0,       -- How many credits it costs to clone
  ADD COLUMN downloads INTEGER DEFAULT 0,           -- Popularity metric
  ADD COLUMN industry TEXT;                         -- e.g., Healthcare, Fintech, FMCG (for packs)

-- Create a view for the public marketplace
CREATE OR REPLACE VIEW public.marketplace_segments AS
  SELECT 
    sp.id,
    sp.workspace_id as creator_workspace_id,
    w.name as creator_name,
    sp.name,
    sp.description,
    sp.avatar_url,
    sp.industry,
    sp.price_credits,
    sp.downloads,
    sp.calibration_score,
    sp.created_at,
    (sp.demographics->>'location') as location,
    (sp.demographics->>'age_range') as age_range
  FROM public.segment_profiles sp
  JOIN public.workspaces w ON sp.workspace_id = w.id
  WHERE sp.is_published = true;

-- Grant access to the view
GRANT SELECT ON public.marketplace_segments TO authenticated;
