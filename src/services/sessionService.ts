/**
 * Session Service — Data access layer for sessions, transcripts, notes, themes.
 */
import { supabase } from "@/integrations/supabase/client";

// ── Types ──────────────────────────────────────────────

export interface SessionRecord {
  id: string;
  workspace_id: string;
  project_id: string | null;
  title: string;
  type: string;
  status: string;
  scheduled_at: string | null;
  duration_minutes: number | null;
  meeting_url: string | null;
  created_at: string;
}

export interface SessionListItem {
  id: string;
  title: string;
  type: string;
  status: string;
  scheduled_at: string | null;
  created_at: string;
  project_id: string | null;
}

// ── Queries ────────────────────────────────────────────

/**
 * List sessions for a workspace with optional filtering.
 */
export async function getSessions(
  workspaceId: string,
  options?: { status?: string; limit?: number }
): Promise<SessionListItem[]> {
  let query = supabase
    .from("sessions")
    .select("id, title, type, status, scheduled_at, created_at, project_id")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (options?.status) {
    query = query.eq("status", options.status);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as SessionListItem[];
}

/**
 * Fetch a single session by ID with full details.
 */
export async function getSessionById(sessionId: string): Promise<SessionRecord | null> {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();
  if (error) return null;
  return data as unknown as SessionRecord;
}

/**
 * Get recent sessions for the dashboard widget.
 */
export async function getRecentSessions(
  workspaceId: string,
  limit = 5
): Promise<SessionListItem[]> {
  return getSessions(workspaceId, { limit });
}

/**
 * Create a new session.
 */
export async function createSession(
  workspaceId: string,
  session: {
    title: string;
    type: string;
    scheduled_at?: string;
    meeting_url?: string;
    project_id?: string;
  }
): Promise<SessionRecord> {
  const { data, error } = await supabase
    .from("sessions")
    .insert({
      workspace_id: workspaceId,
      title: session.title,
      type: session.type,
      status: "draft",
      scheduled_at: session.scheduled_at || null,
      meeting_url: session.meeting_url || null,
      project_id: session.project_id || null,
    } as any)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as SessionRecord;
}

/**
 * Update session status.
 */
export async function updateSessionStatus(
  sessionId: string,
  status: string
): Promise<void> {
  const { error } = await supabase
    .from("sessions")
    .update({ status } as any)
    .eq("id", sessionId);
  if (error) throw error;
}
