
-- 1. Create workspaces table (per PRD)
CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  tier VARCHAR(50) NOT NULL DEFAULT 'free',
  status VARCHAR(50) DEFAULT 'active',
  deployment_type VARCHAR(50) DEFAULT 'shared',
  data_residency VARCHAR(50) DEFAULT 'mena',
  stripe_customer_id VARCHAR(100),
  subscription_status VARCHAR(50),
  gdpr_enabled BOOLEAN DEFAULT false,
  pdpl_enabled BOOLEAN DEFAULT false,
  data_retention_days INTEGER DEFAULT 730,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create workspace_memberships table
CREATE TABLE public.workspace_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'researcher',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

-- 3. Security definer helper: is_workspace_member
CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id UUID, uid UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_memberships
    WHERE workspace_id = ws_id AND user_id = uid
  )
$$;

-- 4. Security definer helper: has_workspace_role
CREATE OR REPLACE FUNCTION public.has_workspace_role(ws_id UUID, uid UUID, r app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_memberships
    WHERE workspace_id = ws_id AND user_id = uid AND role = r
  )
$$;

-- 5. RLS policies for workspaces
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their workspaces"
ON public.workspaces FOR SELECT TO authenticated
USING (public.is_workspace_member(id, auth.uid()));

CREATE POLICY "Authenticated users can create workspaces"
ON public.workspaces FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Owners and admins can update workspaces"
ON public.workspaces FOR UPDATE TO authenticated
USING (
  public.has_workspace_role(id, auth.uid(), 'owner') OR
  public.has_workspace_role(id, auth.uid(), 'admin')
);

CREATE POLICY "Only owners can delete workspaces"
ON public.workspaces FOR DELETE TO authenticated
USING (public.has_workspace_role(id, auth.uid(), 'owner'));

-- 6. RLS policies for workspace_memberships
ALTER TABLE public.workspace_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view workspace members"
ON public.workspace_memberships FOR SELECT TO authenticated
USING (public.is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Owners and admins can add members"
ON public.workspace_memberships FOR INSERT TO authenticated
WITH CHECK (
  public.has_workspace_role(workspace_id, auth.uid(), 'owner') OR
  public.has_workspace_role(workspace_id, auth.uid(), 'admin')
);

CREATE POLICY "Owners and admins can update members"
ON public.workspace_memberships FOR UPDATE TO authenticated
USING (
  public.has_workspace_role(workspace_id, auth.uid(), 'owner') OR
  public.has_workspace_role(workspace_id, auth.uid(), 'admin')
);

CREATE POLICY "Owners and admins can remove members"
ON public.workspace_memberships FOR DELETE TO authenticated
USING (
  public.has_workspace_role(workspace_id, auth.uid(), 'owner') OR
  public.has_workspace_role(workspace_id, auth.uid(), 'admin')
);

-- 7. Update handle_new_user() to auto-create workspace
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ws_name TEXT;
  ws_slug TEXT;
  ws_id UUID;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', '')
  );

  -- Assign default role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'researcher');

  -- Create default workspace
  ws_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'workspace_name'), ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', 'My') || '''s Workspace'
  );
  ws_slug := lower(regexp_replace(ws_name, '[^a-zA-Z0-9]+', '-', 'g'));
  -- Ensure slug uniqueness by appending random suffix
  ws_slug := ws_slug || '-' || substr(gen_random_uuid()::text, 1, 8);

  INSERT INTO public.workspaces (id, name, slug, created_by)
  VALUES (gen_random_uuid(), ws_name, ws_slug, new.id)
  RETURNING id INTO ws_id;

  -- Add user as owner of the workspace
  INSERT INTO public.workspace_memberships (workspace_id, user_id, role)
  VALUES (ws_id, new.id, 'owner');

  RETURN new;
END;
$$;
