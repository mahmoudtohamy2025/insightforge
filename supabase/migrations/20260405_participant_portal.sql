-- ============================================================
-- InsightForge Participant Marketplace — Database Migration
-- Run in Supabase SQL Editor or via supabase db push
-- ============================================================

-- 1. Participant profiles (linked to auth.users, NOT workspace-scoped)
CREATE TABLE IF NOT EXISTS participant_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  date_of_birth DATE,
  gender TEXT,
  country TEXT,
  city TEXT,
  ethnicity TEXT,
  income_bracket TEXT,
  education TEXT,
  employment_status TEXT,
  industry TEXT,
  job_title TEXT,
  interests TEXT[] DEFAULT '{}',
  languages TEXT[] DEFAULT '{English}',
  availability JSONB DEFAULT '{"weekdays": true, "evenings": true, "weekends": false}',
  bio TEXT,
  verified_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','banned')),
  onboarding_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 2. Study listings (posted by enterprise researchers)
CREATE TABLE IF NOT EXISTS study_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by UUID,
  title TEXT NOT NULL,
  description TEXT,
  study_type TEXT NOT NULL DEFAULT 'survey' CHECK (study_type IN ('survey','focus_group','interview','usability_test','twin_calibration')),
  estimated_minutes INT NOT NULL DEFAULT 15,
  reward_amount_cents INT NOT NULL DEFAULT 500,
  currency TEXT NOT NULL DEFAULT 'USD',
  max_participants INT NOT NULL DEFAULT 50,
  current_participants INT NOT NULL DEFAULT 0,
  requirements JSONB DEFAULT '{}',
  screener_questions JSONB DEFAULT '[]',
  linked_survey_id UUID,
  linked_session_id UUID,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','filled','completed','cancelled')),
  closes_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Study participations (participant <-> study link)
CREATE TABLE IF NOT EXISTS study_participations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id UUID NOT NULL REFERENCES study_listings(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participant_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'accepted' CHECK (status IN ('accepted','in_progress','submitted','approved','rejected','paid')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  researcher_rating INT CHECK (researcher_rating BETWEEN 1 AND 5),
  researcher_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(study_id, participant_id)
);

-- 4. Participant earnings ledger
CREATE TABLE IF NOT EXISTS participant_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES participant_profiles(id) ON DELETE CASCADE,
  participation_id UUID REFERENCES study_participations(id),
  amount_cents INT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  earning_type TEXT NOT NULL DEFAULT 'study' CHECK (earning_type IN ('study','bonus','twin_royalty','referral')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','available','processing','paid','cancelled')),
  description TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Participant reputation
CREATE TABLE IF NOT EXISTS participant_reputation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES participant_profiles(id) ON DELETE CASCADE,
  total_studies INT NOT NULL DEFAULT 0,
  completion_rate NUMERIC(5,2) NOT NULL DEFAULT 100.00,
  avg_rating NUMERIC(3,2) NOT NULL DEFAULT 5.00,
  attention_score NUMERIC(5,2) NOT NULL DEFAULT 100.00,
  tier TEXT NOT NULL DEFAULT 'newcomer' CHECK (tier IN ('newcomer','regular','trusted','expert','elite')),
  badges JSONB DEFAULT '[]',
  twin_contributions INT NOT NULL DEFAULT 0,
  total_earned_cents INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(participant_id)
);

-- ============================================================
-- Indexes for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_participant_profiles_user ON participant_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_study_listings_status ON study_listings(status);
CREATE INDEX IF NOT EXISTS idx_study_listings_workspace ON study_listings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_study_participations_participant ON study_participations(participant_id);
CREATE INDEX IF NOT EXISTS idx_study_participations_study ON study_participations(study_id);
CREATE INDEX IF NOT EXISTS idx_participant_earnings_participant ON participant_earnings(participant_id);
CREATE INDEX IF NOT EXISTS idx_participant_earnings_status ON participant_earnings(status);

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE participant_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_participations ENABLE ROW LEVEL SECURITY;
ALTER TABLE participant_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE participant_reputation ENABLE ROW LEVEL SECURITY;

-- Participants can read/update their own profile
CREATE POLICY "participant_own_profile_select" ON participant_profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "participant_own_profile_update" ON participant_profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Anyone authenticated can read active study listings
CREATE POLICY "read_active_studies" ON study_listings
  FOR SELECT USING (status = 'active');

-- Workspace members can manage their study listings (all operations)
CREATE POLICY "workspace_manage_studies" ON study_listings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM workspace_memberships wm
      WHERE wm.workspace_id = study_listings.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

-- Participants can read their own participations
CREATE POLICY "participant_own_participations_select" ON study_participations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM participant_profiles pp
      WHERE pp.id = study_participations.participant_id AND pp.user_id = auth.uid()
    )
  );

-- Participants can insert their own participations
CREATE POLICY "participant_own_participations_insert" ON study_participations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM participant_profiles pp
      WHERE pp.id = study_participations.participant_id AND pp.user_id = auth.uid()
    )
  );

-- Workspace members can manage participations for their studies
CREATE POLICY "workspace_manage_participations" ON study_participations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM study_listings sl
      JOIN workspace_memberships wm ON wm.workspace_id = sl.workspace_id
      WHERE sl.id = study_participations.study_id AND wm.user_id = auth.uid()
    )
  );

-- Participants can see their own earnings
CREATE POLICY "participant_own_earnings_select" ON participant_earnings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM participant_profiles pp
      WHERE pp.id = participant_earnings.participant_id AND pp.user_id = auth.uid()
    )
  );

-- Participants can see their own reputation
CREATE POLICY "participant_own_reputation_select" ON participant_reputation
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM participant_profiles pp
      WHERE pp.id = participant_reputation.participant_id AND pp.user_id = auth.uid()
    )
  );
