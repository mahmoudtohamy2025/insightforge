import { describe, it, expect } from "vitest";
import {
  TIER_LIMITS,
  TIER_PRICES,
  TIER_ORDER,
  STRIPE_TIER_MAP,
  TIER_TOKEN_BUDGETS,
  TIER_RATE_LIMITS,
  getTierFromProductId,
  getUsagePercent,
  getUsageStatus,
  canPerformAction,
} from "@/lib/tierLimits";

describe("TIER_LIMITS structure", () => {
  it("defines all 4 tiers", () => {
    expect(Object.keys(TIER_LIMITS)).toContain("free");
    expect(Object.keys(TIER_LIMITS)).toContain("starter");
    expect(Object.keys(TIER_LIMITS)).toContain("professional");
    expect(Object.keys(TIER_LIMITS)).toContain("enterprise");
  });

  it("each tier has all required fields", () => {
    for (const tier of TIER_ORDER) {
      const limits = TIER_LIMITS[tier];
      expect(limits).toHaveProperty("members");
      expect(limits).toHaveProperty("sessions");
      expect(limits).toHaveProperty("surveys");
      expect(limits).toHaveProperty("projects");
      expect(limits).toHaveProperty("aiAnalysis");
      expect(limits).toHaveProperty("storage");
      expect(limits).toHaveProperty("support");
    }
  });

  it("free tier has AI analysis disabled", () => {
    expect(TIER_LIMITS.free.aiAnalysis).toBe(false);
  });

  it("paid tiers have AI analysis enabled", () => {
    expect(TIER_LIMITS.starter.aiAnalysis).toBe(true);
    expect(TIER_LIMITS.professional.aiAnalysis).toBe(true);
    expect(TIER_LIMITS.enterprise.aiAnalysis).toBe(true);
  });

  it("enterprise has unlimited (-1) for all numeric limits", () => {
    expect(TIER_LIMITS.enterprise.members).toBe(-1);
    expect(TIER_LIMITS.enterprise.sessions).toBe(-1);
    expect(TIER_LIMITS.enterprise.surveys).toBe(-1);
    expect(TIER_LIMITS.enterprise.projects).toBe(-1);
  });

  it("higher tiers have higher limits", () => {
    expect(TIER_LIMITS.starter.sessions).toBeGreaterThan(TIER_LIMITS.free.sessions);
    expect(TIER_LIMITS.professional.sessions).toBeGreaterThan(TIER_LIMITS.starter.sessions);
  });
});

describe("TIER_PRICES", () => {
  it("has prices for all tiers", () => {
    for (const tier of TIER_ORDER) {
      expect(TIER_PRICES[tier]).toBeDefined();
    }
  });

  it("free tier costs $0", () => {
    expect(TIER_PRICES.free).toBe("$0/mo");
  });
});

describe("getTierFromProductId", () => {
  it("returns tier for known Stripe product ID", () => {
    expect(getTierFromProductId(STRIPE_TIER_MAP.starter.product_id)).toBe("starter");
    expect(getTierFromProductId(STRIPE_TIER_MAP.professional.product_id)).toBe("professional");
  });

  it("returns null for unknown product ID", () => {
    expect(getTierFromProductId("prod_unknown_123")).toBeNull();
    expect(getTierFromProductId("")).toBeNull();
  });
});

describe("getUsagePercent", () => {
  it("returns 0 for unlimited (-1) limit", () => {
    expect(getUsagePercent(50, -1)).toBe(0);
  });

  it("returns 0 for zero limit", () => {
    expect(getUsagePercent(0, 0)).toBe(0);
  });

  it("calculates percentage correctly", () => {
    expect(getUsagePercent(5, 10)).toBe(50);
    expect(getUsagePercent(8, 10)).toBe(80);
    expect(getUsagePercent(10, 10)).toBe(100);
  });

  it("caps at 100%", () => {
    expect(getUsagePercent(15, 10)).toBe(100);
  });

  it("rounds to nearest integer", () => {
    expect(getUsagePercent(1, 3)).toBe(33); // 33.33% → 33
  });
});

describe("getUsageStatus", () => {
  it('returns "ok" for usage below 80%', () => {
    expect(getUsageStatus(0)).toBe("ok");
    expect(getUsageStatus(50)).toBe("ok");
    expect(getUsageStatus(79)).toBe("ok");
  });

  it('returns "warning" for usage 80-99%', () => {
    expect(getUsageStatus(80)).toBe("warning");
    expect(getUsageStatus(90)).toBe("warning");
    expect(getUsageStatus(99)).toBe("warning");
  });

  it('returns "critical" for usage >= 100%', () => {
    expect(getUsageStatus(100)).toBe("critical");
    expect(getUsageStatus(110)).toBe("critical");
  });
});

describe("canPerformAction", () => {
  it("allows actions within limits", () => {
    const result = canPerformAction("free", "sessions", 5);
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(10);
    expect(result.current).toBe(5);
  });

  it("denies actions at limit", () => {
    const result = canPerformAction("free", "sessions", 10);
    expect(result.allowed).toBe(false);
    expect(result.message).toContain("limit");
  });

  it("denies actions over limit", () => {
    const result = canPerformAction("free", "surveys", 6);
    expect(result.allowed).toBe(false);
    expect(result.limit).toBe(5);
  });

  it("denies AI analysis for free tier", () => {
    const result = canPerformAction("free", "aiAnalysis", 0);
    expect(result.allowed).toBe(false);
    expect(result.message).toContain("AI analysis");
    expect(result.message).toContain("Upgrade");
  });

  it("allows AI analysis for paid tiers", () => {
    expect(canPerformAction("starter", "aiAnalysis", 0).allowed).toBe(true);
    expect(canPerformAction("professional", "aiAnalysis", 0).allowed).toBe(true);
    expect(canPerformAction("enterprise", "aiAnalysis", 0).allowed).toBe(true);
  });

  it("always allows enterprise (unlimited = -1)", () => {
    const result = canPerformAction("enterprise", "sessions", 99999);
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(-1);
  });

  it("falls back to free tier for unknown tier string", () => {
    const result = canPerformAction("nonexistent", "sessions", 10);
    expect(result.allowed).toBe(false); // free tier has 10 sessions limit
  });
});

describe("Token Budget and Rate Limit Constants", () => {
  it("free tier has 0 token budget", () => {
    expect(TIER_TOKEN_BUDGETS.free).toBe(0);
  });

  it("paid tiers have increasing token budgets", () => {
    expect(TIER_TOKEN_BUDGETS.starter).toBeGreaterThan(0);
    expect(TIER_TOKEN_BUDGETS.professional).toBeGreaterThan(TIER_TOKEN_BUDGETS.starter);
    expect(TIER_TOKEN_BUDGETS.enterprise).toBeGreaterThan(TIER_TOKEN_BUDGETS.professional);
  });

  it("free tier has 0 rate limit", () => {
    expect(TIER_RATE_LIMITS.free).toBe(0);
  });

  it("paid tiers have increasing rate limits", () => {
    expect(TIER_RATE_LIMITS.starter).toBeGreaterThan(0);
    expect(TIER_RATE_LIMITS.professional).toBeGreaterThan(TIER_RATE_LIMITS.starter);
    expect(TIER_RATE_LIMITS.enterprise).toBeGreaterThan(TIER_RATE_LIMITS.professional);
  });
});
