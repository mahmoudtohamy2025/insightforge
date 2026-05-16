-- P0.2 — Add workspaces table to the supabase_realtime publication.
--
-- This is required for the frontend useSubscription hook to listen for
-- tier-column updates (driven by the stripe-webhook edge function) instead
-- of polling Stripe every 60 seconds per browser tab.
--
-- See: src/hooks/useSubscription.ts (frontend listener)
--      supabase/functions/_shared/tierEnforcement.ts (backend cache read)
--      supabase/functions/stripe-webhook/index.ts (cache invalidator)
--
-- Idempotent: only adds the table if it isn't already in the publication.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'workspaces'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.workspaces;
  END IF;
END $$;
