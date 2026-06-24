-- A8 — drop dead schema remnants from killed features (PRD §15 cleanup).
--
-- - workspace_branding: White-Label feature was killed 2026-05-19; the table is
--   schema-only (no writer, nothing in the app applies branding).
-- - workspace_integrations: Integrations tab (Slack/Zapier/Jira) was killed
--   2026-05-19; schema-only remnant.
-- - simulations.type CHECK still allowed 'market_sim' and 'policy' (the killed
--   Market Simulator / Policy Simulator studios); narrow it to the live types.
--
-- ⚠ Before applying to prod: confirm the two tables are empty and no simulations
--   row uses 'market_sim'/'policy' (this migration reclassifies any stragglers to
--   'solo' so the tightened CHECK validates). Reversible only from git history —
--   these are deliberate drops of confirmed-dead, unreferenced objects.

DROP TABLE IF EXISTS public.workspace_branding CASCADE;
DROP TABLE IF EXISTS public.workspace_integrations CASCADE;

-- Tighten simulations.type: drop whatever CHECK currently allows the dead values,
-- reclassify any vestigial rows, then re-add a clean constraint.
DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c
    FROM pg_constraint
   WHERE conrelid = 'public.simulations'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%market_sim%';
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.simulations DROP CONSTRAINT %I', c);
  END IF;
END $$;

UPDATE public.simulations SET type = 'solo' WHERE type IN ('market_sim', 'policy');

ALTER TABLE public.simulations
  ADD CONSTRAINT simulations_type_check CHECK (type IN ('solo', 'focus_group', 'ab_test'));
