export type FounderDecisionTemplate = {
  id: string;
  title: string;
  category: string;
  description: string;
  hypothesis: string;
  targetAudience: string;
  targetMarket: string;
  priority: "critical" | "high" | "medium" | "low";
  starterPrompt: string;
  tags: string[];
};

export type ConfidenceLevel = "high" | "medium" | "low";

type RequirementLike = {
  confidence_score?: number | null;
  confidence_label?: string | null;
  evidence_status?: string | null;
  recommended_next_action?: string | null;
  decision_memo?: {
    recommendation?: string;
    confidence?: string;
    evidence?: string;
    summary?: string;
    risk?: string;
    next_action?: string;
  } | null;
  status?: string | null;
  priority?: string | null;
  description?: string | null;
  business_context?: string | null;
  findings_summary?: string | null;
  ai_methodology_suggestion?: {
    confidence_score?: number | null;
    matching_twin_count?: number | null;
  } | null;
  linked_simulation_ids?: string[] | null;
  linked_survey_ids?: string[] | null;
  linked_session_ids?: string[] | null;
  linked_insight_ids?: string[] | null;
};

export const FOUNDER_DECISION_TEMPLATES: FounderDecisionTemplate[] = [
  {
    id: "pricing",
    title: "Pricing Decision",
    category: "pricing",
    description: "Check willingness to pay, plan setup, and upgrade friction before you change pricing.",
    hypothesis: "Early-stage SaaS teams will pay more for faster, confidence-backed decisions if pricing is tied to outcomes instead of seats.",
    targetAudience: "Founders and product leads at early-stage SaaS startups",
    targetMarket: "US and remote-first SaaS teams",
    priority: "critical",
    starterPrompt: "We want to test our pricing page and packaging. What is the strongest reaction to a higher-priced plan if it promises faster, better founder decisions?",
    tags: ["pricing", "monetization", "founder-os"],
  },
  {
    id: "messaging",
    title: "Homepage Message Test",
    category: "brand",
    description: "Find the homepage message that makes your value clear fastest.",
    hypothesis: "Decision-speed language will outperform research-platform language for SaaS founders evaluating this product.",
    targetAudience: "First-time founder visitors evaluating product research tools",
    targetMarket: "Global B2B SaaS",
    priority: "high",
    starterPrompt: "Compare these homepage messages and explain which one would make a founder trust the product faster: 'AI research platform' vs 'Founder Decision OS'.",
    tags: ["messaging", "homepage", "conversion"],
  },
  {
    id: "onboarding",
    title: "Onboarding Check",
    category: "ux",
    description: "Spot what slows new founders down in their first session.",
    hypothesis: "A founder-specific onboarding flow will increase first-session activation more than a generic research setup.",
    targetAudience: "Newly signed-up founders with no prior research operations",
    targetMarket: "Seed to Series A SaaS",
    priority: "high",
    starterPrompt: "A founder just signed up. What is the first decision they should be able to test in under five minutes, and what wording reduces drop-off?",
    tags: ["onboarding", "activation", "founder-os"],
  },
];

export function getDecisionTemplate(id: string | null | undefined) {
  return FOUNDER_DECISION_TEMPLATES.find((template) => template.id === id) ?? null;
}

export function getConfidenceMeta(score: number | null | undefined) {
  const normalized = clamp(score ?? 0.5, 0, 1);

  if (normalized >= 0.8) {
    return {
      level: "high" as ConfidenceLevel,
      label: "High confidence",
      summary: "You have enough evidence to move forward. Launch it, then watch what happens in the real world.",
      badgeClassName: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      railClassName: "border-emerald-500/30 bg-emerald-500/5",
      ctaLabel: "Move forward",
    };
  }

  if (normalized >= 0.6) {
    return {
      level: "medium" as ConfidenceLevel,
      label: "Medium confidence",
      summary: "This looks promising, but do one quick real-customer check before you fully commit.",
      badgeClassName: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
      railClassName: "border-amber-500/30 bg-amber-500/5",
      ctaLabel: "Run a quick real-customer check",
    };
  }

  return {
    level: "low" as ConfidenceLevel,
    label: "Low confidence",
    summary: "This is still an early idea. Talk to real customers before you treat it as a real decision.",
    badgeClassName: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
    railClassName: "border-rose-500/30 bg-rose-500/5",
    ctaLabel: "Gather more proof",
  };
}

export function estimateDecisionConfidence(requirement: RequirementLike | null | undefined) {
  if (!requirement) return 0.52;

  if (typeof requirement.confidence_score === "number" && Number.isFinite(requirement.confidence_score)) {
    return clamp(requirement.confidence_score, 0, 1);
  }

  const aiScore = requirement.ai_methodology_suggestion?.confidence_score;
  if (typeof aiScore === "number" && Number.isFinite(aiScore)) {
    return clamp(aiScore, 0, 1);
  }

  const baseByStatus: Record<string, number> = {
    submitted: 0.35,
    under_review: 0.48,
    approved: 0.6,
    in_progress: 0.68,
    insights_ready: 0.8,
    completed: 0.9,
    declined: 0.32,
    on_hold: 0.4,
  };

  let score = baseByStatus[requirement.status || "submitted"] ?? 0.52;

  const priorityAdjustments: Record<string, number> = {
    critical: -0.08,
    high: -0.03,
    medium: 0,
    low: 0.04,
  };
  score += priorityAdjustments[requirement.priority || "medium"] ?? 0;

  const evidenceCount =
    (requirement.linked_simulation_ids?.length || 0) +
    (requirement.linked_survey_ids?.length || 0) +
    (requirement.linked_session_ids?.length || 0) +
    (requirement.linked_insight_ids?.length || 0);
  score += Math.min(evidenceCount * 0.04, 0.16);

  const twinMatches = requirement.ai_methodology_suggestion?.matching_twin_count || 0;
  if (twinMatches > 0) score += Math.min(twinMatches * 0.01, 0.06);

  return clamp(score, 0, 0.96);
}

export function getEvidenceStatus(requirement: RequirementLike | null | undefined) {
  if (requirement?.evidence_status) {
    const normalized = requirement.evidence_status;
    if (normalized === "strong") {
      return {
        label: "Strong evidence",
        description: "You have signal from more than one source, including AI tests and real customer input.",
      };
    }
    if (normalized === "building") {
      return {
        label: "Some evidence",
        description: "The direction looks promising, but you still need one more useful input before deciding.",
      };
    }
    return {
      label: "Early signal",
      description: "You only have a small amount of proof so far, so this should still be treated as a hypothesis.",
    };
  }

  const evidenceCount =
    (requirement?.linked_simulation_ids?.length || 0) +
    (requirement?.linked_survey_ids?.length || 0) +
    (requirement?.linked_session_ids?.length || 0) +
    (requirement?.linked_insight_ids?.length || 0);

  if (evidenceCount >= 4) {
    return {
      label: "Strong evidence",
      description: "You have signal from more than one source, including AI tests and real customer input.",
    };
  }

  if (evidenceCount >= 2) {
    return {
      label: "Some evidence",
      description: "The direction looks promising, but you still need one more useful input before deciding.",
    };
  }

  return {
    label: "Early signal",
    description: "You only have a small amount of proof so far, so this should still be treated as a hypothesis.",
  };
}

export function getRecommendedNextAction(requirement: RequirementLike | null | undefined) {
  if (requirement?.recommended_next_action) {
    return requirement.recommended_next_action;
  }

  const confidence = getConfidenceMeta(estimateDecisionConfidence(requirement));

  if (confidence.level === "high") {
    return "Turn this into a shareable recommendation, align the team, and move forward.";
  }

  if (confidence.level === "medium") {
    return "Do one quick real-customer check with a survey, interview, or session before rolling this out widely.";
  }

  return "Start with an AI test, then talk to real customers if this decision still matters.";
}

export function buildDecisionMemo(input: {
  title: string;
  confidenceScore: number;
  evidenceLabel: string;
  summary: string;
  risk: string;
  nextAction: string;
}) {
  const confidence = getConfidenceMeta(input.confidenceScore);

  return {
    recommendation:
      confidence.level === "high"
        ? "Move forward and keep an eye on results."
        : confidence.level === "medium"
          ? "Run a quick real-customer check before rollout."
          : "Do not move yet. Gather more proof first.",
    confidence: confidence.label,
    evidence: input.evidenceLabel,
    summary: input.summary,
    risk: input.risk,
    nextAction: input.nextAction,
  };
}

export function getRequirementDecisionMemo(requirement: RequirementLike | null | undefined) {
  if (requirement?.decision_memo) {
    return {
      recommendation: requirement.decision_memo.recommendation || "Gather more evidence before acting.",
      confidence: requirement.decision_memo.confidence || getConfidenceMeta(estimateDecisionConfidence(requirement)).label,
      evidence: requirement.decision_memo.evidence || getEvidenceStatus(requirement).label,
      summary:
        requirement.decision_memo.summary ||
        requirement.findings_summary ||
        requirement.description ||
        requirement.business_context ||
        "No summary yet.",
      risk: requirement.decision_memo.risk || "No explicit risk captured yet.",
      nextAction: requirement.decision_memo.next_action || getRecommendedNextAction(requirement),
    };
  }

  return buildDecisionMemo({
    title: requirement?.description || "Decision",
    confidenceScore: estimateDecisionConfidence(requirement),
    evidenceLabel: getEvidenceStatus(requirement).label,
    summary:
      requirement?.findings_summary ||
      requirement?.description ||
      requirement?.business_context ||
      "No summary yet.",
    risk:
      getConfidenceMeta(estimateDecisionConfidence(requirement)).level === "high"
        ? "The main risk is how well this is executed after launch."
        : getConfidenceMeta(estimateDecisionConfidence(requirement)).level === "medium"
          ? "The current signal is promising, but it can still fail when real customers see it."
          : "There is not enough proof yet to make a confident founder decision.",
    nextAction: getRecommendedNextAction(requirement),
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
