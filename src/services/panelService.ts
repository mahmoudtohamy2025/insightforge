import { supabase } from "@/integrations/supabase/client";

export const MIN_REWARD_PER_HOUR_CENTS = 800;
export const RECOMMENDED_REWARD_PER_HOUR_CENTS = 1200;

export type StudyMethod =
  | "survey"
  | "focus_group"
  | "interview"
  | "usability_test"
  | "twin_calibration";

export type PanelRequirement = {
  id: string;
  title: string;
  description?: string | null;
  business_context?: string | null;
  category?: string | null;
  priority?: string | null;
  status?: string | null;
  target_audience?: string | null;
  target_market?: string | null;
  suggested_methodology?: string[] | null;
  requested_deadline?: string | null;
  ai_methodology_suggestion?: Record<string, unknown> | null;
};

export type StudyLaunchDraft = {
  title: string;
  description: string;
  studyType: StudyMethod;
  estimatedMinutes: number;
  rewardAmountCents: number;
  maxParticipants: number;
  targetAudience: string;
  screenerSummary: string;
  consentPolicy: string;
  linkedRequirementId?: string;
};

export type LaunchValidation = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  effectiveHourlyRateCents: number;
  totalBudgetCents: number;
  recommendedRewardCents: number;
};

export type PanelCommandCenter = {
  participants: any[];
  requirements: PanelRequirement[];
  studies: any[];
  incentivePrograms: any[];
  disbursements: any[];
  marketplaceProfiles: any[];
  participations: any[];
  stats: {
    activeStudies: number;
    pendingApprovals: number;
    studiesAtRisk: number;
    exhaustedBudgets: number;
    totalParticipants: number;
    marketplaceParticipants: number;
    avgQualityScore: number;
    totalBudgetCents: number;
    spentBudgetCents: number;
    pendingPayoutCents: number;
    acceptanceRate: number;
    completionRate: number;
    medianTimeToFirstQualifiedHours: number | null;
    completedRequirements: number;
    openRequirements: number;
  };
};

export function formatPanelCurrency(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function calculateEffectiveHourlyRateCents(rewardAmountCents: number, estimatedMinutes: number) {
  if (!estimatedMinutes || estimatedMinutes <= 0) return 0;
  return Math.round(rewardAmountCents * (60 / estimatedMinutes));
}

export function recommendRewardCents(estimatedMinutes: number, hourlyRateCents = RECOMMENDED_REWARD_PER_HOUR_CENTS) {
  if (!estimatedMinutes || estimatedMinutes <= 0) return 0;
  return Math.max(100, Math.ceil((hourlyRateCents * estimatedMinutes) / 60 / 50) * 50);
}

export function estimateFillTimeHours(maxParticipants: number, matchingParticipants: number) {
  if (maxParticipants <= 0) return null;
  if (matchingParticipants <= 0) return null;
  const supplyRatio = matchingParticipants / maxParticipants;
  if (supplyRatio >= 5) return 4;
  if (supplyRatio >= 2) return 12;
  if (supplyRatio >= 1) return 36;
  return 72;
}

export function validateStudyLaunch(draft: StudyLaunchDraft): LaunchValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const effectiveHourlyRateCents = calculateEffectiveHourlyRateCents(
    draft.rewardAmountCents,
    draft.estimatedMinutes,
  );
  const totalBudgetCents = draft.rewardAmountCents * draft.maxParticipants;
  const recommendedRewardCents = recommendRewardCents(draft.estimatedMinutes);

  if (!draft.title.trim()) errors.push("Add a clear study title.");
  if (!draft.targetAudience.trim()) errors.push("Define the target audience before launch.");
  if (!draft.screenerSummary.trim()) errors.push("Add screener or eligibility logic.");
  if (!draft.consentPolicy.trim()) errors.push("Choose a consent and data-use policy.");
  if (draft.estimatedMinutes < 1) errors.push("Estimated duration must be at least 1 minute.");
  if (draft.maxParticipants < 1) errors.push("Sample size must be at least 1 participant.");
  if (draft.rewardAmountCents < 100) errors.push("Reward must be at least $1.00.");
  if (effectiveHourlyRateCents < MIN_REWARD_PER_HOUR_CENTS) {
    errors.push("Reward is below the $8/hr minimum fairness guardrail.");
  }

  if (draft.rewardAmountCents < recommendedRewardCents) {
    warnings.push("Reward is below the recommended $12/hr rate for stronger completion quality.");
  }
  if (draft.maxParticipants < 5 && draft.studyType !== "interview") {
    warnings.push("Small sample size may limit confidence for non-interview methods.");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    effectiveHourlyRateCents,
    totalBudgetCents,
    recommendedRewardCents,
  };
}

export function mapRequirementToStudyDraft(requirement: PanelRequirement): StudyLaunchDraft {
  const suggested = requirement.suggested_methodology?.[0] ||
    String(requirement.ai_methodology_suggestion?.recommended_methodology || "");
  const lowerSuggested = suggested.toLowerCase();
  const studyType: StudyMethod = lowerSuggested.includes("interview")
    ? "interview"
    : lowerSuggested.includes("focus")
      ? "focus_group"
      : lowerSuggested.includes("usability")
        ? "usability_test"
        : lowerSuggested.includes("calibration") || lowerSuggested.includes("twin")
          ? "twin_calibration"
          : "survey";
  const estimatedMinutes = studyType === "interview" || studyType === "focus_group" ? 45 : 15;

  return {
    title: requirement.title,
    description: [
      requirement.description,
      requirement.business_context ? `Business context: ${requirement.business_context}` : "",
    ].filter(Boolean).join("\n\n"),
    studyType,
    estimatedMinutes,
    rewardAmountCents: recommendRewardCents(estimatedMinutes),
    maxParticipants: studyType === "interview" ? 8 : studyType === "focus_group" ? 12 : 50,
    targetAudience: requirement.target_audience || requirement.target_market || "",
    screenerSummary: requirement.target_audience
      ? `Must match: ${requirement.target_audience}`
      : "",
    consentPolicy: "standard_anonymized_research",
    linkedRequirementId: requirement.id,
  };
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
}

export function isMissingSchemaObject(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error ? String((error as { message?: unknown }).message || "") : "";
  const code = "code" in error ? String((error as { code?: unknown }).code || "") : "";
  return (
    code === "PGRST205" ||
    message.includes("Could not find the table") ||
    message.includes("schema cache") ||
    message.includes("relation") && message.includes("does not exist")
  );
}

function dataOrEmpty<T>(result: { data: T[] | null; error: unknown }, tableLabel: string): T[] {
  if (!result.error) return result.data || [];
  if (isMissingSchemaObject(result.error)) {
    console.warn(`[panelService] ${tableLabel} is not migrated yet; rendering panel section as empty.`);
    return [];
  }
  throw result.error;
}

export function buildPanelCommandCenter(input: Omit<PanelCommandCenter, "stats">): PanelCommandCenter {
  const { participants, requirements, studies, incentivePrograms, disbursements, marketplaceProfiles, participations } = input;
  const activeStudies = studies.filter((study) => study.status === "active").length;
  const pendingApprovals = participations.filter((p) => ["submitted", "under_review"].includes(p.status)).length;
  const studiesAtRisk = studies.filter((study) => {
    const current = Number(study.current_participants || 0);
    const max = Number(study.max_participants || 0);
    const closesAt = study.closes_at ? new Date(study.closes_at).getTime() : null;
    const closingSoon = closesAt ? closesAt - Date.now() < 3 * 24 * 60 * 60 * 1000 : false;
    return study.status === "active" && (closingSoon || (max > 0 && current / max < 0.25));
  }).length;
  const exhaustedBudgets = incentivePrograms.filter((program) =>
    program.status === "exhausted" ||
    (Number(program.total_budget_cents || 0) > 0 &&
      Number(program.spent_cents || 0) >= Number(program.total_budget_cents || 0))
  ).length;
  const avgQualityScore = participants.length
    ? participants.reduce((sum, p) => sum + Number(p.quality_score || 0), 0) / participants.length
    : 0;
  const totalBudgetCents = incentivePrograms.reduce((sum, p) => sum + Number(p.total_budget_cents || 0), 0);
  const spentBudgetCents = incentivePrograms.reduce((sum, p) => sum + Number(p.spent_cents || 0), 0);
  const pendingPayoutCents = disbursements
    .filter((d) => ["pending", "awaiting_approval", "processing"].includes(d.status))
    .reduce((sum, d) => sum + Number(d.amount_cents || 0), 0);
  const accepted = participations.filter((p) =>
    ["accepted", "in_progress", "submitted", "under_review", "approved", "paid"].includes(p.status)
  ).length;
  const completed = participations.filter((p) => ["submitted", "under_review", "approved", "paid"].includes(p.status)).length;
  const acceptanceRate = studies.length ? Math.round((accepted / Math.max(1, studies.reduce((sum, s) => sum + Number(s.max_participants || 0), 0))) * 100) : 0;
  const completionRate = accepted ? Math.round((completed / accepted) * 100) : 0;
  const firstQualifiedHours = studies
    .map((study) => {
      const first = participations
        .filter((p) => p.study_id === study.id)
        .map((p) => new Date(p.created_at).getTime())
        .sort((a, b) => a - b)[0];
      if (!first || !study.created_at) return null;
      return Math.max(0, Math.round((first - new Date(study.created_at).getTime()) / (60 * 60 * 1000)));
    })
    .filter((value): value is number => value !== null);

  return {
    ...input,
    stats: {
      activeStudies,
      pendingApprovals,
      studiesAtRisk,
      exhaustedBudgets,
      totalParticipants: participants.length,
      marketplaceParticipants: marketplaceProfiles.length,
      avgQualityScore,
      totalBudgetCents,
      spentBudgetCents,
      pendingPayoutCents,
      acceptanceRate,
      completionRate,
      medianTimeToFirstQualifiedHours: median(firstQualifiedHours),
      completedRequirements: requirements.filter((r) => r.status === "completed").length,
      openRequirements: requirements.filter((r) => !["completed", "declined"].includes(r.status || "")).length,
    },
  };
}

export async function fetchPanelCommandCenter(workspaceId: string): Promise<PanelCommandCenter> {
  const [
    participantsResult,
    requirementsResult,
    studiesResult,
    programsResult,
    disbursementsResult,
    profilesResult,
    participationsResult,
  ] = await Promise.all([
    supabase.from("participants").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
    supabase.from("requirements").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
    supabase.from("study_listings").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
    supabase.from("incentive_programs").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
    supabase.from("incentive_disbursements").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }),
    supabase.from("participant_profiles").select("id, status, verified_at, country, industry, interests, created_at").eq("status", "active").limit(500),
    supabase
      .from("study_participations")
      .select("*, study_listings!inner(workspace_id, title, reward_amount_cents, estimated_minutes)")
      .eq("study_listings.workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
  ]);

  return buildPanelCommandCenter({
    participants: dataOrEmpty(participantsResult, "participants"),
    requirements: dataOrEmpty(requirementsResult, "requirements") as PanelRequirement[],
    studies: dataOrEmpty(studiesResult, "study_listings"),
    incentivePrograms: dataOrEmpty(programsResult, "incentive_programs"),
    disbursements: dataOrEmpty(disbursementsResult, "incentive_disbursements"),
    marketplaceProfiles: dataOrEmpty(profilesResult, "participant_profiles"),
    participations: dataOrEmpty(participationsResult, "study_participations"),
  });
}
