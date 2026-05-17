import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, ChevronLeft, ChevronRight, DollarSign, Loader2, Megaphone, ShieldCheck, Target } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  calculateEffectiveHourlyRateCents,
  estimateFillTimeHours,
  formatPanelCurrency,
  isMissingSchemaObject,
  recommendRewardCents,
  type StudyLaunchDraft,
  validateStudyLaunch,
} from "@/services/panelService";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  initialDraft?: Partial<StudyLaunchDraft> | null;
}

const STUDY_TYPES = [
  { value: "survey", label: "Survey" },
  { value: "focus_group", label: "Focus Group" },
  { value: "interview", label: "Interview" },
  { value: "usability_test", label: "Usability Test" },
  { value: "twin_calibration", label: "AI Twin Calibration" },
];

const CONSENT_POLICIES = [
  { value: "standard_anonymized_research", label: "Standard anonymized research" },
  { value: "ai_model_calibration", label: "AI model calibration consent" },
  { value: "moderated_recording", label: "Moderated session recording consent" },
  { value: "byo_customer_panel", label: "Owned customer panel consent" },
];

const STEPS = ["Goal", "Audience", "Incentive", "Review"];

async function getFunctionErrorMessage(error: any) {
  const response = error?.context;
  if (response && typeof response.json === "function") {
    try {
      const payload = await response.clone().json();
      return payload?.error || payload?.message || error.message;
    } catch {
      return error.message;
    }
  }
  return error?.message || "Study publishing failed.";
}

export function CreateStudyDialog({ open, onOpenChange, workspaceId, initialDraft }: Props) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [studyType, setStudyType] = useState("survey");
  const [estimatedMinutes, setEstimatedMinutes] = useState("15");
  const [rewardDollars, setRewardDollars] = useState("5.00");
  const [maxParticipants, setMaxParticipants] = useState("50");
  const [targetAudience, setTargetAudience] = useState("");
  const [screenerSummary, setScreenerSummary] = useState("");
  const [consentPolicy, setConsentPolicy] = useState("standard_anonymized_research");
  const [recruitmentSource, setRecruitmentSource] = useState("marketplace_and_owned");

  useEffect(() => {
    if (!open) return;
    if (!initialDraft) {
      resetForm();
      return;
    }
    setTitle(initialDraft.title || "");
    setDescription(initialDraft.description || "");
    setStudyType(initialDraft.studyType || "survey");
    setEstimatedMinutes(String(initialDraft.estimatedMinutes || 15));
    setRewardDollars(((initialDraft.rewardAmountCents || 500) / 100).toFixed(2));
    setMaxParticipants(String(initialDraft.maxParticipants || 50));
    setTargetAudience(initialDraft.targetAudience || "");
    setScreenerSummary(initialDraft.screenerSummary || "");
    setConsentPolicy(initialDraft.consentPolicy || "standard_anonymized_research");
    setStep(0);
  }, [initialDraft, open]);

  const draft: StudyLaunchDraft = useMemo(() => ({
    title,
    description,
    studyType: studyType as StudyLaunchDraft["studyType"],
    estimatedMinutes: parseInt(estimatedMinutes || "0", 10),
    rewardAmountCents: Math.round(parseFloat(rewardDollars || "0") * 100),
    maxParticipants: parseInt(maxParticipants || "0", 10),
    targetAudience,
    screenerSummary,
    consentPolicy,
    linkedRequirementId: initialDraft?.linkedRequirementId,
  }), [
    title,
    description,
    studyType,
    estimatedMinutes,
    rewardDollars,
    maxParticipants,
    targetAudience,
    screenerSummary,
    consentPolicy,
    initialDraft?.linkedRequirementId,
  ]);

  const launchValidation = useMemo(() => validateStudyLaunch(draft), [draft]);
  const effectiveHourlyRate = calculateEffectiveHourlyRateCents(draft.rewardAmountCents, draft.estimatedMinutes);
  const recommendedReward = recommendRewardCents(draft.estimatedMinutes);
  const estimatedFillHours = estimateFillTimeHours(draft.maxParticipants, draft.maxParticipants * 2);

  const createMutation = useMutation({
    mutationFn: async () => {
      const validation = validateStudyLaunch(draft);
      if (!validation.valid) throw new Error(validation.errors[0]);
      const studyPayload = {
        workspace_id: workspaceId,
        title: draft.title,
        description: draft.description,
        study_type: draft.studyType,
        estimated_minutes: draft.estimatedMinutes,
        reward_amount_cents: draft.rewardAmountCents,
        max_participants: draft.maxParticipants,
        requirements: {
          target_audience: draft.targetAudience,
          screener_summary: draft.screenerSummary,
          consent_policy: draft.consentPolicy,
          recruitment_source: recruitmentSource,
          linked_requirement_id: draft.linkedRequirementId || null,
          effective_hourly_rate_cents: validation.effectiveHourlyRateCents,
          recommended_reward_cents: validation.recommendedRewardCents,
        },
        screener_questions: [
          {
            type: "summary",
            prompt: draft.screenerSummary,
            required: true,
          },
        ],
        status: "active",
      };

      let data: any = null;
      const { data: functionData, error } = await supabase.functions.invoke("study-listing", {
        body: studyPayload,
      });

      if (error) {
        const functionMessage = await getFunctionErrorMessage(error);
        const { data: inserted, error: insertError } = await supabase
          .from("study_listings")
          .insert(studyPayload as any)
          .select()
          .single();

        if (insertError) {
          if (isMissingSchemaObject(insertError)) {
            throw new Error("Study marketplace storage is not migrated yet. Apply the participant portal migration before publishing studies.");
          }
          throw new Error(`${functionMessage} Direct insert also failed: ${insertError.message}`);
        }
        data = inserted;
      } else {
        data = functionData;
      }

      if (data?.error) throw new Error(data.error);
      if (draft.linkedRequirementId && data?.id) {
        const { error: linkError } = await supabase
          .from("requirements")
          .update({
            status: "in_progress",
            linked_study_listing_ids: [data.id],
          } as any)
          .eq("id", draft.linkedRequirementId);
        if (linkError) {
          if (isMissingSchemaObject(linkError)) return data;
          await supabase.from("requirements").update({ status: "in_progress" }).eq("id", draft.linkedRequirementId);
        }
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study-listings"] });
      queryClient.invalidateQueries({ queryKey: ["panel-command-center"] });
      queryClient.invalidateQueries({ queryKey: ["requirements"] });
      toast({ title: "Study Published!", description: "Participants can now see and accept your study." });
      resetForm();
      onOpenChange(false);
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setStep(0);
    setTitle("");
    setDescription("");
    setStudyType("survey");
    setEstimatedMinutes("15");
    setRewardDollars("5.00");
    setMaxParticipants("50");
    setTargetAudience("");
    setScreenerSummary("");
    setConsentPolicy("standard_anonymized_research");
    setRecruitmentSource("marketplace_and_owned");
  };

  const canAdvance = () => {
    if (step === 0) return title.trim() && description.trim() && draft.estimatedMinutes > 0;
    if (step === 1) return targetAudience.trim() && screenerSummary.trim() && consentPolicy.trim();
    if (step === 2) return draft.rewardAmountCents > 0 && draft.maxParticipants > 0 && effectiveHourlyRate >= 800;
    return launchValidation.valid;
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) resetForm();
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Launch Study
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{STEPS[step]}</span>
              <span>{step + 1} of {STEPS.length}</span>
            </div>
            <Progress value={((step + 1) / STEPS.length) * 100} className="h-1.5" />
          </div>

          <div className="grid grid-cols-4 gap-2">
            {STEPS.map((label, index) => (
              <div key={label} className="flex items-center gap-2 rounded-md border p-2 text-xs">
                <span className={index <= step ? "text-primary" : "text-muted-foreground"}>
                  {index < step ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <span className="truncate">{label}</span>
              </div>
            ))}
          </div>

          {step === 0 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Study goal *</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Validate checkout friction for first-time buyers" />
              </div>
              <div className="space-y-2">
                <Label>Decision this should unlock *</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the business decision, product risk, and what participants will do."
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Method</Label>
                  <Select value={studyType} onValueChange={setStudyType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STUDY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Duration (min)</Label>
                  <Input type="number" value={estimatedMinutes} onChange={(e) => setEstimatedMinutes(e.target.value)} min={1} />
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Target audience *</Label>
                <Textarea
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="Example: US SaaS founders, 1-50 employees, evaluating onboarding analytics tools."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Screener / eligibility logic *</Label>
                <Textarea
                  value={screenerSummary}
                  onChange={(e) => setScreenerSummary(e.target.value)}
                  placeholder="List must-have criteria, exclusion rules, and any quota balance needed."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Recruitment source</Label>
                  <Select value={recruitmentSource} onValueChange={setRecruitmentSource}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="marketplace_and_owned">Marketplace + owned panel</SelectItem>
                      <SelectItem value="marketplace">Marketplace only</SelectItem>
                      <SelectItem value="owned_panel">Owned panel only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Consent policy *</Label>
                  <Select value={consentPolicy} onValueChange={setConsentPolicy}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONSENT_POLICIES.map((policy) => (
                        <SelectItem key={policy.value} value={policy.value}>{policy.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Reward per participant ($)</Label>
                  <Input type="number" value={rewardDollars} onChange={(e) => setRewardDollars(e.target.value)} min={1} step={0.5} />
                </div>
                <div className="space-y-2">
                  <Label>Sample size</Label>
                  <Input type="number" value={maxParticipants} onChange={(e) => setMaxParticipants(e.target.value)} min={1} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Effective rate</p>
                  <p className="text-xl font-bold">{formatPanelCurrency(effectiveHourlyRate)}/hr</p>
                  <Badge variant={effectiveHourlyRate >= 800 ? "secondary" : "destructive"} className="mt-2">
                    {effectiveHourlyRate >= 800 ? "Fairness passed" : "Below minimum"}
                  </Badge>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Total budget</p>
                  <p className="text-xl font-bold">{formatPanelCurrency(launchValidation.totalBudgetCents)}</p>
                  <p className="text-xs text-muted-foreground mt-2">Before platform/provider fees</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Recommended reward</p>
                  <p className="text-xl font-bold">{formatPanelCurrency(recommendedReward)}</p>
                  <p className="text-xs text-muted-foreground mt-2">Based on $12/hr</p>
                </div>
              </div>
              {effectiveHourlyRate < 800 && (
                <Alert variant="destructive">
                  <AlertDescription>Raise the reward or shorten duration before launch. Low pay damages fill rate and data quality.</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border p-3">
                  <Target className="h-4 w-4 text-primary mb-2" />
                  <p className="text-xs text-muted-foreground">Audience</p>
                  <p className="text-sm font-medium line-clamp-3">{targetAudience || "Missing"}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <DollarSign className="h-4 w-4 text-primary mb-2" />
                  <p className="text-xs text-muted-foreground">Budget</p>
                  <p className="text-sm font-medium">{formatPanelCurrency(launchValidation.totalBudgetCents)}</p>
                  <p className="text-xs text-muted-foreground">{formatPanelCurrency(effectiveHourlyRate)}/hr effective</p>
                </div>
                <div className="rounded-lg border p-3">
                  <ShieldCheck className="h-4 w-4 text-primary mb-2" />
                  <p className="text-xs text-muted-foreground">Expected fill</p>
                  <p className="text-sm font-medium">{estimatedFillHours ? `${estimatedFillHours} hours` : "Needs supply check"}</p>
                  <p className="text-xs text-muted-foreground">{CONSENT_POLICIES.find((p) => p.value === consentPolicy)?.label}</p>
                </div>
              </div>

              {(launchValidation.errors.length > 0 || launchValidation.warnings.length > 0) && (
                <div className="space-y-2">
                  {launchValidation.errors.map((error) => (
                    <Alert key={error} variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
                  ))}
                  {launchValidation.warnings.map((warning) => (
                    <Alert key={warning}><AlertDescription>{warning}</AlertDescription></Alert>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between border-t pt-4">
            <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || createMutation.isPending}>
              <ChevronLeft className="h-4 w-4 me-1" />
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))} disabled={!canAdvance()}>
                Continue
                <ChevronRight className="h-4 w-4 ms-1" />
              </Button>
            ) : (
              <Button onClick={() => createMutation.mutate()} disabled={!launchValidation.valid || createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                Publish Study
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
