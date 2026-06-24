-- Fix: deleting a workspace fails (23503) whenever it has memberships.
--
-- Root cause: log_workspace_membership_change() fires AFTER INSERT OR DELETE on
-- workspace_memberships. In a workspace teardown, the ON DELETE CASCADE removes
-- the parent workspace row first, then cascades to its memberships — so by the
-- time this trigger's DELETE branch runs, OLD.workspace_id no longer exists in
-- workspaces, and the audit INSERT violates audit_logs_workspace_id_fkey
-- (audit_logs.workspace_id REFERENCES workspaces(id) ON DELETE CASCADE).
--
-- audit_logs already cascades with the workspace, and the simulation/api_key
-- audit triggers are AFTER INSERT only (they never fire during a delete), so the
-- membership DELETE branch is the sole offender.
--
-- Fix: in the DELETE branch, write the audit row ONLY when the parent workspace
-- still exists (a genuine membership removal). During a workspace teardown the
-- workspace is gone, the entire audit history is being cascade-removed anyway, so
-- skipping the membership_removed row loses nothing and lets the cascade complete.
-- INSERT branch unchanged. Also hardens the function with SET search_path = ''
-- (SECURITY DEFINER best practice; all object refs are already schema-qualified).

CREATE OR REPLACE FUNCTION public.log_workspace_membership_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (workspace_id, action, resource_type, resource_id, details)
    VALUES (NEW.workspace_id, 'membership_added', 'workspace_membership', NEW.id,
            jsonb_build_object('user_id', NEW.user_id, 'role', NEW.role));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Skip when the parent workspace is already gone: this DELETE is part of a
    -- workspace-deletion cascade, and writing it would violate
    -- audit_logs_workspace_id_fkey (the audit history dies with the workspace).
    IF EXISTS (SELECT 1 FROM public.workspaces WHERE id = OLD.workspace_id) THEN
      INSERT INTO public.audit_logs (workspace_id, action, resource_type, resource_id, details)
      VALUES (OLD.workspace_id, 'membership_removed', 'workspace_membership', OLD.id,
              jsonb_build_object('user_id', OLD.user_id, 'role', OLD.role));
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
