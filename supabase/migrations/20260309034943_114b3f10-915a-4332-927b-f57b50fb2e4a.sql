
-- Create session_probes table
CREATE TABLE public.session_probes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source varchar NOT NULL DEFAULT 'discussion_guide' CHECK (source IN ('discussion_guide', 'post_session')),
  guide_question_text text,
  suggested_text text NOT NULL,
  status varchar NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'used', 'dismissed')),
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.session_probes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view probes"
  ON public.session_probes FOR SELECT
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can create probes"
  ON public.session_probes FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can update probes"
  ON public.session_probes FOR UPDATE
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Owners and admins can delete probes"
  ON public.session_probes FOR DELETE
  USING (
    has_workspace_role(workspace_id, auth.uid(), 'owner'::app_role)
    OR has_workspace_role(workspace_id, auth.uid(), 'admin'::app_role)
  );

-- Indexes
CREATE INDEX idx_session_probes_session ON public.session_probes(session_id);
CREATE INDEX idx_session_probes_workspace ON public.session_probes(workspace_id);
