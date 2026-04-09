
-- Add share_token and share_views to sessions
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS share_token uuid UNIQUE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS share_views integer NOT NULL DEFAULT 0;

-- Index for fast token lookup
CREATE INDEX IF NOT EXISTS idx_sessions_share_token ON public.sessions (share_token) WHERE share_token IS NOT NULL;

-- RPC function: get shared snapshot (no auth, SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_shared_snapshot(token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  sess record;
BEGIN
  -- Find session by share_token
  SELECT id, title, summary, type, duration_minutes, scheduled_date, workspace_id, created_at
  INTO sess
  FROM public.sessions
  WHERE share_token = token;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Increment view counter
  UPDATE public.sessions SET share_views = share_views + 1 WHERE share_token = token;

  -- Build result with themes
  SELECT jsonb_build_object(
    'title', sess.title,
    'summary', sess.summary,
    'type', sess.type,
    'duration_minutes', sess.duration_minutes,
    'scheduled_date', sess.scheduled_date,
    'created_at', sess.created_at,
    'share_views', sess.share_views + 1,
    'workspace', (
      SELECT jsonb_build_object(
        'name', w.name,
        'logo_url', w.logo_url,
        'brand_primary_color', w.brand_primary_color,
        'brand_accent_color', w.brand_accent_color
      )
      FROM public.workspaces w WHERE w.id = sess.workspace_id
    ),
    'themes', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'title', st.title,
          'description', st.description,
          'confidence_score', st.confidence_score,
          'evidence', st.evidence
        )
        ORDER BY st.confidence_score DESC NULLS LAST
      )
      FROM public.session_themes st WHERE st.session_id = sess.id
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;
