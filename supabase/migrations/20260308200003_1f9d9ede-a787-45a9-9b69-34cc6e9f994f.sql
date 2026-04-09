
-- Session Transcripts: stores raw transcript data per session
CREATE TABLE public.session_transcripts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  raw_text TEXT NOT NULL DEFAULT '',
  speaker_segments JSONB DEFAULT '[]'::jsonb,
  language VARCHAR(10) DEFAULT 'en',
  source VARCHAR(50) DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Session Themes: AI-extracted or manually tagged themes
CREATE TABLE public.session_themes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  confidence_score NUMERIC(3,2) DEFAULT 0,
  evidence JSONB DEFAULT '[]'::jsonb,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Session Notes: observer bookmarks and notes during sessions
CREATE TABLE public.session_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  note_text TEXT NOT NULL,
  timestamp_ms INTEGER DEFAULT 0,
  note_type VARCHAR(50) DEFAULT 'observation',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS for session_transcripts
ALTER TABLE public.session_transcripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view session transcripts"
  ON public.session_transcripts FOR SELECT
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can create session transcripts"
  ON public.session_transcripts FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Owners admins can update session transcripts"
  ON public.session_transcripts FOR UPDATE
  USING (has_workspace_role(workspace_id, auth.uid(), 'owner'::app_role) OR has_workspace_role(workspace_id, auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners admins can delete session transcripts"
  ON public.session_transcripts FOR DELETE
  USING (has_workspace_role(workspace_id, auth.uid(), 'owner'::app_role) OR has_workspace_role(workspace_id, auth.uid(), 'admin'::app_role));

-- RLS for session_themes
ALTER TABLE public.session_themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view session themes"
  ON public.session_themes FOR SELECT
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can create session themes"
  ON public.session_themes FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Owners admins can update session themes"
  ON public.session_themes FOR UPDATE
  USING (has_workspace_role(workspace_id, auth.uid(), 'owner'::app_role) OR has_workspace_role(workspace_id, auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners admins can delete session themes"
  ON public.session_themes FOR DELETE
  USING (has_workspace_role(workspace_id, auth.uid(), 'owner'::app_role) OR has_workspace_role(workspace_id, auth.uid(), 'admin'::app_role));

-- RLS for session_notes
ALTER TABLE public.session_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view session notes"
  ON public.session_notes FOR SELECT
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can create session notes"
  ON public.session_notes FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Owners admins and creators can update session notes"
  ON public.session_notes FOR UPDATE
  USING (has_workspace_role(workspace_id, auth.uid(), 'owner'::app_role) OR has_workspace_role(workspace_id, auth.uid(), 'admin'::app_role) OR (created_by = auth.uid()));

CREATE POLICY "Owners admins and creators can delete session notes"
  ON public.session_notes FOR DELETE
  USING (has_workspace_role(workspace_id, auth.uid(), 'owner'::app_role) OR has_workspace_role(workspace_id, auth.uid(), 'admin'::app_role) OR (created_by = auth.uid()));
