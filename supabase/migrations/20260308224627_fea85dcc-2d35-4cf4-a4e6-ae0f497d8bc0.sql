
-- Add branding columns to workspaces
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS logo_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS brand_primary_color varchar(7) DEFAULT '#6366f1',
  ADD COLUMN IF NOT EXISTS brand_accent_color varchar(7) DEFAULT '#f59e0b',
  ADD COLUMN IF NOT EXISTS default_locale varchar(5) DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS default_timezone varchar(50) DEFAULT 'Asia/Riyadh';

-- Create workspace-logos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('workspace-logos', 'workspace-logos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: anyone can read logos (public bucket for survey branding)
CREATE POLICY "Public read access for workspace logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'workspace-logos');

-- RLS: workspace owners/admins can upload logos
CREATE POLICY "Workspace members can upload logos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'workspace-logos');

-- RLS: workspace members can update/delete their logos
CREATE POLICY "Workspace members can update logos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'workspace-logos');

CREATE POLICY "Workspace members can delete logos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'workspace-logos');
