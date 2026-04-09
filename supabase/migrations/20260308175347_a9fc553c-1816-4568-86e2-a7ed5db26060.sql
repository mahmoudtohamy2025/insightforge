
-- =============================================
-- Sessions table
-- =============================================
CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'idi',
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  scheduled_date DATE,
  scheduled_time TIME,
  duration_minutes INTEGER DEFAULT 60,
  max_participants INTEGER DEFAULT 1,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sessions RLS
CREATE POLICY "Workspace members can view sessions"
  ON public.sessions FOR SELECT TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can create sessions"
  ON public.sessions FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Owners admins and creators can update sessions"
  ON public.sessions FOR UPDATE TO authenticated
  USING (has_workspace_role(workspace_id, auth.uid(), 'owner') OR has_workspace_role(workspace_id, auth.uid(), 'admin') OR created_by = auth.uid());

CREATE POLICY "Owners and admins can delete sessions"
  ON public.sessions FOR DELETE TO authenticated
  USING (has_workspace_role(workspace_id, auth.uid(), 'owner') OR has_workspace_role(workspace_id, auth.uid(), 'admin'));

-- =============================================
-- Participants table
-- =============================================
CREATE TABLE public.participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  age INTEGER,
  gender VARCHAR(20),
  location TEXT,
  session_count INTEGER DEFAULT 0,
  quality_score NUMERIC(3,1) DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Participants RLS
CREATE POLICY "Workspace members can view participants"
  ON public.participants FOR SELECT TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can create participants"
  ON public.participants FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Owners admins and creators can update participants"
  ON public.participants FOR UPDATE TO authenticated
  USING (has_workspace_role(workspace_id, auth.uid(), 'owner') OR has_workspace_role(workspace_id, auth.uid(), 'admin') OR created_by = auth.uid());

CREATE POLICY "Owners and admins can delete participants"
  ON public.participants FOR DELETE TO authenticated
  USING (has_workspace_role(workspace_id, auth.uid(), 'owner') OR has_workspace_role(workspace_id, auth.uid(), 'admin'));

-- =============================================
-- Workspace member limit function + trigger
-- =============================================
CREATE OR REPLACE FUNCTION public.check_workspace_member_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  ws_tier TEXT;
  current_count INTEGER;
  max_members INTEGER;
BEGIN
  SELECT tier INTO ws_tier FROM public.workspaces WHERE id = NEW.workspace_id;
  SELECT COUNT(*) INTO current_count FROM public.workspace_memberships WHERE workspace_id = NEW.workspace_id;

  max_members := CASE ws_tier
    WHEN 'free' THEN 3
    WHEN 'starter' THEN 10
    WHEN 'professional' THEN 25
    WHEN 'enterprise' THEN 999999
    ELSE 3
  END;

  IF current_count >= max_members THEN
    RAISE EXCEPTION 'Workspace member limit reached (% members for % tier)', max_members, ws_tier;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_workspace_member_limit
  BEFORE INSERT ON public.workspace_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.check_workspace_member_limit();
