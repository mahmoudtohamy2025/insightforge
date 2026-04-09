-- Add timestamp columns for survey lifecycle tracking
ALTER TABLE public.surveys
  ADD COLUMN IF NOT EXISTS launched_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz;

-- Auto-completion trigger: increment response_count and auto-complete when target reached
CREATE OR REPLACE FUNCTION public.handle_survey_response_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  survey_record RECORD;
BEGIN
  UPDATE public.surveys
    SET response_count = response_count + 1,
        updated_at = now()
    WHERE id = NEW.survey_id
    RETURNING response_count, target_responses, status INTO survey_record;

  IF survey_record.status = 'live'
     AND survey_record.target_responses > 0
     AND survey_record.response_count >= survey_record.target_responses THEN
    UPDATE public.surveys
      SET status = 'completed', completed_at = now(), updated_at = now()
      WHERE id = NEW.survey_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_survey_response_insert
  AFTER INSERT ON public.survey_responses
  FOR EACH ROW EXECUTE FUNCTION public.handle_survey_response_insert();