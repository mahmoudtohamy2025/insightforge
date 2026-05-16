/**
 * Shared Tier Enforcement for Edge Functions
 * 
 * Every edge function that performs an LLM call or creates a resource
 * must check whether the workspace's tier allows the action.
 *
 * Usage:
 *   const tierCheck = await enforceTierLimit(supabase, req, workspaceId, "aiAnalysis");
 *   if (tierCheck) return tierCheck; // 403 response
 */

import { jsonResponse } from "./cors.ts";

// ── Tier Limits (mirrors src/lib/tierLimits.ts) ──────

const TIER_LIMITS: Record<string, Record<string, number | boolean | string>> = {
  free:         { members: 2, sessions: 10, surveys: 5, projects: 3, aiAnalysis: false },
  starter:      { members: 5, sessions: 50, surveys: 25, projects: 15, aiAnalysis: true },
  professional: { members: 15, sessions: -1, surveys: -1, projects: -1, aiAnalysis: true },
  enterprise:   { members: -1, sessions: -1, surveys: -1, projects: -1, aiAnalysis: true },
};

// ── Get Workspace Tier (P0.2 — cache-first) ─────────────
//
// The workspaces table has `tier VARCHAR(50) NOT NULL DEFAULT 'free'` and is
// authoritatively updated by the stripe-webhook edge function on every
// customer.subscription.{created,updated,deleted} event. That makes the column
// the canonical cache for the workspace's current tier.
//
// Before this change: this function called Stripe API on EVERY protected edge
// request (auth.admin.getUserById → stripe.customers.list → stripe.subscriptions.list).
// At any nontrivial traffic Stripe's read rate limit (~100/sec) would start
// rejecting requests, cascading 429s up to the frontend. Frontend polling
// (useSubscription.ts) amplified this to ~5 req/sec from idle.
//
// After this change: this function reads workspaces.tier in one cheap query.
// Stripe is hit only by the webhook itself — i.e. when tier ACTUALLY changes.

export async function getWorkspaceTier(supabase: any, workspaceId: string): Promise<string> {
  try {
    const { data: workspace, error } = await supabase
      .from("workspaces")
      .select("tier")
      .eq("id", workspaceId)
      .single();

    if (error || !workspace) {
      console.error("[TIER] Failed to read workspace tier:", error);
      return "free"; // Fail-closed to the most restrictive tier.
    }

    // workspaces.tier is NOT NULL with DEFAULT 'free', so this nullish-coalesce
    // is defensive against schema drift, not the expected path.
    return workspace.tier ?? "free";
  } catch (err) {
    console.error("[TIER] Error checking tier:", err);
    return "free";
  }
}

// ── Get Workspace Usage Counts ──────────────────────

export async function getWorkspaceUsage(
  supabase: any,
  workspaceId: string,
): Promise<Record<string, number>> {
  const [sessions, surveys, members, simulations] = await Promise.all([
    supabase.from("sessions").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("surveys").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("workspace_members").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
    supabase.from("simulations").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
  ]);

  return {
    sessions: sessions.count || 0,
    surveys: surveys.count || 0,
    members: members.count || 0,
    simulations: simulations.count || 0,
  };
}

// ── Enforce Tier Limit ──────────────────────────────

type TierResource = "members" | "sessions" | "surveys" | "projects" | "aiAnalysis";

/**
 * Check whether a workspace can perform an action. Returns a 403 Response if denied, or null if allowed.
 */
export async function enforceTierLimit(
  supabase: any,
  req: Request,
  workspaceId: string,
  resource: TierResource,
): Promise<Response | null> {
  try {
    const tier = await getWorkspaceTier(supabase, workspaceId);
    const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;

    // Boolean resources (aiAnalysis)
    if (resource === "aiAnalysis") {
      if (!limits.aiAnalysis) {
        return jsonResponse(req, {
          error: "AI features are not available on your current plan",
          code: "TIER_LIMIT",
          tier,
          upgrade_url: "/settings?tab=billing",
          message: `AI analysis requires a Starter plan or above. You are currently on the ${tier} plan.`,
        }, 403);
      }
      return null;
    }

    // Numeric resources
    const usage = await getWorkspaceUsage(supabase, workspaceId);
    const limit = limits[resource] as number;
    const current = usage[resource] || 0;

    if (limit !== -1 && current >= limit) {
      return jsonResponse(req, {
        error: `You've reached the ${resource} limit for your ${tier} plan`,
        code: "TIER_LIMIT",
        tier,
        resource,
        current,
        limit,
        upgrade_url: "/settings?tab=billing",
        message: `Your ${tier} plan allows ${limit} ${resource}. You've used ${current}. Upgrade to unlock more.`,
      }, 403);
    }

    return null;
  } catch (err) {
    console.error("[TIER] Enforcement error:", err);
    // On error, allow the action (fail open for now) but log
    return null;
  }
}
