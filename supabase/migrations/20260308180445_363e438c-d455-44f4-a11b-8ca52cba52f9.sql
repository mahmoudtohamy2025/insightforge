ALTER TABLE public.workspace_memberships
  ADD CONSTRAINT workspace_memberships_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;