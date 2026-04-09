-- Create API Keys table
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hint TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Policies for API Keys
CREATE POLICY "Workspace members can view API keys"
  ON public.api_keys FOR SELECT
  USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace admins and owners can manage API keys"
  ON public.api_keys FOR ALL
  USING (
    public.has_workspace_role(workspace_id, auth.uid(), 'admin'::app_role) 
    OR public.has_workspace_role(workspace_id, auth.uid(), 'owner'::app_role)
  );
