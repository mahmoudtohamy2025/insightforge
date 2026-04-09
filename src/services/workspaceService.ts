/**
 * Workspace Service — Data access layer for workspaces and memberships.
 */
import { supabase } from "@/integrations/supabase/client";

// ── Types ──────────────────────────────────────────────

export interface WorkspaceRecord {
  id: string;
  name: string;
  tier: string;
  created_at: string;
}

export interface WorkspaceMember {
  user_id: string;
  role: string;
  email?: string;
  full_name?: string;
}

export interface WorkspaceStats {
  totalSurveys: number;
  activeSessions: number;
  totalParticipants: number;
  insightsGenerated: number;
}

// ── Queries ────────────────────────────────────────────

/**
 * Fetch dashboard statistics for a workspace.
 */
export async function getDashboardStats(workspaceId: string): Promise<WorkspaceStats> {
  const [surveys, sessions, participants, insightPatterns] = await Promise.all([
    supabase.from("surveys").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("sessions").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("participants").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("insight_patterns").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
  ]);
  const liveSessions = await supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("status", "live");

  return {
    totalSurveys: surveys.count ?? 0,
    activeSessions: liveSessions.count ?? 0,
    totalParticipants: participants.count ?? 0,
    insightsGenerated: insightPatterns.count ?? 0,
  };
}

/**
 * Get workspace tier string.
 */
export async function getWorkspaceTier(workspaceId: string): Promise<string> {
  const { data } = await supabase
    .from("workspaces")
    .select("tier")
    .eq("id", workspaceId)
    .single();
  return (data as any)?.tier || "free";
}

/**
 * Get onboarding counts for checklist.
 */
export async function getOnboardingCounts(workspaceId: string) {
  const [twins, simulations, calibrations, members] = await Promise.all([
    supabase.from("segment_profiles").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("simulations").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("calibration_data").select("id", { count: "exact", head: true }),
    supabase.from("workspace_memberships").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
  ]);
  return {
    twins: twins.count ?? 0,
    simulations: simulations.count ?? 0,
    calibrations: calibrations.count ?? 0,
    members: members.count ?? 0,
  };
}
