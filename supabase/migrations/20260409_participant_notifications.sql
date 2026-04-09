-- ============================================================
-- InsightForge Participant Notifications Migration
-- ============================================================

CREATE TABLE IF NOT EXISTS participant_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info','success','warning','error','study_match','payment','approval','bonus')),
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for real-time reads
CREATE INDEX IF NOT EXISTS idx_participant_notifications_user ON participant_notifications(user_id);

-- Enable RLS
ALTER TABLE participant_notifications ENABLE ROW LEVEL SECURITY;

-- Policy to allow participants to select/update their own notifications
CREATE POLICY "participant_select_own_notifications" ON participant_notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "participant_update_own_notifications" ON participant_notifications
  FOR UPDATE USING (auth.uid() = user_id);
  
CREATE POLICY "participant_delete_own_notifications" ON participant_notifications
  FOR DELETE USING (auth.uid() = user_id);
