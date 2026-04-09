-- =====================================================
-- Phase 4C: White-Label Branding for Research Firms
-- =====================================================

CREATE TABLE public.workspace_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL UNIQUE REFERENCES public.workspaces(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL DEFAULT 'InsightForge',
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#4A9E8E',
  accent_color TEXT NOT NULL DEFAULT '#E8D5B7',
  font_family TEXT DEFAULT 'Inter',
  footer_text TEXT DEFAULT 'Powered by InsightForge',
  custom_domain TEXT,
  hide_insightforge_branding BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_branding_workspace ON public.workspace_branding(workspace_id);

-- RLS
ALTER TABLE public.workspace_branding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_members_select_branding" ON public.workspace_branding
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
    )
  );

-- Only owners/admins can modify branding
CREATE POLICY "workspace_admins_modify_branding" ON public.workspace_branding
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );
