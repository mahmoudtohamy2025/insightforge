
-- Reusable tier limit enforcement function for projects, sessions, surveys
CREATE OR REPLACE FUNCTION public.check_workspace_resource_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ws_tier TEXT;
  current_count INTEGER;
  max_allowed INTEGER;
BEGIN
  SELECT tier INTO ws_tier FROM public.workspaces WHERE id = NEW.workspace_id;

  EXECUTE format('SELECT COUNT(*) FROM public.%I WHERE workspace_id = $1', TG_TABLE_NAME)
    INTO current_count USING NEW.workspace_id;

  max_allowed := CASE TG_TABLE_NAME
    WHEN 'projects' THEN CASE ws_tier
      WHEN 'free' THEN 2 WHEN 'starter' THEN 10
      WHEN 'professional' THEN 50 ELSE 999999 END
    WHEN 'sessions' THEN CASE ws_tier
      WHEN 'free' THEN 10 WHEN 'starter' THEN 50
      WHEN 'professional' THEN 200 ELSE 999999 END
    WHEN 'surveys' THEN CASE ws_tier
      WHEN 'free' THEN 5 WHEN 'starter' THEN 25
      WHEN 'professional' THEN 100 ELSE 999999 END
    ELSE 999999 END;

  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'tier_limit_reached:% limit reached (% for % tier)',
      TG_TABLE_NAME, max_allowed, ws_tier;
  END IF;

  RETURN NEW;
END;
$$;

-- Add triggers
CREATE TRIGGER check_project_limit
  BEFORE INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.check_workspace_resource_limit();

CREATE TRIGGER check_session_limit
  BEFORE INSERT ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.check_workspace_resource_limit();

CREATE TRIGGER check_survey_limit
  BEFORE INSERT ON public.surveys
  FOR EACH ROW EXECUTE FUNCTION public.check_workspace_resource_limit();
