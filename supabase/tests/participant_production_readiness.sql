-- Participant production readiness contract checks.
-- Run against staging after migrations:
--   psql "$STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/participant_production_readiness.sql

DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'participant_payout_requests'
  ), 'participant_payout_requests table is missing';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'privacy_requests'
  ), 'privacy_requests table is missing';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'study_participations'
      AND column_name = 'submission_payload'
  ), 'study_participations.submission_payload is missing';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'participant_profiles'
      AND column_name = 'paypal_email'
  ), 'participant_profiles.paypal_email is missing';

  ASSERT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'accept_study_participation'
  ), 'accept_study_participation RPC is missing';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'participant_payout_requests'
      AND policyname = 'participant_select_own_payout_requests'
  ), 'participant payout request RLS policy is missing';

  ASSERT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'privacy_requests'
      AND policyname = 'participant_select_own_privacy_requests'
  ), 'participant privacy request RLS policy is missing';
END $$;

