-- =====================================================================
-- Super Admin Infrastructure
-- Provides platform-level god-mode for InsightForge SaaS operators
-- =====================================================================

-- 1. Super Admins table — only these users can access /admin/*
CREATE TABLE IF NOT EXISTS public.super_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

-- Super admins can read their own row (used by the frontend hook)
CREATE POLICY "super_admins_select_own"
  ON public.super_admins FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 2. Insert the first super admin: mahmoudtohamy94@gmail.com
INSERT INTO public.super_admins (user_id)
VALUES ('d7466901-d2d8-4198-bc05-90a161a8599d')
ON CONFLICT (user_id) DO NOTHING;

-- 3. Helper function: is_super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin(uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admins WHERE user_id = uid
  )
$$;

-- 4. Grant super admins SELECT on all key tables (bypasses normal workspace RLS)
-- We do this by adding a policy to each table that grants access to super admins.

-- workspaces: super admins can see ALL workspaces
CREATE POLICY "super_admin_select_all_workspaces"
  ON public.workspaces FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "super_admin_update_all_workspaces"
  ON public.workspaces FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- workspace_memberships: super admins can see ALL memberships
CREATE POLICY "super_admin_select_all_memberships"
  ON public.workspace_memberships FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- participants: super admins can see ALL participants
CREATE POLICY "super_admin_select_all_participants"
  ON public.participants FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- incentive_programs: super admins can see ALL programs
CREATE POLICY "super_admin_select_all_programs"
  ON public.incentive_programs FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- incentive_disbursements: super admins can see ALL disbursements
CREATE POLICY "super_admin_select_all_disbursements"
  ON public.incentive_disbursements FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- profiles: super admins can see ALL profiles
CREATE POLICY "super_admin_select_all_profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));
