-- =====================================================================
-- Super Admin v2: Extended RLS policies for cross-tenant read access
-- Apply this in Supabase SQL Editor
-- =====================================================================

-- Helper: super admins can read/write sessions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sessions' AND policyname='super_admin_select_all_sessions') THEN
    CREATE POLICY "super_admin_select_all_sessions" ON public.sessions FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
  END IF;
END $$;

-- projects
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='projects' AND policyname='super_admin_select_all_projects') THEN
    CREATE POLICY "super_admin_select_all_projects" ON public.projects FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
  END IF;
END $$;

-- surveys
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='surveys' AND policyname='super_admin_select_all_surveys') THEN
    CREATE POLICY "super_admin_select_all_surveys" ON public.surveys FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
  END IF;
END $$;

-- survey_responses
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='survey_responses' AND policyname='super_admin_select_all_survey_responses') THEN
    CREATE POLICY "super_admin_select_all_survey_responses" ON public.survey_responses FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
  END IF;
END $$;

-- segment_profiles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='segment_profiles' AND policyname='super_admin_select_all_segments') THEN
    CREATE POLICY "super_admin_select_all_segments" ON public.segment_profiles FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
  END IF;
END $$;

-- simulations
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='simulations' AND policyname='super_admin_select_all_simulations') THEN
    CREATE POLICY "super_admin_select_all_simulations" ON public.simulations FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
  END IF;
END $$;

-- twin_responses
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='twin_responses' AND policyname='super_admin_select_all_twin_responses') THEN
    CREATE POLICY "super_admin_select_all_twin_responses" ON public.twin_responses FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
  END IF;
END $$;

-- audit_logs (global read)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='audit_logs' AND policyname='super_admin_select_all_audit_logs') THEN
    CREATE POLICY "super_admin_select_all_audit_logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
  END IF;
END $$;

-- workspace_api_keys
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='workspace_api_keys' AND policyname='super_admin_select_all_api_keys') THEN
    CREATE POLICY "super_admin_select_all_api_keys" ON public.workspace_api_keys FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
  END IF;
END $$;

-- workspace_branding
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='workspace_branding' AND policyname='super_admin_select_all_branding') THEN
    CREATE POLICY "super_admin_select_all_branding" ON public.workspace_branding FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
  END IF;
END $$;

-- workspace_token_usage
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='workspace_token_usage' AND policyname='super_admin_select_all_token_usage') THEN
    CREATE POLICY "super_admin_select_all_token_usage" ON public.workspace_token_usage FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
  END IF;
END $$;

-- workspace_token_usage_log
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='workspace_token_usage_log' AND policyname='super_admin_select_all_token_log') THEN
    CREATE POLICY "super_admin_select_all_token_log" ON public.workspace_token_usage_log FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
  END IF;
END $$;

-- incentive_programs (may not exist yet, guard it)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='incentive_programs') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='incentive_programs' AND policyname='super_admin_select_all_incentive_programs_v2') THEN
      EXECUTE 'CREATE POLICY "super_admin_select_all_incentive_programs_v2" ON public.incentive_programs FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()))';
    END IF;
  END IF;
END $$;

-- incentive_disbursements
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='incentive_disbursements') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='incentive_disbursements' AND policyname='super_admin_select_all_disbursements_v2') THEN
      EXECUTE 'CREATE POLICY "super_admin_select_all_disbursements_v2" ON public.incentive_disbursements FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()))';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='incentive_disbursements' AND policyname='super_admin_update_all_disbursements') THEN
      EXECUTE 'CREATE POLICY "super_admin_update_all_disbursements" ON public.incentive_disbursements FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid()))';
    END IF;
  END IF;
END $$;

-- study_listings (participant portal)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='study_listings') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='study_listings' AND policyname='super_admin_select_all_studies') THEN
      EXECUTE 'CREATE POLICY "super_admin_select_all_studies" ON public.study_listings FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()))';
    END IF;
  END IF;
END $$;

-- study_participations
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='study_participations') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='study_participations' AND policyname='super_admin_select_all_participations') THEN
      EXECUTE 'CREATE POLICY "super_admin_select_all_participations" ON public.study_participations FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()))';
    END IF;
  END IF;
END $$;

-- participant_profiles
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='participant_profiles') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='participant_profiles' AND policyname='super_admin_select_all_participant_profiles') THEN
      EXECUTE 'CREATE POLICY "super_admin_select_all_participant_profiles" ON participant_profiles FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()))';
    END IF;
  END IF;
END $$;

-- participant_earnings
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='participant_earnings') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='participant_earnings' AND policyname='super_admin_select_all_participant_earnings') THEN
      EXECUTE 'CREATE POLICY "super_admin_select_all_participant_earnings" ON participant_earnings FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()))';
    END IF;
  END IF;
END $$;

-- participant_reputation
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='participant_reputation') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='participant_reputation' AND policyname='super_admin_select_all_reputation') THEN
      EXECUTE 'CREATE POLICY "super_admin_select_all_reputation" ON participant_reputation FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()))';
    END IF;
  END IF;
END $$;

-- participant_referrals
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='participant_referrals') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='participant_referrals' AND policyname='super_admin_select_all_referrals') THEN
      EXECUTE 'CREATE POLICY "super_admin_select_all_referrals" ON participant_referrals FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()))';
    END IF;
  END IF;
END $$;

-- notifications
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notifications' AND policyname='super_admin_select_all_notifications') THEN
    CREATE POLICY "super_admin_select_all_notifications" ON public.notifications FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
  END IF;
END $$;

-- user_roles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_roles' AND policyname='super_admin_select_all_user_roles') THEN
    CREATE POLICY "super_admin_select_all_user_roles" ON public.user_roles FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
  END IF;
END $$;
