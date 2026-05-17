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

// ── Stripe Product to Tier Map ──────────────────────

const STRIPE_PRODUCT_TIER: Record<string, string> = {
  "prod_starter_plan": "starter",
  "prod_professional_plan": "professional",
  "prod_enterprise_plan": "enterprise",
  "prod_U77vT9icIzokqy": "starter",
  "prod_U77wrd6NNDHYW2": "professional",
};

const TIER_RANK: Record<string, number> = {
  free: 0,
  starter: 1,
  professional: 2,
  enterprise: 3,
};

// Allow override via env
const envMapping = Deno.env.get("STRIPE_TIER_MAP");
if (envMapping) {
  try {
    const parsed = JSON.parse(envMapping);
    Object.entries(parsed).forEach(([productId, tier]) => {
      STRIPE_PRODUCT_TIER[productId] = tier as string;
    });
  } catch (_) { /* ignore parse errors */ }
}

// ── Get Workspace Tier ──────────────────────────────

export async function getWorkspaceTier(supabase: any, workspaceId: string): Promise<string> {
  try {
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("tier, created_by")
      .eq("id", workspaceId)
      .single();

    if (workspace?.tier && workspace.tier !== "free") {
      return workspace.tier;
    }

    if (!workspace?.created_by) return "free";

    // Get owner's email to look up Stripe subscription
    const { data: { user: owner } } = await supabase.auth.admin.getUserById(workspace.created_by);
    if (!owner?.email) return "free";

    // Check the subscriptions table or a cached tier column
    // For now, fall back to checking check-subscription logic
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return "free";

    const { default: Stripe } = await import("https://esm.sh/stripe@18.5.0");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const customers = await stripe.customers.list({ email: owner.email, limit: 1 });
    if (customers.data.length === 0) return "free";

    const subscriptions = await stripe.subscriptions.list({
      customer: customers.data[0].id,
      status: "all",
      limit: 10,
    });

    const activeTier = subscriptions.data.reduce((bestTier: string, subscription: any) => {
      if (!["active", "trialing", "past_due", "unpaid"].includes(subscription.status)) {
        return bestTier;
      }

      const productId = subscription.items.data[0]?.price?.product as string | undefined;
      const nextTier = (productId && STRIPE_PRODUCT_TIER[productId]) || "free";
      return TIER_RANK[nextTier] > TIER_RANK[bestTier] ? nextTier : bestTier;
    }, "free");

    return activeTier;
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
    supabase.from("workspace_memberships").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
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
