-- Media uploads table for audio/video transcription
CREATE TABLE IF NOT EXISTS session_media (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('audio', 'video')),
  mime_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  transcription_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (transcription_status IN ('pending', 'processing', 'completed', 'failed')),
  transcription_error TEXT,
  duration_seconds REAL,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_session_media_session ON session_media(session_id);
CREATE INDEX IF NOT EXISTS idx_session_media_workspace ON session_media(workspace_id);
CREATE INDEX IF NOT EXISTS idx_session_media_status ON session_media(transcription_status);

-- RLS
ALTER TABLE session_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_members_read_media" ON session_media
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_members_insert_media" ON session_media
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_memberships WHERE user_id = auth.uid()
    )
    AND uploaded_by = auth.uid()
  );

CREATE POLICY "users_delete_own_media" ON session_media
  FOR DELETE USING (uploaded_by = auth.uid());

-- Create storage bucket for session media (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('session-media', 'session-media', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "workspace_members_upload_media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'session-media');

CREATE POLICY "workspace_members_read_media_files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'session-media');

CREATE POLICY "workspace_members_delete_media_files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'session-media');
