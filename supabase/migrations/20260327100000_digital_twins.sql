-- =====================================================
-- Phase 4A: Digital Twin Foundation Tables
-- =====================================================

-- 1. Segment Profiles — blueprint for creating digital twins
CREATE TABLE public.segment_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  demographics JSONB NOT NULL DEFAULT '{}',
  psychographics JSONB DEFAULT '{}',
  behavioral_data JSONB DEFAULT '{}',
  cultural_context JSONB DEFAULT '{}',
  calibration_score FLOAT DEFAULT 0,
  training_data_refs UUID[] DEFAULT '{}',
  model_version TEXT DEFAULT 'gemini-2.5-flash',
  is_preset BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_segment_profiles_workspace ON public.segment_profiles(workspace_id);

-- 2. Simulations — a run of one or more twins against a stimulus
CREATE TABLE public.simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'solo' CHECK (type IN ('solo', 'focus_group', 'ab_test', 'market_sim', 'policy')),
  title TEXT NOT NULL,
  stimulus JSONB NOT NULL DEFAULT '{}',
  segment_ids UUID[] NOT NULL DEFAULT '{}',
  config JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  results JSONB DEFAULT '{}',
  confidence_score FLOAT,
  tokens_used INTEGER DEFAULT 0,
  duration_ms INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_simulations_workspace ON public.simulations(workspace_id);
CREATE INDEX idx_simulations_status ON public.simulations(status);

-- 3. Twin Responses — individual twin output for audit trail
CREATE TABLE public.twin_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id UUID NOT NULL REFERENCES public.simulations(id) ON DELETE CASCADE,
  segment_id UUID NOT NULL REFERENCES public.segment_profiles(id) ON DELETE CASCADE,
  twin_index INTEGER NOT NULL DEFAULT 0,
  persona_snapshot JSONB DEFAULT '{}',
  stimulus_variant TEXT,
  response_text TEXT NOT NULL,
  sentiment FLOAT,
  confidence FLOAT,
  behavioral_tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_twin_responses_simulation ON public.twin_responses(simulation_id);
CREATE INDEX idx_twin_responses_segment ON public.twin_responses(segment_id);

-- =====================================================
-- Row Level Security
-- =====================================================

ALTER TABLE public.segment_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.twin_responses ENABLE ROW LEVEL SECURITY;

-- Segment Profiles: workspace members can read/write
CREATE POLICY "workspace_members_select_segments" ON public.segment_profiles
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_members_insert_segments" ON public.segment_profiles
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "workspace_members_update_segments" ON public.segment_profiles
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_members_delete_segments" ON public.segment_profiles
  FOR DELETE USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
    )
  );

-- Simulations: workspace members can read/write
CREATE POLICY "workspace_members_select_simulations" ON public.simulations
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_members_insert_simulations" ON public.simulations
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "workspace_members_update_simulations" ON public.simulations
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_members_delete_simulations" ON public.simulations
  FOR DELETE USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
    )
  );

-- Twin Responses: accessible if user can access the parent simulation
CREATE POLICY "workspace_members_select_twin_responses" ON public.twin_responses
  FOR SELECT USING (
    simulation_id IN (
      SELECT id FROM public.simulations WHERE workspace_id IN (
        SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "workspace_members_insert_twin_responses" ON public.twin_responses
  FOR INSERT WITH CHECK (
    simulation_id IN (
      SELECT id FROM public.simulations WHERE workspace_id IN (
        SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
      )
    )
  );
