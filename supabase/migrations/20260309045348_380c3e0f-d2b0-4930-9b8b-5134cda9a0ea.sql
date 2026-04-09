
-- participant_tags table for segmenting participants
CREATE TABLE public.participant_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  tag_name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (participant_id, tag_name)
);

-- RLS
ALTER TABLE public.participant_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view participant tags"
  ON public.participant_tags FOR SELECT
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can create participant tags"
  ON public.participant_tags FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can delete participant tags"
  ON public.participant_tags FOR DELETE
  USING (is_workspace_member(workspace_id, auth.uid()));

-- Index for fast lookups
CREATE INDEX idx_participant_tags_participant ON public.participant_tags(participant_id);
CREATE INDEX idx_participant_tags_workspace ON public.participant_tags(workspace_id);
