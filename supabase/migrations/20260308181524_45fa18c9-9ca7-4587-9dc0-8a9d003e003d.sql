
-- ============================================================
-- 1. PROJECTS table — groups surveys & sessions into studies
-- ============================================================
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status VARCHAR NOT NULL DEFAULT 'active',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view projects"
  ON public.projects FOR SELECT
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can create projects"
  ON public.projects FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Owners admins and creators can update projects"
  ON public.projects FOR UPDATE
  USING (
    has_workspace_role(workspace_id, auth.uid(), 'owner'::app_role)
    OR has_workspace_role(workspace_id, auth.uid(), 'admin'::app_role)
    OR created_by = auth.uid()
  );

CREATE POLICY "Owners and admins can delete projects"
  ON public.projects FOR DELETE
  USING (
    has_workspace_role(workspace_id, auth.uid(), 'owner'::app_role)
    OR has_workspace_role(workspace_id, auth.uid(), 'admin'::app_role)
  );

-- Add project_id FK to surveys and sessions (nullable for backward compat)
ALTER TABLE public.surveys ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.sessions ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

-- ============================================================
-- 2. SURVEY_QUESTIONS table
-- ============================================================
CREATE TABLE public.survey_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type VARCHAR NOT NULL DEFAULT 'text',
  options JSONB,
  sort_order INT NOT NULL DEFAULT 0,
  required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.survey_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view survey questions"
  ON public.survey_questions FOR SELECT
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can create survey questions"
  ON public.survey_questions FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can update survey questions"
  ON public.survey_questions FOR UPDATE
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can delete survey questions"
  ON public.survey_questions FOR DELETE
  USING (is_workspace_member(workspace_id, auth.uid()));

-- ============================================================
-- 3. SURVEY_RESPONSES table
-- ============================================================
CREATE TABLE public.survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id UUID NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES public.participants(id) ON DELETE SET NULL,
  answers JSONB NOT NULL DEFAULT '{}',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view survey responses"
  ON public.survey_responses FOR SELECT
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can create survey responses"
  ON public.survey_responses FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can update survey responses"
  ON public.survey_responses FOR UPDATE
  USING (is_workspace_member(workspace_id, auth.uid()));

-- ============================================================
-- 4. SESSION_PARTICIPANTS table (many-to-many)
-- ============================================================
CREATE TABLE public.session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  status VARCHAR NOT NULL DEFAULT 'invited',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id, participant_id)
);

ALTER TABLE public.session_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can view session participants"
  ON public.session_participants FOR SELECT
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can manage session participants"
  ON public.session_participants FOR INSERT
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can update session participants"
  ON public.session_participants FOR UPDATE
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can delete session participants"
  ON public.session_participants FOR DELETE
  USING (is_workspace_member(workspace_id, auth.uid()));
