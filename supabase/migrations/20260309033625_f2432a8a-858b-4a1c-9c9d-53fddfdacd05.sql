
-- GIN index for full-text search on session_transcripts.raw_text
CREATE INDEX IF NOT EXISTS idx_session_transcripts_raw_text_fts
ON public.session_transcripts
USING GIN (to_tsvector('simple', raw_text));

-- Function to search transcripts across a workspace
CREATE OR REPLACE FUNCTION public.search_transcripts(ws_id uuid, search_query text)
RETURNS TABLE (
  transcript_id uuid,
  session_id uuid,
  session_title text,
  language character varying,
  snippet text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    st.id AS transcript_id,
    st.session_id,
    s.title AS session_title,
    st.language,
    ts_headline('simple', st.raw_text, plainto_tsquery('simple', search_query),
      'MaxWords=35, MinWords=15, StartSel=**, StopSel=**') AS snippet,
    st.created_at
  FROM public.session_transcripts st
  JOIN public.sessions s ON s.id = st.session_id
  WHERE st.workspace_id = ws_id
    AND to_tsvector('simple', st.raw_text) @@ plainto_tsquery('simple', search_query)
  ORDER BY st.created_at DESC
  LIMIT 50;
$$;
