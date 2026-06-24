-- A4 — make data-retention deletion actually run.
--
-- The cleanup-expired-data edge function implements per-workspace retention
-- (delete session_transcripts/notes/themes + survey_responses older than the
-- workspace's data_retention_days) but nothing ever scheduled it, so retention
-- deletion never happened. Rather than schedule the HTTP function (which needs
-- the CRON_SECRET), replicate the deletion as a SECURITY DEFINER SQL function and
-- run it via pg_cron (already enabled by the keep-warm migration). Set-based and
-- self-contained — no HTTP, no secret.

CREATE OR REPLACE FUNCTION public.run_retention_cleanup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.session_transcripts t USING public.workspaces w
   WHERE t.workspace_id = w.id AND w.data_retention_days IS NOT NULL
     AND t.created_at < now() - (w.data_retention_days || ' days')::interval;

  DELETE FROM public.session_notes n USING public.workspaces w
   WHERE n.workspace_id = w.id AND w.data_retention_days IS NOT NULL
     AND n.created_at < now() - (w.data_retention_days || ' days')::interval;

  DELETE FROM public.session_themes th USING public.workspaces w
   WHERE th.workspace_id = w.id AND w.data_retention_days IS NOT NULL
     AND th.created_at < now() - (w.data_retention_days || ' days')::interval;

  DELETE FROM public.survey_responses r USING public.workspaces w
   WHERE r.workspace_id = w.id AND w.data_retention_days IS NOT NULL
     AND r.created_at < now() - (w.data_retention_days || ' days')::interval;
END;
$$;

-- Lock the function down (it deletes data; only the cron/postgres should call it).
REVOKE ALL ON FUNCTION public.run_retention_cleanup() FROM anon, authenticated;

-- Schedule daily at 03:00 UTC. Idempotent-ish: unschedule any prior job first.
DO $$
BEGIN
  PERFORM cron.unschedule('retention-cleanup');
EXCEPTION WHEN OTHERS THEN
  NULL; -- no existing job
END $$;

SELECT cron.schedule('retention-cleanup', '0 3 * * *', $cron$SELECT public.run_retention_cleanup();$cron$);
