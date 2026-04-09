/**
 * Simulation Service — Data access layer for simulations + twin_responses.
 * Centralizes all Supabase queries and Edge Function invocations for simulations.
 */
import { supabase } from "@/integrations/supabase/client";

// ── Types ──────────────────────────────────────────────

export interface SimulationRecord {
  id: string;
  workspace_id: string;
  type: string;
  title: string;
  stimulus: any;
  segment_ids: string[];
  status: string;
  results: any;
  confidence_score: number | null;
  tokens_used: number | null;
  duration_ms: number | null;
  created_by: string;
  created_at: string;
}

export interface SimulationHistoryItem {
  id: string;
  title: string;
  status: string;
  confidence_score: number | null;
  created_at: string;
  segment_ids: string[] | null;
  type: string;
}

export interface SimulationResult {
  simulation_id: string;
  segment: { id: string; name?: string };
  response: string;
  sentiment: number;
  confidence: number;
  key_themes: string[];
  purchase_intent: string;
  emotional_reaction: string;
  tokens_used: number;
  duration_ms: number;
}

// ── Queries ────────────────────────────────────────────

/**
 * Fetch simulation history for a workspace (most recent first).
 */
export async function getSimulationHistory(
  workspaceId: string,
  limit = 20
): Promise<SimulationHistoryItem[]> {
  const { data, error } = await supabase
    .from("simulations")
    .select("id, title, status, confidence_score, created_at, segment_ids, type")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as SimulationHistoryItem[];
}

/**
 * Fetch a single simulation with its twin responses.
 */
export async function getSimulationById(simulationId: string): Promise<SimulationRecord | null> {
  const { data, error } = await supabase
    .from("simulations")
    .select("*, twin_responses(*)")
    .eq("id", simulationId)
    .single();
  if (error) return null;
  return data as unknown as SimulationRecord;
}

/**
 * Fetch multiple simulations by IDs (for comparison view).
 */
export async function getSimulationsByIds(ids: string[]): Promise<SimulationRecord[]> {
  const { data, error } = await supabase
    .from("simulations")
    .select("*, twin_responses(*)")
    .in("id", ids);
  if (error) throw error;
  return (data ?? []) as unknown as SimulationRecord[];
}

// ── Mutations (Edge Function Invocations) ──────────────

/**
 * Run a solo simulation via the `simulate` edge function.
 */
export async function runSimulation(params: {
  segment_id: string;
  stimulus: string;
  workspace_id: string;
  title?: string;
}): Promise<SimulationResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const response = await supabase.functions.invoke("simulate", {
    body: {
      segment_id: params.segment_id,
      stimulus: params.stimulus,
      workspace_id: params.workspace_id,
      title: params.title || params.stimulus.slice(0, 80),
    },
  });

  if (response.error) throw new Error(response.error.message);
  return response.data as SimulationResult;
}

/**
 * Run a focus group simulation via the `simulate-focus-group` edge function.
 */
export async function runFocusGroup(params: {
  segment_ids: string[];
  stimulus: string;
  workspace_id: string;
  num_rounds?: number;
  ramadan_mode?: boolean;
  project_id?: string | null;
}): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const response = await supabase.functions.invoke("simulate-focus-group", {
    body: {
      segment_ids: params.segment_ids,
      stimulus: params.stimulus,
      workspace_id: params.workspace_id,
      num_rounds: params.num_rounds || 2,
      ramadan_mode: params.ramadan_mode || false,
      project_id: params.project_id || undefined,
    },
  });

  if (response.error) throw new Error(response.error.message);
  return response.data;
}

/**
 * Run a market simulation via the `simulate-market` edge function.
 */
export async function runMarketSimulation(params: {
  segment_ids: string[];
  product: any;
  workspace_id: string;
}): Promise<any> {
  const response = await supabase.functions.invoke("simulate-market", {
    body: params,
  });
  if (response.error) throw new Error(response.error.message);
  return response.data;
}

/**
 * Run an A/B test simulation via the `simulate-ab-test` edge function.
 */
export async function runABTest(params: {
  segment_ids: string[];
  variant_a: any;
  variant_b: any;
  workspace_id: string;
}): Promise<any> {
  const response = await supabase.functions.invoke("simulate-ab-test", {
    body: params,
  });
  if (response.error) throw new Error(response.error.message);
  return response.data;
}

/**
 * Run a policy impact simulation via the `simulate-policy` edge function.
 */
export async function runPolicySimulation(params: {
  segment_ids: string[];
  policy: any;
  workspace_id: string;
}): Promise<any> {
  const response = await supabase.functions.invoke("simulate-policy", {
    body: params,
  });
  if (response.error) throw new Error(response.error.message);
  return response.data;
}
