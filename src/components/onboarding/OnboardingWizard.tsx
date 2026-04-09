import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Users2,
  Zap,
  PartyPopper,
  X,
} from "lucide-react";

interface OnboardingWizardProps {
  onComplete: () => void;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const workspaceId = currentWorkspace?.id;

  const [step, setStep] = useState(0);
  const totalSteps = 4;

  // Step 1: Twin creation form state
  const [twinName, setTwinName] = useState("");
  const [ageRange, setAgeRange] = useState("25-34");
  const [gender, setGender] = useState("mixed");
  const [location, setLocation] = useState("");
  const [income, setIncome] = useState("middle");

  // Step 2: Simulation state
  const [createdSegmentId, setCreatedSegmentId] = useState<string | null>(null);
  const [stimulus, setStimulus] = useState(
    "We're launching an organic energy drink priced at $3.99. How do you feel about it?"
  );
  const [simResult, setSimResult] = useState<any>(null);

  // Create Twin
  const createTwinMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("segment_profiles")
        .insert({
          workspace_id: workspaceId,
          name: twinName,
          demographics: {
            age_range: ageRange,
            gender,
            location: location || "United States",
            income_level: income,
          },
          psychographics: {},
          behavioral_data: {},
          cultural_context: {},
          created_by: user!.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setCreatedSegmentId(data.id);
      queryClient.invalidateQueries({ queryKey: ["segment-profiles"] });
      toast({ title: "Twin created!", description: `"${twinName}" is ready for simulation.` });
      setStep(2);
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Run Simulation
  const simulateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("simulate", {
        body: {
          segment_id: createdSegmentId,
          stimulus,
          workspace_id: workspaceId,
          title: stimulus.slice(0, 80),
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
    onError: (e) => toast({ title: "Simulation failed", description: e.message, variant: "destructive" }),
  });

  // Complete onboarding
  const completeOnboarding = async () => {
    await supabase
      .from("profiles")
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq("id", user!.id);
    queryClient.invalidateQueries({ queryKey: ["profile"] });
    onComplete();
  };

  const progress = Math.round(((step + 1) / totalSteps) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-xl mx-4 bg-card border rounded-2xl shadow-2xl overflow-hidden">
        {/* Skip button */}
        <button
          onClick={completeOnboarding}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground z-10 transition-colors"
          title="Skip onboarding"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Progress bar */}
        <div className="px-6 pt-6">
          <Progress value={progress} className="h-1.5" />
          <p className="text-[10px] text-muted-foreground text-right mt-1">
            Step {step + 1} of {totalSteps}
          </p>
        </div>

        <div className="p-8 pt-4">
          {/* ═══ Step 0: Welcome ═══ */}
          {step === 0 && (
            <div className="text-center space-y-6 py-4">
              <div className="mx-auto w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center animate-pulse">
                <Sparkles className="h-10 w-10 text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Welcome to InsightForge</h2>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  Let's create your first <strong>Digital Consumer Twin</strong> and run a simulation
                  in under 5 minutes.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Button size="lg" className="w-full" onClick={() => setStep(1)}>
                  Let's Go <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
                <Button variant="ghost" size="sm" onClick={completeOnboarding}>
                  Skip for now
                </Button>
              </div>
            </div>
          )}

          {/* ═══ Step 1: Create Twin ═══ */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <Users2 className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Create Your First Twin</h2>
                  <p className="text-xs text-muted-foreground">Define a consumer persona to simulate.</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-sm">Persona Name</Label>
                  <Input
                    placeholder="e.g., Health-Conscious Millennials"
                    value={twinName}
                    onChange={(e) => setTwinName(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm">Age Range</Label>
                    <Select value={ageRange} onValueChange={setAgeRange}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="18-24">18–24</SelectItem>
                        <SelectItem value="25-34">25–34</SelectItem>
                        <SelectItem value="35-44">35–44</SelectItem>
                        <SelectItem value="45-54">45–54</SelectItem>
                        <SelectItem value="55+">55+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm">Gender</Label>
                    <Select value={gender} onValueChange={setGender}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mixed">Mixed</SelectItem>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-sm">Location</Label>
                  <Input
                    placeholder="e.g., New York, Dubai, London"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-sm">Income Level</Label>
                  <Select value={income} onValueChange={setIncome}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low income</SelectItem>
                      <SelectItem value="middle">Middle class</SelectItem>
                      <SelectItem value="upper-middle">Upper middle</SelectItem>
                      <SelectItem value="high">High income</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="ghost" onClick={() => setStep(0)}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => createTwinMutation.mutate()}
                  disabled={!twinName.trim() || createTwinMutation.isPending}
                >
                  {createTwinMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
                  ) : (
                    <><Sparkles className="h-4 w-4 mr-2" /> Create Twin</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* ═══ Step 2: Run First Simulation ═══ */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Run Your First Simulation</h2>
                  <p className="text-xs text-muted-foreground">Ask your twin a question and see their simulated response.</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="bg-muted/50 rounded-lg p-3 flex items-center gap-2">
                  <Users2 className="h-4 w-4 text-purple-500" />
                  <span className="text-sm font-medium">{twinName}</span>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 ml-auto" />
                </div>

                <div>
                  <Label className="text-sm">Question / Stimulus</Label>
                  <Textarea
                    rows={3}
                    value={stimulus}
                    onChange={(e) => setStimulus(e.target.value)}
                    className="mt-1 resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="ghost" onClick={() => setStep(1)}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => simulateMutation.mutate()}
                  disabled={!stimulus.trim() || simulateMutation.isPending}
                >
                  {simulateMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Simulating...</>
                  ) : (
                    <><Zap className="h-4 w-4 mr-2" /> Run Simulation</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* ═══ Step 3: Results & Celebration ═══ */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="text-center space-y-3">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center animate-bounce">
                  <PartyPopper className="h-8 w-8 text-emerald-500" />
                </div>
                <h2 className="text-xl font-bold">Your First Simulation is Complete!</h2>
                <p className="text-sm text-muted-foreground">
                  Here's how <strong>{twinName}</strong> responded:
                </p>
              </div>

              {simResult && (
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <p className="text-sm leading-relaxed">
                    {simResult.response?.substring(0, 300)}{simResult.response?.length > 300 ? "..." : ""}
                  </p>
                  <div className="flex flex-wrap gap-3 text-xs">
                    <span className="bg-card border rounded-full px-3 py-1">
                      Sentiment: <strong className={simResult.sentiment > 0.2 ? "text-emerald-500" : simResult.sentiment < -0.2 ? "text-red-500" : "text-amber-500"}>
                        {simResult.sentiment?.toFixed(2)}
                      </strong>
                    </span>
                    <span className="bg-card border rounded-full px-3 py-1">
                      Confidence: <strong className="text-blue-500">
                        {Math.round((simResult.confidence || 0) * 100)}%
                      </strong>
                    </span>
                  </div>
                </div>
              )}

              <Button className="w-full" size="lg" onClick={completeOnboarding}>
                Continue to Dashboard <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
