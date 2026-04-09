
-- Workspace activity log for audit trail
CREATE TABLE public.workspace_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Index for fast workspace-scoped queries
CREATE INDEX idx_workspace_activity_workspace ON public.workspace_activity(workspace_id, created_at DESC);

-- RLS
ALTER TABLE public.workspace_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view activity"
  ON public.workspace_activity FOR SELECT
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can insert activity"
  ON public.workspace_activity FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()) AND user_id = auth.uid());
