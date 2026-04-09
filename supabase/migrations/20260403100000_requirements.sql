-- =====================================================
-- User Requirements Management
-- Structured research request intake and tracking system
-- =====================================================

-- 1. Requirements table
CREATE TABLE public.requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  description TEXT,
  business_context TEXT,
  research_questions JSONB DEFAULT '[]',

  category TEXT DEFAULT 'general' CHECK (category IN (
    'product','market','ux','brand','competitor','pricing','customer_experience','general'
  )),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('critical','high','medium','low')),
  status TEXT DEFAULT 'submitted' CHECK (status IN (
    'submitted','under_review','approved','in_progress','insights_ready','completed','declined','on_hold'
  )),

  target_audience TEXT,
  target_market TEXT,
  suggested_methodology TEXT[] DEFAULT '{}',
  ai_methodology_suggestion JSONB,

  requested_deadline DATE,
  estimated_effort TEXT CHECK (estimated_effort IN ('small','medium','large','xl')),

  linked_project_ids UUID[] DEFAULT '{}',
  linked_session_ids UUID[] DEFAULT '{}',
  linked_survey_ids UUID[] DEFAULT '{}',
  linked_simulation_ids UUID[] DEFAULT '{}',
  linked_insight_ids UUID[] DEFAULT '{}',

  findings_summary TEXT,
  impact_rating INTEGER CHECK (impact_rating BETWEEN 1 AND 5),
  stakeholder_satisfaction INTEGER CHECK (stakeholder_satisfaction BETWEEN 1 AND 5),

  requested_by UUID NOT NULL REFERENCES auth.users(id),
  assigned_to UUID REFERENCES auth.users(id),
  reviewed_by UUID REFERENCES auth.users(id),

  tags TEXT[] DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_requirements_workspace ON public.requirements(workspace_id);
CREATE INDEX idx_requirements_status ON public.requirements(status);
CREATE INDEX idx_requirements_priority ON public.requirements(priority);
CREATE INDEX idx_requirements_assigned ON public.requirements(assigned_to);
CREATE INDEX idx_requirements_requested_by ON public.requirements(requested_by);

-- 2. Requirement comments
CREATE TABLE public.requirement_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id UUID NOT NULL REFERENCES public.requirements(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  body TEXT NOT NULL,
  comment_type TEXT DEFAULT 'comment' CHECK (comment_type IN (
    'comment','status_change','assignment','methodology_suggestion'
  )),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_req_comments_requirement ON public.requirement_comments(requirement_id);

-- 3. Requirement votes (upvoting to signal business priority)
CREATE TABLE public.requirement_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id UUID NOT NULL REFERENCES public.requirements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  vote_type TEXT DEFAULT 'upvote',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(requirement_id, user_id)
);

CREATE INDEX idx_req_votes_requirement ON public.requirement_votes(requirement_id);

-- =====================================================
-- RLS Policies
-- =====================================================

ALTER TABLE public.requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requirement_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requirement_votes ENABLE ROW LEVEL SECURITY;

-- requirements: any workspace member can read and create
CREATE POLICY "workspace_members_select_requirements" ON public.requirements
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_members_insert_requirements" ON public.requirements
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
    )
    AND requested_by = auth.uid()
  );

-- Only researchers/admins/owners can update status, assignment, methodology
CREATE POLICY "researchers_update_requirements" ON public.requirements
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_memberships
      WHERE user_id = auth.uid() AND role IN ('owner','admin','researcher')
    )
    OR requested_by = auth.uid()
  );

CREATE POLICY "admins_delete_requirements" ON public.requirements
  FOR DELETE USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_memberships
      WHERE user_id = auth.uid() AND role IN ('owner','admin')
    )
  );

-- requirement_comments: any workspace member can read and create
CREATE POLICY "workspace_members_select_req_comments" ON public.requirement_comments
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_members_insert_req_comments" ON public.requirement_comments
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

CREATE POLICY "users_delete_own_req_comments" ON public.requirement_comments
  FOR DELETE USING (user_id = auth.uid());

-- requirement_votes: any workspace member can read and vote
CREATE POLICY "workspace_members_select_req_votes" ON public.requirement_votes
  FOR SELECT USING (
    requirement_id IN (
      SELECT id FROM public.requirements WHERE workspace_id IN (
        SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "workspace_members_insert_req_votes" ON public.requirement_votes
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND requirement_id IN (
      SELECT id FROM public.requirements WHERE workspace_id IN (
        SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "users_delete_own_req_votes" ON public.requirement_votes
  FOR DELETE USING (user_id = auth.uid());

-- =====================================================
-- updated_at trigger for requirements
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_requirements_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_requirements_updated_at
  BEFORE UPDATE ON public.requirements
  FOR EACH ROW EXECUTE FUNCTION public.update_requirements_updated_at();
