-- =====================================================
-- Phase 4D: Moat & Monetization
-- 3. Audit Triggers for SOC 2 Automation
-- =====================================================

-- Trigger function to log workspace membership changes
CREATE OR REPLACE FUNCTION public.log_workspace_membership_change()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (workspace_id, action, resource_type, resource_id, details)
    VALUES (NEW.workspace_id, 'membership_added', 'workspace_membership', NEW.id, jsonb_build_object('user_id', NEW.user_id, 'role', NEW.role));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (workspace_id, action, resource_type, resource_id, details)
    VALUES (OLD.workspace_id, 'membership_removed', 'workspace_membership', OLD.id, jsonb_build_object('user_id', OLD.user_id, 'role', OLD.role));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger to workspace_memberships
DROP TRIGGER IF EXISTS trigger_log_workspace_membership ON public.workspace_memberships;
CREATE TRIGGER trigger_log_workspace_membership
  AFTER INSERT OR DELETE ON public.workspace_memberships
  FOR EACH ROW EXECUTE FUNCTION public.log_workspace_membership_change();


-- Trigger function to log API key creation
CREATE OR REPLACE FUNCTION public.log_api_key_creation()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.audit_logs (workspace_id, user_id, action, resource_type, resource_id, details)
  -- In Supabase we could get user from auth.uid() if created via client, but sometimes service role creates it.
  VALUES (NEW.workspace_id, auth.uid(), 'api_key_created', 'workspace_api_key', NEW.id, jsonb_build_object('name', NEW.name));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger to workspace_api_keys
DROP TRIGGER IF EXISTS trigger_log_api_key ON public.workspace_api_keys;
CREATE TRIGGER trigger_log_api_key
  AFTER INSERT ON public.workspace_api_keys
  FOR EACH ROW EXECUTE FUNCTION public.log_api_key_creation();


-- Trigger function to log simulation execution
CREATE OR REPLACE FUNCTION public.log_simulation_run()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.audit_logs (workspace_id, user_id, action, resource_type, resource_id, details)
  VALUES (NEW.workspace_id, NEW.created_by, 'simulation_run', 'simulation', NEW.id, jsonb_build_object('type', NEW.type, 'status', NEW.status));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger to simulations
DROP TRIGGER IF EXISTS trigger_log_simulation ON public.simulations;
CREATE TRIGGER trigger_log_simulation
  AFTER INSERT ON public.simulations
  FOR EACH ROW EXECUTE FUNCTION public.log_simulation_run();
