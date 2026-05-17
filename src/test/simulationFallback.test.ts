import { describe, expect, it } from "vitest";
import { buildFallbackSimulation } from "../../supabase/functions/_shared/simulationFallback";

describe("buildFallbackSimulation", () => {
  it("returns a pricing-oriented fallback for pricing prompts", () => {
    const result = buildFallbackSimulation(
      {
        name: "Early-stage SaaS founders",
        demographics: { location: "Global SaaS" },
        psychographics: { values: "speed, clarity, evidence-backed decisions" },
      },
      "What makes founders trust a higher-priced plan instead of defaulting to the cheapest option?",
    );

    expect(result.generation_mode).toBe("heuristic_fallback");
    expect(result.provider_status).toBe("missing_gemini_api_key");
    expect(result.purchase_intent).toBe("probably_yes");
    expect(result.key_themes).toContain("Outcome-based pricing");
  });

  it("returns a messaging-oriented fallback for positioning prompts", () => {
    const result = buildFallbackSimulation(
      {
        name: "Founder ICP",
      },
      "Which homepage message is more likely to convert: AI research platform or Founder Decision OS?",
    );

    expect(result.confidence).toBeGreaterThan(0.7 - 0.001);
    expect(result.response).toContain("Founder Decision OS");
    expect(result.key_themes).toContain("Outcome-first positioning");
  });

  it("returns an onboarding-oriented fallback for activation prompts", () => {
    const result = buildFallbackSimulation(
      {
        name: "Newly signed-up founders",
      },
      "A founder just signed up. What is the fastest onboarding flow that gets them to a useful decision in under five minutes?",
    );

    expect(result.emotional_reaction).toBe("interested");
    expect(result.response).toContain("one guided decision prompt");
    expect(result.key_themes).toContain("Reduce setup to one concrete decision");
  });
});
