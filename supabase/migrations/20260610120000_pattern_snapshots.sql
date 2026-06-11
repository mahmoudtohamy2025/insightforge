-- pattern_snapshots: time-series snapshots of insight_patterns taken at each
-- synthesis run, powering trend detection (new / recurring / trending) in the
-- Insights → Patterns tab.
--
-- Codifies a table the shipped code already uses on both ends but which never
-- had a migration (found 2026-06-10, PRD known issue #13):
--   - writer: supabase/functions/synthesize-insights/index.ts (service role,
--     insert wrapped non-fatal — so prod synthesis kept working while these
--     writes silently failed)
--   - reader: src/components/insights/ResearchPatternsTab.tsx (degrades to a
--     previous-run comparison when no snapshots exist)
-- Until this is applied to prod, behavior is unchanged; applying it makes the
-- trend feature work as designed.

CREATE TABLE IF NOT EXISTS public.pattern_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  pattern_id UUID NOT NULL REFERENCES public.insight_patterns(id) ON DELETE CASCADE,
  session_count INTEGER NOT NULL DEFAULT 0,
  sentiment VARCHAR(20) NOT NULL DEFAULT 'neutral',
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pattern_snapshots_workspace
  ON public.pattern_snapshots (workspace_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_pattern_snapshots_pattern
  ON public.pattern_snapshots (pattern_id, snapshot_date DESC);

ALTER TABLE public.pattern_snapshots ENABLE ROW LEVEL SECURITY;

-- Reads: workspace members (the Patterns tab queries with the user's JWT).
-- Writes: only the service-role synthesize-insights function (BYPASSRLS), so
-- no INSERT/UPDATE/DELETE policies are granted to authenticated users.
CREATE POLICY "Workspace members can view pattern snapshots"
  ON public.pattern_snapshots FOR SELECT
  USING (public.is_workspace_member(workspace_id, auth.uid()));
