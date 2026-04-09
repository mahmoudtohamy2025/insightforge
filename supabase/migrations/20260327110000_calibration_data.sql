-- =====================================================
-- Phase 4B: Calibration Data Table
-- =====================================================

CREATE TABLE public.calibration_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id UUID NOT NULL REFERENCES public.segment_profiles(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('survey', 'session', 'manual')),
  source_id UUID,
  real_response_text TEXT NOT NULL,
  real_sentiment FLOAT,
  real_themes TEXT[] DEFAULT '{}',
  matched_twin_response_id UUID REFERENCES public.twin_responses(id),
  accuracy_score FLOAT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_calibration_data_segment ON public.calibration_data(segment_id);
CREATE INDEX idx_calibration_data_source ON public.calibration_data(source_type, source_id);

-- RLS: accessible via segment → workspace chain
ALTER TABLE public.calibration_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_members_select_calibration" ON public.calibration_data
  FOR SELECT USING (
    segment_id IN (
      SELECT id FROM public.segment_profiles WHERE workspace_id IN (
        SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "workspace_members_insert_calibration" ON public.calibration_data
  FOR INSERT WITH CHECK (
    segment_id IN (
      SELECT id FROM public.segment_profiles WHERE workspace_id IN (
        SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
      )
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "workspace_members_delete_calibration" ON public.calibration_data
  FOR DELETE USING (
    segment_id IN (
      SELECT id FROM public.segment_profiles WHERE workspace_id IN (
        SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()
      )
    )
  );
