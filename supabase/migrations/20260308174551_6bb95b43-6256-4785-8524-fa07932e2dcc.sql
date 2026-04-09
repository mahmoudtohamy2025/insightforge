
-- Create surveys table
CREATE TABLE public.surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  target_responses INTEGER NOT NULL DEFAULT 0,
  response_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS is auto-enabled by the event trigger, but ensure it
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;

-- SELECT: workspace members can view surveys
CREATE POLICY "Workspace members can view surveys"
ON public.surveys FOR SELECT
TO authenticated
USING (public.is_workspace_member(workspace_id, auth.uid()));

-- INSERT: workspace members can create surveys
CREATE POLICY "Workspace members can create surveys"
ON public.surveys FOR INSERT
TO authenticated
WITH CHECK (
  public.is_workspace_member(workspace_id, auth.uid())
  AND created_by = auth.uid()
);

-- UPDATE: owner/admin or creator can update
CREATE POLICY "Owners admins and creators can update surveys"
ON public.surveys FOR UPDATE
TO authenticated
USING (
  public.has_workspace_role(workspace_id, auth.uid(), 'owner'::app_role)
  OR public.has_workspace_role(workspace_id, auth.uid(), 'admin'::app_role)
  OR created_by = auth.uid()
);

-- DELETE: owner/admin only
CREATE POLICY "Owners and admins can delete surveys"
ON public.surveys FOR DELETE
TO authenticated
USING (
  public.has_workspace_role(workspace_id, auth.uid(), 'owner'::app_role)
  OR public.has_workspace_role(workspace_id, auth.uid(), 'admin'::app_role)
);
