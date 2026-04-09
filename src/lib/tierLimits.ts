export interface TierLimits {
  members: number;
  sessions: number;
  surveys: number;
  projects: number;
  aiAnalysis: boolean;
  storage: string;
  support: string;
  requirements: number;
  incentive_programs: number;
  incentive_budget_cents: number;
}

export const TIER_LIMITS: Record<string, TierLimits> = {
  free: {
    members: 3,
    sessions: 10,
    surveys: 5,
    projects: 2,
    aiAnalysis: false,
    storage: "500 MB",
    support: "Community",
    requirements: 5,
    incentive_programs: 1,
    incentive_budget_cents: 50000, // $500
  },
  starter: {
    members: 10,
    sessions: 50,
    surveys: 25,
    projects: 10,
    aiAnalysis: true,
    storage: "5 GB",
    support: "Email",
    requirements: 25,
    incentive_programs: 5,
    incentive_budget_cents: 500000, // $5,000
  },
  professional: {
    members: 25,
    sessions: 200,
    surveys: 100,
    projects: 50,
    aiAnalysis: true,
    storage: "25 GB",
    support: "Priority",
    requirements: 100,
    incentive_programs: 20,
    incentive_budget_cents: 5000000, // $50,000
  },
  enterprise: {
    members: -1, // unlimited
    sessions: -1,
    surveys: -1,
    projects: -1,
    aiAnalysis: true,
    storage: "Unlimited",
    support: "Dedicated",
    requirements: -1,
    incentive_programs: -1,
    incentive_budget_cents: -1,
  },
};

export const TIER_PRICES: Record<string, string> = {
  free: "$0/mo",
  starter: "$49/mo",
  professional: "$149/mo",
  enterprise: "Custom",
};

export const TIER_ORDER = ["free", "starter", "professional", "enterprise"] as const;

export const STRIPE_TIER_MAP: Record<string, { product_id: string; price_id: string }> = {
  starter: {
    product_id: "prod_U77vT9icIzokqy",
    price_id: "price_1T8tg28NeKE7MXMiYbxhEso5",
  },
  professional: {
    product_id: "prod_U77wrd6NNDHYW2",
    price_id: "price_1T8tgA8NeKE7MXMiKFt07U2B",
  },
};

export function getTierFromProductId(productId: string): string | null {
  for (const [tier, map] of Object.entries(STRIPE_TIER_MAP)) {
    if (map.product_id === productId) return tier;
  }
  return null;
}

export function getUsagePercent(current: number, limit: number): number {
  if (limit <= 0) return 0; // unlimited
  return Math.min(Math.round((current / limit) * 100), 100);
}

export function getUsageStatus(percent: number): "ok" | "warning" | "critical" {
  if (percent >= 100) return "critical";
  if (percent >= 80) return "warning";
  return "ok";
}

// ── Tier Enforcement ───────────────────────────────────

export type TierResource = "members" | "sessions" | "surveys" | "projects" | "aiAnalysis" | "requirements" | "incentive_programs" | "incentive_budget_cents";

export interface TierCheckResult {
  allowed: boolean;
  limit: number;
  current: number;
  message?: string;
}

/**
 * Check whether a workspace can perform an action given its tier limits.
 * Returns { allowed, limit, current, message }.
 */
export function canPerformAction(
  tier: string,
  resource: TierResource,
  currentCount: number,
): TierCheckResult {
  const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;

  // Special case: AI analysis is a boolean, not a count
  if (resource === "aiAnalysis") {
    return {
      allowed: limits.aiAnalysis === true,
      limit: limits.aiAnalysis ? -1 : 0,
      current: currentCount,
      message: limits.aiAnalysis
        ? undefined
        : `AI analysis is not available on the ${tier} plan. Upgrade to Starter or above.`,
    };
  }

  const limit = limits[resource] as number;

  // -1 means unlimited
  if (limit === -1) {
    return { allowed: true, limit: -1, current: currentCount };
  }

  if (currentCount >= limit) {
    return {
      allowed: false,
      limit,
      current: currentCount,
      message: `You've reached the ${resource} limit (${limit}) for your ${tier} plan. Upgrade to unlock more.`,
    };
  }

  return { allowed: true, limit, current: currentCount };
}

// ── Token Budgets (Monthly) ────────────────────────────

export const TIER_TOKEN_BUDGETS: Record<string, number> = {
  free: 0,
  starter: 500_000,
  professional: 2_000_000,
  enterprise: 10_000_000,
};

// ── Rate Limits (per minute) ───────────────────────────

export const TIER_RATE_LIMITS: Record<string, number> = {
  free: 0,
  starter: 10,
  professional: 30,
  enterprise: 100,
};
