
-- Create synthesis_runs table
CREATE TABLE public.synthesis_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  patterns_count integer NOT NULL DEFAULT 0,
  sessions_analyzed integer NOT NULL DEFAULT 0,
  themes_processed integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.synthesis_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view synthesis runs"
  ON public.synthesis_runs FOR SELECT TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can insert synthesis runs"
  ON public.synthesis_runs FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

-- Add synthesis_run_id to insight_patterns
ALTER TABLE public.insight_patterns
  ADD COLUMN synthesis_run_id uuid REFERENCES public.synthesis_runs(id) ON DELETE CASCADE;
