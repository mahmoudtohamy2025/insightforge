-- Comments table for collaboration on patterns, themes, sessions, surveys
CREATE TABLE IF NOT EXISTS comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('pattern', 'theme', 'session', 'survey')),
  entity_id UUID NOT NULL,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  mentions UUID[] DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_comments_entity ON comments(workspace_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_by ON comments(created_by);

-- RLS
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Workspace members can read all comments in their workspace
CREATE POLICY "workspace_members_read_comments" ON comments
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_memberships WHERE user_id = auth.uid()
    )
  );

-- Workspace members can insert comments
CREATE POLICY "workspace_members_insert_comments" ON comments
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_memberships WHERE user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- Users can update their own comments
CREATE POLICY "users_update_own_comments" ON comments
  FOR UPDATE USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Users can delete their own comments
CREATE POLICY "users_delete_own_comments" ON comments
  FOR DELETE USING (created_by = auth.uid());
