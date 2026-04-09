/**
 * Segment Service — Data access layer for segment_profiles.
 * Centralizes all Supabase queries for Digital Twin segments.
 */
import { supabase } from "@/integrations/supabase/client";

export interface SegmentProfile {
  id: string;
  workspace_id: string;
  name: string;
  demographics: Record<string, any>;
  psychographics: Record<string, any>;
  behavioral_data: Record<string, any>;
  cultural_context: Record<string, any>;
  calibration_score: number | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch all segments for a workspace, ordered by name.
 */
export async function getSegments(workspaceId: string): Promise<SegmentProfile[]> {
  const { data, error } = await supabase
    .from("segment_profiles")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("name");
  if (error) throw error;
  return (data ?? []) as unknown as SegmentProfile[];
}

/**
 * Fetch a single segment by ID.
 */
export async function getSegmentById(segmentId: string): Promise<SegmentProfile | null> {
  const { data, error } = await supabase
    .from("segment_profiles")
    .select("*")
    .eq("id", segmentId)
    .single();
  if (error) return null;
  return data as unknown as SegmentProfile;
}

/**
 * Create a new segment profile.
 */
export async function createSegment(
  workspaceId: string,
  userId: string,
  segment: {
    name: string;
    demographics?: Record<string, any>;
    psychographics?: Record<string, any>;
    behavioral_data?: Record<string, any>;
    cultural_context?: Record<string, any>;
  }
): Promise<SegmentProfile> {
  const { data, error } = await supabase
    .from("segment_profiles")
    .insert({
      workspace_id: workspaceId,
      name: segment.name,
      demographics: segment.demographics || {},
      psychographics: segment.psychographics || {},
      behavioral_data: segment.behavioral_data || {},
      cultural_context: segment.cultural_context || {},
      created_by: userId,
    } as any)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as SegmentProfile;
}

/**
 * Delete a segment profile.
 */
export async function deleteSegment(segmentId: string): Promise<void> {
  const { error } = await supabase
    .from("segment_profiles")
    .delete()
    .eq("id", segmentId);
  if (error) throw error;
}
