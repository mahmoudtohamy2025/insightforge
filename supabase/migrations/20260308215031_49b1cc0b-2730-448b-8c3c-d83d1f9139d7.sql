
-- Create insight_patterns table for cross-session aggregated patterns
CREATE TABLE public.insight_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  sentiment varchar DEFAULT 'neutral',
  session_count integer NOT NULL DEFAULT 0,
  theme_ids uuid[] DEFAULT '{}',
  evidence_quotes jsonb DEFAULT '[]'::jsonb,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.insight_patterns ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Workspace members can view insight patterns"
  ON public.insight_patterns FOR SELECT
  TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can create insight patterns"
  ON public.insight_patterns FOR INSERT
  TO authenticated
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Owners and admins can update insight patterns"
  ON public.insight_patterns FOR UPDATE
  TO authenticated
  USING (
    has_workspace_role(workspace_id, auth.uid(), 'owner'::app_role)
    OR has_workspace_role(workspace_id, auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Owners and admins can delete insight patterns"
  ON public.insight_patterns FOR DELETE
  TO authenticated
  USING (
    has_workspace_role(workspace_id, auth.uid(), 'owner'::app_role)
    OR has_workspace_role(workspace_id, auth.uid(), 'admin'::app_role)
  );
