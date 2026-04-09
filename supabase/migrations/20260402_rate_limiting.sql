-- ================================================
-- InsightForge: Rate Limiting Tables Migration
-- ================================================
-- Paste this ENTIRE SQL into Supabase SQL Editor → Run
-- This creates the tables needed for per-workspace token budgets
-- and per-minute rate limiting on AI features.
-- ================================================

-- Monthly usage summary per workspace
CREATE TABLE IF NOT EXISTS workspace_token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL, -- First of month
  tokens_used BIGINT NOT NULL DEFAULT 0,
  request_count INT NOT NULL DEFAULT 0,
  last_request_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- One record per workspace per month
  UNIQUE(workspace_id, period_start)
);

-- Per-request log for minute-level rate limiting
CREATE TABLE IF NOT EXISTS workspace_token_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  tokens_used INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast rate limit queries (recent requests per workspace)
CREATE INDEX IF NOT EXISTS idx_token_log_workspace_created
ON workspace_token_usage_log(workspace_id, created_at DESC);

-- Index for monthly usage lookup
CREATE INDEX IF NOT EXISTS idx_token_usage_workspace_period
ON workspace_token_usage(workspace_id, period_start);

-- Auto-cleanup: Delete per-request logs older than 24 hours (saves storage)
-- This runs via a cron job or pg_cron if available
-- You can set this up in Supabase Dashboard → Database → Extensions → pg_cron
-- Example cron: SELECT cron.schedule('cleanup-token-logs', '0 * * * *', 'DELETE FROM workspace_token_usage_log WHERE created_at < NOW() - INTERVAL ''24 hours''');

-- Enable RLS (Row Level Security)
ALTER TABLE workspace_token_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_token_usage_log ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (edge functions use service role)
CREATE POLICY "service_role_all_token_usage"
  ON workspace_token_usage
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_all_token_log"
  ON workspace_token_usage_log
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Allow workspace members to read their own usage
CREATE POLICY "members_read_token_usage"
  ON workspace_token_usage
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_memberships
      WHERE user_id = auth.uid()
    )
  );

-- Grant permissions
GRANT ALL ON workspace_token_usage TO service_role;
GRANT ALL ON workspace_token_usage_log TO service_role;
GRANT SELECT ON workspace_token_usage TO authenticated;
