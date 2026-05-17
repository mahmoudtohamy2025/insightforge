-- ============================================================
-- Participant production readiness hardening
-- Durable payouts, privacy audit trail, typed submissions,
-- and transaction-safe study acceptance.
-- ============================================================

ALTER TABLE public.participant_profiles
  ADD COLUMN IF NOT EXISTS paypal_email TEXT,
  ADD COLUMN IF NOT EXISTS erased_at TIMESTAMPTZ;

ALTER TABLE public.study_participations
  ADD COLUMN IF NOT EXISTS submission_payload JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_participant_earnings_one_study_reward
  ON public.participant_earnings(participation_id)
  WHERE participation_id IS NOT NULL AND earning_type = 'study';

CREATE TABLE IF NOT EXISTS public.participant_payout_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.participant_profiles(id) ON DELETE CASCADE,
  amount_cents INT NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','processing','paid','failed','cancelled')),
  provider TEXT NOT NULL DEFAULT 'tremendous',
  provider_order_id TEXT,
  idempotency_key TEXT NOT NULL,
  earning_ids UUID[] NOT NULL DEFAULT '{}',
  provider_response JSONB DEFAULT '{}'::jsonb,
  failure_reason TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_participant_payout_requests_participant
  ON public.participant_payout_requests(participant_id);
CREATE INDEX IF NOT EXISTS idx_participant_payout_requests_status
  ON public.participant_payout_requests(status);
CREATE INDEX IF NOT EXISTS idx_participant_payout_requests_open
  ON public.participant_payout_requests(participant_id, status)
  WHERE status IN ('requested','processing');

CREATE TABLE IF NOT EXISTS public.privacy_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES public.participant_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('export','erasure')),
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','processing','completed','rejected','cancelled')),
  export_payload JSONB,
  rejection_reason TEXT,
  admin_override_by UUID,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_privacy_requests_participant
  ON public.privacy_requests(participant_id);
CREATE INDEX IF NOT EXISTS idx_privacy_requests_status
  ON public.privacy_requests(status);

ALTER TABLE public.participant_payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'participant_payout_requests'
      AND policyname = 'participant_select_own_payout_requests'
  ) THEN
    CREATE POLICY "participant_select_own_payout_requests"
      ON public.participant_payout_requests
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.participant_profiles pp
          WHERE pp.id = participant_payout_requests.participant_id
            AND pp.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'participant_payout_requests'
      AND policyname = 'super_admin_select_all_payout_requests'
  ) THEN
    CREATE POLICY "super_admin_select_all_payout_requests"
      ON public.participant_payout_requests
      FOR SELECT TO authenticated
      USING (public.is_super_admin(auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'privacy_requests'
      AND policyname = 'participant_select_own_privacy_requests'
  ) THEN
    CREATE POLICY "participant_select_own_privacy_requests"
      ON public.privacy_requests
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'privacy_requests'
      AND policyname = 'super_admin_select_all_privacy_requests'
  ) THEN
    CREATE POLICY "super_admin_select_all_privacy_requests"
      ON public.privacy_requests
      FOR SELECT TO authenticated
      USING (public.is_super_admin(auth.uid()));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.accept_study_participation(
  p_study_id UUID,
  p_user_id UUID
)
RETURNS public.study_participations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.participant_profiles%ROWTYPE;
  v_study public.study_listings%ROWTYPE;
  v_participation public.study_participations%ROWTYPE;
BEGIN
  SELECT *
    INTO v_profile
    FROM public.participant_profiles
   WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'participant_profile_not_found';
  END IF;

  IF v_profile.status <> 'active' THEN
    RAISE EXCEPTION 'participant_not_active';
  END IF;

  SELECT *
    INTO v_study
    FROM public.study_listings
   WHERE id = p_study_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'study_not_found';
  END IF;

  SELECT *
    INTO v_participation
    FROM public.study_participations
   WHERE study_id = p_study_id
     AND participant_id = v_profile.id;

  IF FOUND THEN
    RETURN v_participation;
  END IF;

  IF v_study.status <> 'active' THEN
    RAISE EXCEPTION 'study_not_accepting';
  END IF;

  IF v_study.closes_at IS NOT NULL AND v_study.closes_at <= NOW() THEN
    RAISE EXCEPTION 'study_expired';
  END IF;

  IF v_study.current_participants >= v_study.max_participants THEN
    RAISE EXCEPTION 'study_full';
  END IF;

  INSERT INTO public.study_participations (
    study_id,
    participant_id,
    status,
    started_at
  )
  VALUES (
    p_study_id,
    v_profile.id,
    'accepted',
    NOW()
  )
  RETURNING * INTO v_participation;

  UPDATE public.study_listings
     SET current_participants = current_participants + 1,
         status = CASE
           WHEN current_participants + 1 >= max_participants THEN 'filled'
           ELSE status
         END,
         updated_at = NOW()
   WHERE id = p_study_id;

  RETURN v_participation;
END;
$$;

