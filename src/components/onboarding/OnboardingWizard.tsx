import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Compass,
  Loader2,
  PartyPopper,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { getConfidenceMeta } from "@/lib/founderDecision";

interface OnboardingWizardProps {
  onComplete: () => void;
}

const decisionPrompts: Record<string, string> = {
  pricing: "We're packaging the product for early-stage SaaS founders. What makes them trust a higher-priced plan instead of defaulting to the cheapest option?",
  messaging: "Which homepage message is more likely to convert an early-stage SaaS founder: 'Hybrid AI-Human Research Platform' or 'Founder Decision OS'?",
  onboarding: "A founder just signed up. What is the fastest onboarding flow that gets them to a useful decision in under five minutes?",
};

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const workspaceId = currentWorkspace?.id;

  const [step, setStep] = useState(0);
  const [stage, setStage] = useState("pre-seed");
  const [decisionFocus, setDecisionFocus] = useState("messaging");
  const [idealCustomer, setIdealCustomer] = useState("Early-stage SaaS founders");
  const [urgency, setUrgency] = useState("this-week");
  const [createdSegmentId, setCreatedSegmentId] = useState<string | null>(null);
  const [simResult, setSimResult] = useState<any>(null);

  const totalSteps = 4;
  const progress = Math.round(((step + 1) / totalSteps) * 100);

  const twinName = useMemo(
    () => `${idealCustomer} - ${decisionFocus} profile`,
    [decisionFocus, idealCustomer]
  );

  const decisionPrompt = decisionPrompts[decisionFocus] || decisionPrompts.messaging;
  const confidence = getConfidenceMeta(simResult?.confidence ?? 0.52);

  const createTwinMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("segment_profiles")
        .insert({
          workspace_id: workspaceId,
          name: twinName,
          description: `Customer profile created during onboarding for ${decisionFocus} decisions at the ${stage} stage.`,
          demographics: {
            age_range: "25-44",
            gender: "Mixed",
            location: "Global SaaS",
            income_level: "Mixed",
          },
          psychographics: {
            values: "Speed, clarity, evidence-backed decisions",
            lifestyle: "Founder-led, time-constrained, growth focused",
            interests: decisionFocus,
          },
          behavioral_data: {
            purchase_behavior: "Evaluates tools based on time-to-value and trust",
            decision_factors: `Urgency: ${urgency}`,
          },
          cultural_context: {
            region: "B2B SaaS",
            language: "English",
          },
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setCreatedSegmentId(data.id);
      queryClient.invalidateQueries({ queryKey: ["segment-profiles"] });
      setStep(2);
      toast({
        title: "Customer profile created",
        description: "Your first customer profile is ready for testing.",
      });
    },
    onError: (error: any) => {
      toast({ title: "Couldn't create customer profile", description: error.message, variant: "destructive" });
    },
  });

  const simulateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("simulate", {
        body: {
          segment_id: createdSegmentId,
          stimulus: decisionPrompt,
          workspace_id: workspaceId,
          title: `${decisionFocus} onboarding test`,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setSimResult(data);
      queryClient.invalidateQueries({ queryKey: ["simulation-history"] });
      setStep(3);
    },
    onError: (error: any) => {
      toast({ title: "AI test failed", description: error.message, variant: "destructive" });
    },
  });

  const completeOnboarding = async () => {
    await supabase
      .from("profiles")
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq("id", user!.id);
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="relative mx-4 w-full max-w-2xl overflow-hidden rounded-[32px] border bg-card shadow-2xl">
        <button
          onClick={completeOnboarding}
          className="absolute right-5 top-5 text-muted-foreground transition-colors hover:text-foreground"
          title="Skip onboarding"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="border-b border-border/70 px-8 py-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-600">
                Founder onboarding
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Set up your first founder decision flow</h2>
            </div>
            <div className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              Step {step + 1} of {totalSteps}
            </div>
          </div>
          <Progress value={progress} className="mt-5 h-1.5" />
        </div>

        <div className="p-8">
          {step === 0 && (
            <div className="space-y-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/10">
                <Compass className="h-8 w-8 text-emerald-600" />
              </div>
              <div className="space-y-3">
                <h3 className="text-3xl font-semibold tracking-tight">This workspace is now tuned for founders.</h3>
                <p className="max-w-xl text-base leading-7 text-muted-foreground">
                  We’ll start by learning what kind of startup you are, what you need to decide next, who your customer is, and how fast you need a useful answer.
                </p>
              </div>
              <div className="rounded-[24px] border border-border/70 bg-muted/20 p-5 text-sm text-muted-foreground">
                Your first win: we will create a customer profile, run one AI test, and show you whether to move forward, check with real customers, or gather more proof.
              </div>
              <div className="flex gap-3">
                <Button size="lg" className="rounded-full px-6" onClick={() => setStep(1)}>
                  Start setup
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button size="lg" variant="ghost" className="rounded-full px-6" onClick={completeOnboarding}>
                  Skip for now
                </Button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-2xl font-semibold tracking-tight">Tell us what you are trying to decide.</h3>
                <p className="text-sm text-muted-foreground">
                  This context shapes your first customer profile and your first recommended next step.
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Startup stage</Label>
                  <Select value={stage} onValueChange={setStage}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pre-seed">Pre-seed</SelectItem>
                      <SelectItem value="seed">Seed</SelectItem>
                      <SelectItem value="series-a">Series A</SelectItem>
                      <SelectItem value="growth">Growth</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Current founder decision</Label>
                  <Select value={decisionFocus} onValueChange={setDecisionFocus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pricing">Pricing</SelectItem>
                      <SelectItem value="messaging">Messaging</SelectItem>
                      <SelectItem value="onboarding">Onboarding</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Who is your ideal customer?</Label>
                <Textarea
                  rows={3}
                  value={idealCustomer}
                  onChange={(event) => setIdealCustomer(event.target.value)}
                  className="resize-none"
                  placeholder="Describe the founder or buyer you most want to understand."
                />
              </div>

              <div className="space-y-2">
                <Label>How fast do you need a useful answer?</Label>
                <Select value={urgency} onValueChange={setUrgency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="this-week">This week</SelectItem>
                    <SelectItem value="this-month">This month</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-[24px] border border-emerald-500/20 bg-emerald-500/5 p-5">
                <div className="text-xs uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">Generated customer profile</div>
                <div className="mt-2 text-base font-medium">{twinName}</div>
                <div className="mt-2 text-sm text-muted-foreground">Urgency: {urgency.replace("-", " ")}. First decision focus: {decisionFocus}.</div>
              </div>

              <div className="flex gap-3">
                <Button variant="ghost" className="rounded-full px-5" onClick={() => setStep(0)}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button
                  className="rounded-full px-6"
                  onClick={() => createTwinMutation.mutate()}
                  disabled={!idealCustomer.trim() || createTwinMutation.isPending}
                >
                  {createTwinMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating customer profile
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Create customer profile
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10">
                  <Zap className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-2xl font-semibold tracking-tight">Run your first AI test</h3>
                  <p className="text-sm text-muted-foreground">This gives you a quick directional read before you spend time talking to real customers.</p>
                </div>
              </div>

              <div className="rounded-[24px] border border-border/70 bg-muted/20 p-5">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Prompt</div>
                <p className="mt-3 text-sm leading-7">{decisionPrompt}</p>
              </div>

              <div className="rounded-[24px] border border-border/70 p-5 text-sm text-muted-foreground">
                Once this runs, the dashboard will tell you whether you are ready to move, should do a quick real-customer check, or need more proof.
              </div>

              <div className="flex gap-3">
                <Button variant="ghost" className="rounded-full px-5" onClick={() => setStep(1)}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button
                  className="rounded-full px-6"
                  onClick={() => simulateMutation.mutate()}
                  disabled={simulateMutation.isPending}
                >
                  {simulateMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Running AI test
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-4 w-4" />
                      Run first AI test
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/10">
                  <PartyPopper className="h-8 w-8 text-emerald-600" />
                </div>
                <h3 className="mt-4 text-2xl font-semibold tracking-tight">Your founder workspace is ready.</h3>
                <p className="mt-3 text-sm text-muted-foreground">
                  You now have a customer profile, a live test result, and a confidence level to guide your next move.
                </p>
              </div>

              <div className="rounded-[24px] border border-border/70 bg-muted/20 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium">{twinName}</div>
                  <div className={`rounded-full px-3 py-1 text-xs font-medium ${confidence.badgeClassName}`}>
                    {confidence.label}
                  </div>
                </div>
                {simResult && (
                  <>
                    {simResult.generation_mode === "heuristic_fallback" && (
                      <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
                        {simResult.notice || "This result is running in sample mode until a Gemini API key is configured."}
                      </div>
                    )}
                    <p className="mt-4 text-sm leading-7 text-foreground/85">
                      {simResult.response?.substring(0, 280)}
                      {simResult.response?.length > 280 ? "..." : ""}
                    </p>
                    <div className="mt-4 rounded-2xl border p-4 text-sm">
                      <div className="font-medium">{confidence.ctaLabel}</div>
                      <div className="mt-1 text-muted-foreground">{confidence.summary}</div>
                    </div>
                  </>
                )}
              </div>

              <div className="rounded-[24px] border border-emerald-500/20 bg-emerald-500/5 p-5">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-600" />
                  <div className="text-sm">
                    The dashboard will now show this inside your workspace with clear decision tracking, simpler navigation, and suggested next steps.
                  </div>
                </div>
              </div>

              <Button size="lg" className="w-full rounded-full" onClick={completeOnboarding}>
                Continue to founder workspace
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <div className="text-center text-xs text-muted-foreground">
                You can always come back to AI tests, real-customer research, and accuracy reviews later.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
