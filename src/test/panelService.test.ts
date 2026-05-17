import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {},
}));

import {
  buildPanelCommandCenter,
  calculateEffectiveHourlyRateCents,
  mapRequirementToStudyDraft,
  recommendRewardCents,
  validateStudyLaunch,
} from "@/services/panelService";

describe("panelService reward and launch rules", () => {
  it("calculates effective hourly reward", () => {
    expect(calculateEffectiveHourlyRateCents(500, 30)).toBe(1000);
    expect(calculateEffectiveHourlyRateCents(500, 0)).toBe(0);
  });

  it("recommends fair rounded rewards at $12/hr", () => {
    expect(recommendRewardCents(15)).toBe(300);
    expect(recommendRewardCents(45)).toBe(900);
  });

  it("blocks launch when audience, screener, consent, or fair pay is missing", () => {
    const result = validateStudyLaunch({
      title: "Pricing test",
      description: "Validate willingness to pay.",
      studyType: "survey",
      estimatedMinutes: 30,
      rewardAmountCents: 200,
      maxParticipants: 30,
      targetAudience: "",
      screenerSummary: "",
      consentPolicy: "",
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Define the target audience before launch.");
    expect(result.errors).toContain("Reward is below the $8/hr minimum fairness guardrail.");
  });

  it("passes launch readiness for complete fair studies", () => {
    const result = validateStudyLaunch({
      title: "ICP message test",
      description: "Validate landing page clarity.",
      studyType: "survey",
      estimatedMinutes: 15,
      rewardAmountCents: 300,
      maxParticipants: 40,
      targetAudience: "B2B SaaS founders",
      screenerSummary: "Must be founder or head of growth",
      consentPolicy: "standard_anonymized_research",
    });

    expect(result.valid).toBe(true);
    expect(result.totalBudgetCents).toBe(12000);
    expect(result.effectiveHourlyRateCents).toBe(1200);
  });
});

describe("panelService requirement mapping", () => {
  it("creates a study draft from an approved requirement", () => {
    const draft = mapRequirementToStudyDraft({
      id: "req-1",
      title: "Validate onboarding friction",
      description: "Users may not understand setup.",
      business_context: "Activation is below target.",
      target_audience: "New SaaS admins",
      suggested_methodology: ["usability test"],
    });

    expect(draft.title).toBe("Validate onboarding friction");
    expect(draft.studyType).toBe("usability_test");
    expect(draft.linkedRequirementId).toBe("req-1");
    expect(draft.targetAudience).toBe("New SaaS admins");
  });
});

describe("panelService command center rollups", () => {
  it("computes today, pipeline, health, budget, and impact metrics", () => {
    const panel = buildPanelCommandCenter({
      participants: [
        { id: "p1", quality_score: 5 },
        { id: "p2", quality_score: 3 },
      ],
      marketplaceProfiles: [{ id: "mp1" }],
      requirements: [
        { id: "r1", title: "Open", status: "approved" },
        { id: "r2", title: "Done", status: "completed" },
      ],
      studies: [
        { id: "s1", title: "Study", status: "active", current_participants: 1, max_participants: 10, created_at: "2026-04-20T00:00:00Z" },
      ],
      incentivePrograms: [
        { id: "i1", total_budget_cents: 10000, spent_cents: 2500, status: "active" },
      ],
      disbursements: [
        { id: "d1", amount_cents: 500, status: "pending" },
      ],
      participations: [
        { id: "sp1", study_id: "s1", status: "submitted", created_at: "2026-04-20T03:00:00Z" },
      ],
    });

    expect(panel.stats.activeStudies).toBe(1);
    expect(panel.stats.pendingApprovals).toBe(1);
    expect(panel.stats.totalParticipants).toBe(2);
    expect(panel.stats.marketplaceParticipants).toBe(1);
    expect(panel.stats.pendingPayoutCents).toBe(500);
    expect(panel.stats.completedRequirements).toBe(1);
    expect(panel.stats.medianTimeToFirstQualifiedHours).toBe(3);
  });
});
