-- audit_logs append-only enforcement (Trust Center claims "append-only" — make
-- it structural, not just an RLS default).
--
-- RLS already grants only SELECT + INSERT to API clients, but RLS does not bind
-- the service role, and a future careless policy could open UPDATE/DELETE.
--
-- Semantics:
--   - UPDATE: blocked at any depth (no legitimate path mutates an audit row).
--   - DELETE at trigger depth 1 (a direct statement — any role, including the
--     service role): blocked.
--   - DELETE at depth >= 2 (fired from inside another trigger, i.e. the
--     workspaces ON DELETE CASCADE referential action): allowed. Workspace
--     deletion is a live owner-facing feature (WorkspaceTab.tsx) and audit rows
--     die only with their workspace.
--
-- ⚠ Before applying to prod: run a local `supabase db reset` and verify that
--   (a) a direct DELETE/UPDATE on audit_logs raises, and (b) deleting a
--   workspace still cascades cleanly. Operator escape hatch if ever needed:
--   ALTER TABLE public.audit_logs DISABLE TRIGGER audit_logs_append_only;

CREATE OR REPLACE FUNCTION public.audit_logs_block_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'audit_logs is append-only: UPDATE is not allowed';
  END IF;
  IF pg_trigger_depth() = 1 THEN
    RAISE EXCEPTION 'audit_logs is append-only: direct DELETE is not allowed (rows are removed only via the workspace deletion cascade)';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS audit_logs_append_only ON public.audit_logs;
CREATE TRIGGER audit_logs_append_only
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_logs_block_mutation();
