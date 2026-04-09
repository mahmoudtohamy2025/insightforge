-- =====================================================
-- Phase 4C: API Keys for Programmatic Access
-- =====================================================

CREATE TABLE public.workspace_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL, -- first 8 chars for display: "isk_abc1..."
  scopes TEXT[] NOT NULL DEFAULT '{simulate}',
  rate_limit INTEGER NOT NULL DEFAULT 100, -- requests per hour
  requests_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_api_keys_workspace ON public.workspace_api_keys(workspace_id);
CREATE INDEX idx_api_keys_prefix ON public.workspace_api_keys(key_prefix);

-- RLS: workspace members can manage keys
ALTER TABLE public.workspace_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_members_select_api_keys" ON public.workspace_api_keys
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_members_insert_api_keys" ON public.workspace_api_keys
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "workspace_members_update_api_keys" ON public.workspace_api_keys
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_members_delete_api_keys" ON public.workspace_api_keys
  FOR DELETE USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
    )
  );
