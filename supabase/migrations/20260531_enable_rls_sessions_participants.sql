-- Tier-0 security fix (0.1): enable Row Level Security on the `sessions`
-- and `participants` base tables.
--
-- WHY: both tables were created (migration 20260308175347) with a full set of
-- correct, workspace-scoped policies, but RLS was never ENABLED — so the
-- policies are inert. Because the frontend reads/writes these tables with the
-- anon key, PostgREST applied no row filter: any authenticated user could read
-- or write EVERY workspace's sessions and EVERY participant's PII (name, email,
-- age, gender, location). This turns the existing policies on:
--   SELECT → is_workspace_member(workspace_id, auth.uid())
--   INSERT → is_workspace_member(...) AND created_by = auth.uid()
--   UPDATE → owner/admin/creator
--   DELETE → owner/admin
--
-- SAFE TO APPLY:
--   * All live insert paths set created_by (src/pages/Sessions.tsx:117,
--     src/pages/Participants.tsx:92, src/components/participants/CSVImportDialog.tsx:227),
--     so they satisfy the INSERT WITH CHECK.
--   * The only insert path that omits created_by — sessionService.createSession()
--     — is dead code (no callers; also references stale columns).
--   * Edge functions write these tables with the service-role key, which has
--     BYPASSRLS, so they are unaffected.
--   * ENABLE ROW LEVEL SECURITY is harmless if RLS is already on.
--
-- After applying, verify with Supabase's security advisor and confirm
-- cross-tenant reads are blocked.

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
