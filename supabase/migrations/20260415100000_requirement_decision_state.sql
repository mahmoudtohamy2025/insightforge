-- =====================================================
-- Persisted founder decision state for requirements
-- Adds canonical confidence rails and decision memo fields
-- =====================================================

ALTER TABLE public.requirements
  ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(4,3) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  ADD COLUMN IF NOT EXISTS confidence_label TEXT CHECK (confidence_label IN ('high', 'medium', 'low')),
  ADD COLUMN IF NOT EXISTS evidence_status TEXT CHECK (evidence_status IN ('strong', 'building', 'sparse')),
  ADD COLUMN IF NOT EXISTS recommended_next_action TEXT,
  ADD COLUMN IF NOT EXISTS decision_memo JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_evaluated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_requirements_confidence_label ON public.requirements(confidence_label);
CREATE INDEX IF NOT EXISTS idx_requirements_evidence_status ON public.requirements(evidence_status);

CREATE OR REPLACE FUNCTION public.sync_requirement_decision_state()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  evidence_count INTEGER := 0;
  ai_confidence NUMERIC;
  twin_matches INTEGER := 0;
  computed_confidence NUMERIC := 0.52;
  computed_confidence_label TEXT := 'medium';
  computed_evidence_status TEXT := 'sparse';
  summary_text TEXT := 'No summary yet.';
  recommendation_text TEXT := 'Do not ship yet. Gather more evidence first.';
  risk_text TEXT := 'There is not enough evidence yet to make a confident founder call.';
  next_action_text TEXT := 'Run a synthetic test first, then escalate to participants or focus groups if the bet still matters.';
  effort_text TEXT := NULL;
BEGIN
  evidence_count :=
    COALESCE(cardinality(NEW.linked_project_ids), 0) +
    COALESCE(cardinality(NEW.linked_session_ids), 0) +
    COALESCE(cardinality(NEW.linked_survey_ids), 0) +
    COALESCE(cardinality(NEW.linked_simulation_ids), 0) +
    COALESCE(cardinality(NEW.linked_insight_ids), 0);

  ai_confidence := NULLIF(NEW.ai_methodology_suggestion ->> 'confidence_score', '')::NUMERIC;
  twin_matches := COALESCE(NULLIF(NEW.ai_methodology_suggestion ->> 'matching_twin_count', '')::INTEGER, 0);
  effort_text := COALESCE(NULLIF(NEW.ai_methodology_suggestion ->> 'estimated_effort', ''), NEW.estimated_effort);

  IF ai_confidence IS NOT NULL THEN
    computed_confidence := ai_confidence;
  ELSE
    computed_confidence :=
      CASE NEW.status
        WHEN 'submitted' THEN 0.35
        WHEN 'under_review' THEN 0.48
        WHEN 'approved' THEN 0.60
        WHEN 'in_progress' THEN 0.68
        WHEN 'insights_ready' THEN 0.80
        WHEN 'completed' THEN 0.90
        WHEN 'declined' THEN 0.32
        WHEN 'on_hold' THEN 0.40
        ELSE 0.52
      END;

    computed_confidence := computed_confidence +
      CASE NEW.priority
        WHEN 'critical' THEN -0.08
        WHEN 'high' THEN -0.03
        WHEN 'medium' THEN 0
        WHEN 'low' THEN 0.04
        ELSE 0
      END;

    computed_confidence := computed_confidence + LEAST(evidence_count * 0.04, 0.16);

    IF twin_matches > 0 THEN
      computed_confidence := computed_confidence + LEAST(twin_matches * 0.01, 0.06);
    END IF;
  END IF;

  computed_confidence := GREATEST(0, LEAST(0.96, computed_confidence));

  IF evidence_count >= 4 THEN
    computed_evidence_status := 'strong';
  ELSIF evidence_count >= 2 THEN
    computed_evidence_status := 'building';
  ELSE
    computed_evidence_status := 'sparse';
  END IF;

  IF computed_confidence >= 0.8 THEN
    computed_confidence_label := 'high';
    recommendation_text := 'Ship the decision with monitoring.';
    risk_text := 'Main risk is execution quality after the decision ships.';
    next_action_text := 'Turn this into a decision memo, align stakeholders, and ship with monitoring.';
  ELSIF computed_confidence >= 0.6 THEN
    computed_confidence_label := 'medium';
    recommendation_text := 'Validate with a smaller real-user loop before rollout.';
    risk_text := 'The current evidence is promising, but the bet can still fail in live usage.';
    next_action_text := 'Run a fast real-user check with surveys or participant sessions before committing broadly.';
  ELSE
    computed_confidence_label := 'low';
    recommendation_text := 'Do not ship yet. Gather more evidence first.';
    risk_text := 'There is not enough evidence yet to make a confident founder call.';
    next_action_text := 'Run a synthetic test first, then escalate to participants or focus groups if the bet still matters.';
  END IF;

  summary_text := COALESCE(
    NULLIF(BTRIM(NEW.findings_summary), ''),
    NULLIF(BTRIM(NEW.description), ''),
    NULLIF(BTRIM(NEW.business_context), ''),
    'No summary yet.'
  );

  NEW.confidence_score := computed_confidence;
  NEW.confidence_label := computed_confidence_label;
  NEW.evidence_status := computed_evidence_status;
  NEW.recommended_next_action := next_action_text;
  NEW.last_evaluated_at := NOW();
  NEW.decision_memo := jsonb_strip_nulls(
    jsonb_build_object(
      'recommendation', recommendation_text,
      'confidence', INITCAP(computed_confidence_label) || ' confidence',
      'evidence',
        CASE computed_evidence_status
          WHEN 'strong' THEN 'Strong evidence'
          WHEN 'building' THEN 'Building evidence'
          ELSE 'Sparse evidence'
        END,
      'summary', summary_text,
      'risk', risk_text,
      'next_action', next_action_text,
      'estimated_effort', effort_text
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_requirements_decision_state ON public.requirements;

CREATE TRIGGER trg_requirements_decision_state
  BEFORE INSERT OR UPDATE ON public.requirements
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_requirement_decision_state();

UPDATE public.requirements
SET title = title;
