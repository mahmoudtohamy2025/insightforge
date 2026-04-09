-- Streak tracking for earnings gamification (T6)
-- Adds streak_weeks, streak_bonus_pct, last_activity_week columns to participant_reputation

ALTER TABLE participant_reputation
  ADD COLUMN IF NOT EXISTS streak_weeks       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak_bonus_pct   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_activity_week DATE;

-- Index for streak lookups
CREATE INDEX IF NOT EXISTS idx_rep_streak ON participant_reputation(streak_weeks DESC);

COMMENT ON COLUMN participant_reputation.streak_weeks IS
  'Consecutive weeks with at least one approved study participation';
COMMENT ON COLUMN participant_reputation.streak_bonus_pct IS
  'Bonus percentage applied to earnings: 4wk=5%, 8wk=10%, 12wk=15%';
COMMENT ON COLUMN participant_reputation.last_activity_week IS
  'ISO week start date (Monday) of the most recent activity for streak tracking';
