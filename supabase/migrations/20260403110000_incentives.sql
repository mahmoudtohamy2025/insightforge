-- =====================================================
-- Incentives Management
-- Participant compensation budgeting, tracking, distribution
-- =====================================================

-- 1. Incentive Programs
CREATE TABLE public.incentive_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,

  total_budget_cents INTEGER NOT NULL DEFAULT 0,
  spent_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',

  incentive_type TEXT NOT NULL DEFAULT 'gift_card' CHECK (incentive_type IN (
    'cash','gift_card','points','donation','lottery','physical','custom'
  )),
  default_amount_cents INTEGER NOT NULL DEFAULT 0,

  linked_project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  linked_session_ids UUID[] DEFAULT '{}',
  linked_survey_ids UUID[] DEFAULT '{}',

  auto_disburse BOOLEAN NOT NULL DEFAULT false,
  disburse_on TEXT NOT NULL DEFAULT 'completion' CHECK (disburse_on IN (
    'completion','quality_check','manual'
  )),
  min_quality_score FLOAT NOT NULL DEFAULT 0,

  -- Provider config (Tremendous, Runa, etc.)
  provider TEXT CHECK (provider IN ('tremendous','runa','manual','stripe_connect')),
  provider_config JSONB DEFAULT '{}',

  -- Approval threshold: disbursements above this amount require admin approval (cents)
  approval_threshold_cents INTEGER DEFAULT 10000,

  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'draft','active','paused','exhausted','closed'
  )),

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_incentive_programs_workspace ON public.incentive_programs(workspace_id);
CREATE INDEX idx_incentive_programs_status ON public.incentive_programs(status);

-- 2. Incentive Disbursements (individual participant payouts)
CREATE TABLE public.incentive_disbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.incentive_programs(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,

  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',

  reason TEXT NOT NULL DEFAULT 'session_completion',
  linked_session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  linked_survey_id UUID REFERENCES public.surveys(id) ON DELETE SET NULL,

  delivery_method TEXT NOT NULL DEFAULT 'email' CHECK (delivery_method IN (
    'email','sms','in_app','manual','api'
  )),
  recipient_email TEXT,
  recipient_phone TEXT,

  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending','awaiting_approval','processing','sent','claimed','expired','failed','cancelled'
  )),

  -- Provider tracking
  provider_reference TEXT,
  provider_response JSONB,

  sent_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,

  -- Approval tracking
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_disbursements_program ON public.incentive_disbursements(program_id);
CREATE INDEX idx_disbursements_participant ON public.incentive_disbursements(participant_id);
CREATE INDEX idx_disbursements_workspace ON public.incentive_disbursements(workspace_id);
CREATE INDEX idx_disbursements_status ON public.incentive_disbursements(status);
CREATE INDEX idx_disbursements_session ON public.incentive_disbursements(linked_session_id);
CREATE INDEX idx_disbursements_survey ON public.incentive_disbursements(linked_survey_id);

-- 3. Participant Points Ledger (for points-based reward programs)
CREATE TABLE public.participant_points_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,

  points INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,

  reason TEXT NOT NULL,
  reference_id UUID,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_points_ledger_participant ON public.participant_points_ledger(workspace_id, participant_id);

-- =====================================================
-- RLS Policies
-- =====================================================

ALTER TABLE public.incentive_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incentive_disbursements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participant_points_ledger ENABLE ROW LEVEL SECURITY;

-- incentive_programs
CREATE POLICY "workspace_members_select_incentive_programs" ON public.incentive_programs
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "admins_insert_incentive_programs" ON public.incentive_programs
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_memberships
      WHERE user_id = auth.uid() AND role IN ('owner','admin')
    )
  );

CREATE POLICY "admins_update_incentive_programs" ON public.incentive_programs
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_memberships
      WHERE user_id = auth.uid() AND role IN ('owner','admin')
    )
  );

CREATE POLICY "admins_delete_incentive_programs" ON public.incentive_programs
  FOR DELETE USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_memberships
      WHERE user_id = auth.uid() AND role IN ('owner','admin')
    )
  );

-- incentive_disbursements
CREATE POLICY "workspace_members_select_disbursements" ON public.incentive_disbursements
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "researchers_insert_disbursements" ON public.incentive_disbursements
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_memberships
      WHERE user_id = auth.uid() AND role IN ('owner','admin','researcher')
    )
  );

CREATE POLICY "admins_update_disbursements" ON public.incentive_disbursements
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_memberships
      WHERE user_id = auth.uid() AND role IN ('owner','admin')
    )
  );

-- participant_points_ledger
CREATE POLICY "workspace_members_select_points" ON public.participant_points_ledger
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "admins_insert_points" ON public.participant_points_ledger
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_memberships
      WHERE user_id = auth.uid() AND role IN ('owner','admin','researcher')
    )
  );

-- =====================================================
-- updated_at triggers
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_incentive_programs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_incentive_programs_updated_at
  BEFORE UPDATE ON public.incentive_programs
  FOR EACH ROW EXECUTE FUNCTION public.update_incentive_programs_updated_at();

CREATE OR REPLACE FUNCTION public.update_incentive_disbursements_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_incentive_disbursements_updated_at
  BEFORE UPDATE ON public.incentive_disbursements
  FOR EACH ROW EXECUTE FUNCTION public.update_incentive_disbursements_updated_at();

-- =====================================================
-- Auto-update spent_cents on program when disbursement sent
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_program_spent_cents()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- When a disbursement transitions to 'sent', add to spent_cents
  IF NEW.status = 'sent' AND (OLD.status IS DISTINCT FROM 'sent') THEN
    UPDATE public.incentive_programs
    SET spent_cents = spent_cents + NEW.amount_cents,
        status = CASE
          WHEN (spent_cents + NEW.amount_cents) >= total_budget_cents THEN 'exhausted'
          ELSE status
        END
    WHERE id = NEW.program_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_program_spent_on_disburse
  AFTER UPDATE ON public.incentive_disbursements
  FOR EACH ROW EXECUTE FUNCTION public.update_program_spent_cents();
