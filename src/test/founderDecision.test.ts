import { describe, expect, it } from "vitest";
import {
  FOUNDER_DECISION_TEMPLATES,
  buildDecisionMemo,
  estimateDecisionConfidence,
  getConfidenceMeta,
  getDecisionTemplate,
  getEvidenceStatus,
  getRequirementDecisionMemo,
} from "@/lib/founderDecision";

describe("founderDecision helpers", () => {
  it("returns a founder template by id", () => {
    expect(getDecisionTemplate("pricing")?.title).toBe("Pricing Decision");
    expect(getDecisionTemplate("missing")).toBeNull();
    expect(FOUNDER_DECISION_TEMPLATES).toHaveLength(3);
  });

  it("maps confidence scores to rails", () => {
    expect(getConfidenceMeta(0.85).level).toBe("high");
    expect(getConfidenceMeta(0.65).level).toBe("medium");
    expect(getConfidenceMeta(0.2).level).toBe("low");
  });

  it("estimates stronger confidence when evidence exists", () => {
    const withoutEvidence = estimateDecisionConfidence({
      status: "submitted",
      priority: "high",
    });

    const withEvidence = estimateDecisionConfidence({
      status: "in_progress",
      priority: "medium",
      linked_simulation_ids: ["1"],
      linked_survey_ids: ["2"],
      linked_session_ids: ["3"],
      ai_methodology_suggestion: { matching_twin_count: 4 },
    });

    expect(withEvidence).toBeGreaterThan(withoutEvidence);
  });

  it("summarizes evidence strength", () => {
    expect(getEvidenceStatus({ linked_simulation_ids: ["1", "2"], linked_survey_ids: ["3", "4"] }).label).toBe("Strong evidence");
    expect(getEvidenceStatus({ linked_simulation_ids: ["1"] }).label).toBe("Early signal");
  });

  it("prefers persisted requirement state when present", () => {
    expect(
      estimateDecisionConfidence({
        confidence_score: 0.91,
        status: "submitted",
        priority: "critical",
      })
    ).toBe(0.91);

    expect(getEvidenceStatus({ evidence_status: "building" }).label).toBe("Some evidence");
  });

  it("builds a memo recommendation from confidence", () => {
    const memo = buildDecisionMemo({
      title: "Pricing Decision",
      confidenceScore: 0.68,
      evidenceLabel: "Building evidence",
      summary: "Founders respond to decision-speed language.",
      risk: "Risk of overpromising certainty.",
      nextAction: "Run a targeted pricing survey.",
    });

    expect(memo.recommendation).toContain("quick real-customer check");
    expect(memo.confidence).toBe("Medium confidence");
  });

  it("returns stored memo content when available", () => {
    const memo = getRequirementDecisionMemo({
      decision_memo: {
        recommendation: "Ship the decision with monitoring.",
        confidence: "High confidence",
        evidence: "Strong evidence",
        summary: "Stored summary",
        risk: "Execution risk",
        next_action: "Publish the memo",
      },
    });

    expect(memo.summary).toBe("Stored summary");
    expect(memo.nextAction).toBe("Publish the memo");
  });
});
