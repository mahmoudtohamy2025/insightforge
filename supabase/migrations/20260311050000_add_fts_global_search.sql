-- Full-text search infrastructure for global search
-- Add tsvector columns with GIN indexes for fast text search

-- session_transcripts FTS
ALTER TABLE session_transcripts ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(raw_text, ''))) STORED;
CREATE INDEX IF NOT EXISTS idx_transcripts_fts ON session_transcripts USING GIN (fts);

-- session_themes FTS
ALTER TABLE session_themes ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))) STORED;
CREATE INDEX IF NOT EXISTS idx_themes_fts ON session_themes USING GIN (fts);

-- insight_patterns FTS
ALTER TABLE insight_patterns ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))) STORED;
CREATE INDEX IF NOT EXISTS idx_patterns_fts ON insight_patterns USING GIN (fts);

-- session_notes FTS
ALTER TABLE session_notes ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(note_text, ''))) STORED;
CREATE INDEX IF NOT EXISTS idx_notes_fts ON session_notes USING GIN (fts);

-- Global search RPC function
CREATE OR REPLACE FUNCTION global_search(
  ws_id UUID,
  search_query TEXT,
  entity_types TEXT[] DEFAULT ARRAY['transcripts','themes','patterns','notes'],
  result_limit INT DEFAULT 20,
  result_offset INT DEFAULT 0
)
RETURNS TABLE (
  entity_type TEXT,
  entity_id UUID,
  title TEXT,
  snippet TEXT,
  relevance REAL,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  tsquery_val tsquery;
BEGIN
  -- Build tsquery from search string
  tsquery_val := plainto_tsquery('english', search_query);

  RETURN QUERY
  (
    -- Search transcripts
    SELECT
      'transcript'::TEXT AS entity_type,
      st.session_id AS entity_id,
      s.title AS title,
      ts_headline('english', st.raw_text, tsquery_val,
        'MaxWords=30, MinWords=10, StartSel=<<, StopSel=>>') AS snippet,
      ts_rank(st.fts, tsquery_val)::REAL AS relevance,
      st.created_at
    FROM session_transcripts st
    JOIN sessions s ON s.id = st.session_id
    WHERE st.workspace_id = ws_id
      AND 'transcripts' = ANY(entity_types)
      AND st.fts @@ tsquery_val

    UNION ALL

    -- Search themes
    SELECT
      'theme'::TEXT,
      th.session_id,
      th.title,
      ts_headline('english', coalesce(th.description, th.title), tsquery_val,
        'MaxWords=30, MinWords=10, StartSel=<<, StopSel=>>'),
      ts_rank(th.fts, tsquery_val)::REAL,
      th.created_at
    FROM session_themes th
    WHERE th.workspace_id = ws_id
      AND 'themes' = ANY(entity_types)
      AND th.fts @@ tsquery_val

    UNION ALL

    -- Search insight patterns
    SELECT
      'pattern'::TEXT,
      ip.id,
      ip.title,
      ts_headline('english', coalesce(ip.description, ip.title), tsquery_val,
        'MaxWords=30, MinWords=10, StartSel=<<, StopSel=>>'),
      ts_rank(ip.fts, tsquery_val)::REAL,
      ip.created_at
    FROM insight_patterns ip
    WHERE ip.workspace_id = ws_id
      AND 'patterns' = ANY(entity_types)
      AND ip.fts @@ tsquery_val

    UNION ALL

    -- Search notes
    SELECT
      'note'::TEXT,
      sn.session_id,
      sn.note_text,
      ts_headline('english', sn.note_text, tsquery_val,
        'MaxWords=30, MinWords=10, StartSel=<<, StopSel=>>'),
      ts_rank(sn.fts, tsquery_val)::REAL,
      sn.created_at
    FROM session_notes sn
    WHERE sn.workspace_id = ws_id
      AND 'notes' = ANY(entity_types)
      AND sn.fts @@ tsquery_val
  )
  ORDER BY relevance DESC
  LIMIT result_limit
  OFFSET result_offset;
END;
$$;
