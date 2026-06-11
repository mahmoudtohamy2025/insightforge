import { describe, it, expect } from "vitest";
import { TIER_LIMITS as FRONTEND_TIER_LIMITS, TIER_ORDER } from "@/lib/tierLimits";
import { TIER_LIMITS as EDGE_TIER_LIMITS } from "../../supabase/functions/_shared/tierLimitsData.ts";

// The edge layer can't import src/lib/tierLimits.ts (Deno bundle vs app bundle),
// so the numbers are mirrored in supabase/functions/_shared/tierLimitsData.ts.
// This test is the tripwire: change one copy without the other and the suite fails.
// (The DB triggers in supabase/migrations are a third copy — update all three.)
const SHARED_RESOURCES = ["members", "sessions", "surveys", "projects", "aiAnalysis"] as const;

describe("edge/frontend tier-limit parity", () => {
  it("defines the same set of tiers", () => {
    expect(Object.keys(EDGE_TIER_LIMITS).sort()).toEqual([...TIER_ORDER].sort());
  });

  for (const tier of TIER_ORDER) {
    it(`${tier}: edge limits match src/lib/tierLimits.ts`, () => {
      // Exact key set: a typo'd or extra key in the edge table must fail too,
      // not drift silently past the per-resource loop below.
      expect(Object.keys(EDGE_TIER_LIMITS[tier]).sort()).toEqual([...SHARED_RESOURCES].sort());
      for (const resource of SHARED_RESOURCES) {
        expect(EDGE_TIER_LIMITS[tier][resource], `${tier}.${resource}`).toBe(
          FRONTEND_TIER_LIMITS[tier][resource],
        );
      }
    });
  }

  it("free tier keeps aiAnalysis enabled (P0.8 — monthly trial, deliberate)", () => {
    expect(EDGE_TIER_LIMITS.free.aiAnalysis).toBe(true);
  });
});
