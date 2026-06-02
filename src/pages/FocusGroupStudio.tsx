import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { getSegments } from "@/services/segmentService";
import { trackEvent } from "@/lib/analytics";
import {
  getNextTestSuggestions,
  runFocusGroup,
  seedFromIdea,
  type NextTestFocusArea,
  type NextTestSuggestion,
} from "@/services/simulationService";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  Loader2,
  MessageCircle,
  ArrowLeft,
  Users2,
  TrendingUp,
  BarChart3,
  Tag,
  ShieldCheck,
  AlertTriangle,
  Info,
  Lightbulb,
  ArrowRight,
  DollarSign,
} from "lucide-react";
import { TierGate } from "@/components/TierGate";
import { generateFocusGroupPDF } from "@/lib/pdfExport";
import { Download } from "lucide-react";
import { ProductTour } from "@/components/onboarding/ProductTour";
import { TOUR_FOCUS_GROUP } from "@/lib/tourDefinitions";
import {
  bassDiffusion,
  deriveBassParams,
  findPeakMonth,
  findSaturationMonth,
} from "@/lib/bassDiffusion";
import { BassDiffusionChart } from "@/components/charts/BassDiffusionChart";
import { Input } from "@/components/ui/input";

const sentimentColor = (s: number) => {
  if (s > 0.2) return "text-emerald-500";
  if (s < -0.2) return "text-red-500";
  return "text-amber-500";
};

// Strict Traffic Light rule from Brainstorm Document
const confidenceConfig = (c: number) => {
  if (c >= 0.8) return { bg: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400", label: "High Confidence", icon: ShieldCheck };
  if (c >= 0.6) return { bg: "bg-amber-500", text: "text-amber-700 dark:text-amber-400", label: "Medium Confidence", icon: Info };
  return { bg: "bg-red-500", text: "text-red-700 dark:text-red-400", label: "Low Confidence", icon: AlertTriangle };
};

const emotionEmoji: Record<string, string> = {
  excited: "🤩", interested: "🤔", neutral: "😐",
  skeptical: "🧐", concerned: "😟", opposed: "😠",
};

// STRICT RULE: Purple = Synthetic
const avatarColors = [
  "bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30",
];

const focusAreaMeta: Record<NextTestFocusArea, { icon: typeof Sparkles; label: string }> = {
  price: { icon: DollarSign, label: "Price" },
  feature: { icon: Sparkles, label: "Feature" },
  messaging: { icon: MessageCircle, label: "Messaging" },
  audience: { icon: Users2, label: "Audience" },
  positioning: { icon: Tag, label: "Positioning" },
};

const FocusGroupStudio = () => {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("project_id");
  const queryClient = useQueryClient();
  const workspaceId = currentWorkspace?.id;

  const [selectedSegmentIds, setSelectedSegmentIds] = useState<string[]>([]);
  const [stimulus, setStimulus] = useState("");
  const [numRounds, setNumRounds] = useState("2");
  const [ramadanMode, setRamadanMode] = useState(false);
  const [result, setResult] = useState<any>(null);
  const stimulusRef = useRef<HTMLTextAreaElement | null>(null);

  // Blank-screen fix: idea-seed input. When the form is empty (no segments
  // picked, no stimulus, no result), show a one-sentence idea box that the
  // strategist turns into a pre-filled setup.
  const [idea, setIdea] = useState("");
  const [seedRationale, setSeedRationale] = useState<string | null>(null);

  // Market Projection (Option A): user inputs for the adoption-curve forecast.
  // Derived Bass params come from focus-group aggregate (sentiment, consensus,
  // confidence) — see comment block where bassDiffusion is called.
  const [projectionMarketSize, setProjectionMarketSize] = useState("100000");
  const [projectionMonths, setProjectionMonths] = useState("24");

  const { data: segments = [] } = useQuery({
    queryKey: ["segment-profiles", workspaceId],
    queryFn: () => getSegments(workspaceId!),
    enabled: !!workspaceId,
  });

  // Aha-loop: ask the strategist what to test next, keyed by the completed simulation
  const nextTestsQuery = useQuery({
    queryKey: ["next-tests", result?.simulation_id],
    queryFn: () =>
      getNextTestSuggestions({
        simulation_id: result!.simulation_id,
        workspace_id: workspaceId!,
      }),
    enabled: !!result?.simulation_id && !!workspaceId,
    staleTime: Infinity,
    retry: false,
  });

  const applySuggestion = (suggestion: NextTestSuggestion) => {
    setStimulus(suggestion.stimulus_template);
    requestAnimationFrame(() => {
      stimulusRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      stimulusRef.current?.focus();
    });
  };

  const toggleSegment = (id: string) => {
    setSelectedSegmentIds(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : prev.length < 5 ? [...prev, id] : prev
    );
  };

  const runMutation = useMutation({
    mutationFn: () =>
      runFocusGroup({
        segment_ids: selectedSegmentIds,
        stimulus,
        workspace_id: workspaceId!,
        num_rounds: parseInt(numRounds),
        ramadan_mode: ramadanMode,
        project_id: projectId,
      }),
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["simulation-history", workspaceId] });
      trackEvent("focus_group_run", { segments: selectedSegmentIds.length, rounds: data?.rounds?.length });
      toast({ title: "Focus group complete!", description: `${data.aggregate.participant_count} participants, ${data.rounds.length} rounds` });
    },
    onError: (e) => toast({ title: "Focus group failed", description: e.message, variant: "destructive" }),
  });

  const seedMutation = useMutation({
    mutationFn: () => seedFromIdea({ idea: idea.trim(), workspace_id: workspaceId! }),
    onSuccess: (data) => {
      setSelectedSegmentIds(data.segment_ids);
      setStimulus(data.stimulus);
      const rounds = Math.min(Math.max(data.num_rounds || 2, 1), 3).toString();
      setNumRounds(rounds);
      setSeedRationale(data.rationale || null);
      toast({ title: "Setup ready", description: "Review and run — or edit anything first." });
      requestAnimationFrame(() => {
        stimulusRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    },
    onError: (e: any) => {
      const msg = e?.message || "Could not seed simulation";
      toast({ title: "Couldn't set up from idea", description: msg, variant: "destructive" });
    },
  });

  // The seed card shows only on the blank-screen state: no segments selected,
  // no stimulus typed, no result yet, and the workspace has at least one segment.
  const showIdeaSeed =
    segments.length > 0 &&
    selectedSegmentIds.length === 0 &&
    stimulus.trim().length === 0 &&
    !result;

  return (
    <div className="space-y-6 max-w-7xl">
      <ProductTour tourId="focus-group" steps={TOUR_FOCUS_GROUP} />
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(projectId ? `/projects/${projectId}` : "/segments")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 id="fg-header" className="text-2xl font-bold flex items-center gap-2">
            <Users2 className="h-6 w-6 text-primary" />
            {t("focusGroup.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("focusGroup.description")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Setup Panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Idea-seed: blank-screen fix. Shows only when nothing is filled in yet. */}
          {showIdeaSeed && (
            <Card className="border-primary/30 bg-primary/[0.02]">
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-start gap-3">
                  <Lightbulb className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <h2 className="text-sm font-semibold">Have an idea? We'll set everything up.</h2>
                    <p className="text-xs text-muted-foreground">
                      Describe what you want to test in one sentence — we'll pick the right segments, write a focused stimulus, and pre-fill the form. You can edit anything before running.
                    </p>
                  </div>
                </div>
                <Textarea
                  rows={2}
                  placeholder="e.g. We're launching a $15 monthly meal-kit subscription for busy young professionals — would they pay for it?"
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  className="resize-none"
                  maxLength={1000}
                />
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-muted-foreground">{idea.length}/1000</p>
                  <Button
                    size="sm"
                    onClick={() => seedMutation.mutate()}
                    disabled={idea.trim().length < 10 || seedMutation.isPending}
                  >
                    {seedMutation.isPending ? (
                      <>
                        <Sparkles className="h-4 w-4 mr-2 animate-pulse" />
                        Setting up...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Set up for me
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI rationale shown above the setup once seeded */}
          {seedRationale && !showIdeaSeed && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-primary/[0.03] border border-primary/15 text-xs text-muted-foreground">
              <Lightbulb className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
              <span>
                <span className="font-medium text-foreground">Why these picks: </span>
                {seedRationale}
              </span>
              <button
                onClick={() => setSeedRationale(null)}
                className="ml-auto text-muted-foreground hover:text-foreground"
                aria-label="Dismiss rationale"
              >
                ×
              </button>
            </div>
          )}

          <Card>
            <CardContent className="pt-5 space-y-4">
              {/* Segment Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t("focusGroup.selectParticipants")}</Label>
                <div id="fg-segment-select" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {segments.map((seg: any, i: number) => {
                    const demo = (seg.demographics || {}) as Record<string, any>;
                    const isSelected = selectedSegmentIds.includes(seg.id);
                    return (
                      <button
                        key={seg.id}
                        onClick={() => toggleSegment(seg.id)}
                        className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                          isSelected ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                        }`}
                      >
                        <Checkbox checked={isSelected} className="pointer-events-none" />
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${avatarColors[i % avatarColors.length]}`}>
                          {seg.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{seg.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {[demo.age_range, demo.gender, demo.location].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {segments.length === 0 && (
                  <p className="text-xs text-muted-foreground">No segments created yet. <button className="text-primary underline" onClick={() => navigate("/segments")}>Create one first</button>.</p>
                )}
              </div>

              {/* Rounds */}
              <div className="flex items-center gap-3">
                <Label className="text-sm font-medium whitespace-nowrap">Discussion Rounds</Label>
                <Select value={numRounds} onValueChange={setNumRounds}>
                  <SelectTrigger id="fg-rounds-select" className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 round</SelectItem>
                    <SelectItem value="2">2 rounds</SelectItem>
                    <SelectItem value="3">3 rounds</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Ramadan Context Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-purple-500/30 bg-purple-500/5">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    🌙 Ramadan Mode
                  </Label>
                  <p className="text-xs text-muted-foreground">Force twins into seasonal consumption and spiritual patterns.</p>
                </div>
                <div className="flex items-center gap-2">
                   <Label className="text-xs text-purple-600 font-medium">Activate</Label>
                   <Checkbox 
                     id="ramadan-mode" 
                     checked={ramadanMode}
                     onCheckedChange={(checked) => setRamadanMode(checked as boolean)}
                   />
                </div>
              </div>

              {/* Stimulus */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Discussion Topic / Stimulus</Label>
                <Textarea
                  id="fg-topic-input"
                  ref={stimulusRef}
                  rows={3}
                  placeholder="What topic should the focus group discuss?&#10;&#10;Example: 'We're considering launching a subscription meal-kit service targeting busy professionals. What do you think?'"
                  value={stimulus}
                  onChange={(e) => setStimulus(e.target.value)}
                  className="resize-none"
                />
              </div>

              <TierGate resource="aiAnalysis">
                <Button
                  id="fg-run-btn"
                  className="w-full"
                  size="lg"
                  onClick={() => runMutation.mutate()}
                  disabled={selectedSegmentIds.length < 2 || !stimulus.trim() || runMutation.isPending}
                >
                  {runMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Running focus group discussion...</>
                  ) : (
                    <><MessageCircle className="h-4 w-4 mr-2" />Start Focus Group ({selectedSegmentIds.length} participants)</>
                  )}
                </Button>
              </TierGate>
            </CardContent>
          </Card>

          {/* Export PDF + Results */}
          {result?.rounds?.length > 0 && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const participantNames = selectedSegmentIds.map(id => {
                    const seg = segments.find((s: any) => s.id === id);
                    return (seg as any)?.name || "Unknown";
                  });
                  generateFocusGroupPDF({
                    title: stimulus.slice(0, 80),
                    stimulus,
                    participantNames,
                    workspaceName: currentWorkspace?.name,
                    rounds: result.rounds.map((round: any[], idx: number) => ({
                      round: idx + 1,
                      responses: round.map((r: any) => ({
                        segment_name: r.segment_name || "Unknown",
                        response: r.response || "",
                        sentiment: r.sentiment || 0,
                        confidence: r.confidence || 0,
                      })),
                    })),
                    aggregate: result.aggregate || {},
                  });
                }}
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Export PDF
              </Button>
            </div>
          )}

          {/* Aha-loop: result-aware next-test suggestions */}
          {result?.simulation_id && (nextTestsQuery.isLoading || nextTestsQuery.data?.suggestions?.length) && (
            <Card className="border-primary/30 bg-primary/[0.02]">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-primary" />
                  What to test next
                  <Badge variant="outline" className="ml-auto text-[10px]">
                    Result-aware
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {nextTestsQuery.isLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="rounded-lg border border-dashed p-3 space-y-2">
                        <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
                        <div className="h-3 w-full rounded bg-muted animate-pulse" />
                        <div className="h-3 w-3/4 rounded bg-muted animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    {/* Aha-loop part 4: meta_recommendation banner (cross-cycle journey) */}
                    {nextTestsQuery.data?.meta_recommendation && (
                      <div className="mb-3 p-3 rounded-lg border border-primary/30 bg-primary/[0.04] flex items-start gap-2.5">
                        <Lightbulb className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-primary/80 mb-0.5">
                            Where you are
                          </p>
                          <p className="text-sm font-semibold leading-snug">
                            {nextTestsQuery.data.meta_recommendation}
                          </p>
                          {typeof nextTestsQuery.data.past_sim_count === "number" && nextTestsQuery.data.past_sim_count > 0 && (
                            <p className="text-[11px] mt-0.5 opacity-70">
                              Based on this run plus your last {nextTestsQuery.data.past_sim_count} simulation
                              {nextTestsQuery.data.past_sim_count === 1 ? "" : "s"}.
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Aha-loop part 4: explored-axes chips */}
                    {nextTestsQuery.data?.explored_axes && nextTestsQuery.data.explored_axes.length > 0 && (
                      <div className="mb-3 flex flex-wrap gap-1.5">
                        {nextTestsQuery.data.explored_axes.map((axis) => {
                          const meta = focusAreaMeta[axis.focus_area] ?? focusAreaMeta.positioning;
                          const Icon = meta.icon;
                          const tone =
                            axis.status === "covered"
                              ? "border-emerald-500/40 bg-emerald-500/[0.06] text-emerald-800 dark:text-emerald-300"
                              : axis.status === "open"
                                ? "border-amber-500/40 bg-amber-500/[0.06] text-amber-800 dark:text-amber-300"
                                : "border-border bg-muted/40 text-muted-foreground";
                          return (
                            <span
                              key={axis.focus_area}
                              title={axis.evidence}
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${tone}`}
                            >
                              <Icon className="h-3 w-3" />
                              {meta.label}
                              <span className="opacity-60">·</span>
                              <span className="lowercase">{axis.status}</span>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Aha-loop part 2: dominant objection headline above the cards */}
                    {nextTestsQuery.data?.dominant_objection && (() => {
                      const obj = nextTestsQuery.data!.dominant_objection!;
                      const positive = obj.affected_pct === 0;
                      const high = obj.affected_pct >= 50;
                      const tone = positive
                        ? "border-emerald-500/30 bg-emerald-500/[0.04] text-emerald-800 dark:text-emerald-300"
                        : high
                          ? "border-red-500/30 bg-red-500/[0.04] text-red-800 dark:text-red-300"
                          : "border-amber-500/30 bg-amber-500/[0.05] text-amber-800 dark:text-amber-300";
                      const Icon = positive ? ShieldCheck : AlertTriangle;
                      return (
                        <div className={`mb-3 p-3 rounded-lg border flex items-start gap-2.5 ${tone}`}>
                          <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold leading-snug">{obj.headline}</p>
                            {!positive && (
                              <p className="text-[11px] mt-0.5 opacity-80">
                                ~{obj.affected_pct}% of personas raised this. The suggestions below address it.
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {nextTestsQuery.data!.suggestions.map((s, i) => {
                        const meta = focusAreaMeta[s.focus_area] ?? focusAreaMeta.positioning;
                        const Icon = meta.icon;
                        return (
                          <button
                            key={i}
                            onClick={() => applySuggestion(s)}
                            className="group text-left rounded-lg border p-3 hover:border-primary hover:bg-primary/[0.04] transition-colors flex flex-col gap-2"
                          >
                            <div className="flex items-center gap-1.5">
                              <Icon className="h-3.5 w-3.5 text-primary" />
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {meta.label}
                              </span>
                              <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                            </div>
                            <p className="text-sm font-semibold leading-snug">{s.headline}</p>
                            <p className="text-xs text-muted-foreground leading-relaxed">{s.rationale}</p>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
                <p className="mt-3 text-[10px] text-muted-foreground">
                  Click a card to load the test into the topic field above — review, adjust, and run.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Market Projection — Option A: bake the Bass diffusion forecast
              directly into focus-group results. The math runs against signals
              the personas just produced (sentiment, consensus, confidence)
              rather than abstract inputs. Heuristic mapping today; can swap
              in a more rigorous AI-extraction edge function later. */}
          {result?.aggregate && (() => {
            const agg = (result.aggregate || {}) as Record<string, any>;
            const sentiment01 = (Math.max(-1, Math.min(1, Number(agg.avg_sentiment) || 0)) + 1) / 2;
            const consensus = Math.max(0, Math.min(1, Number(agg.consensus_score) || 0));
            const confidence = Math.max(0, Math.min(1, Number(agg.avg_confidence) || 0));
            // Heuristic: purchase probability blends positivity with how
            // confident the personas were; WOM blends positivity with how
            // much the group agreed. Both bounded to [0,1].
            const avgPurchaseProb = sentiment01 * confidence;
            const avgWOM = sentiment01 * consensus;
            const { p, q } = deriveBassParams(avgPurchaseProb, avgWOM);
            const months = Math.max(6, Math.min(parseInt(projectionMonths) || 24, 60));
            const marketSize = Math.max(1000, parseInt(projectionMarketSize) || 100000);
            const curve = bassDiffusion({ months, marketSize, p, q });
            const peak = findPeakMonth(curve);
            const saturationMonth = findSaturationMonth(curve, 0.9);
            const finalPenetration = curve.length > 0 ? curve[curve.length - 1].penetration : 0;
            return (
              <Card className="border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Market projection
                    <Badge variant="outline" className="ml-auto text-[10px]">
                      Derived from this group
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Adoption curve based on this group's reaction. The Bass-model
                    parameters are derived from the personas' aggregate sentiment,
                    confidence, and consensus — not from numbers you typed cold.
                    Adjust market size and time horizon to see how the curve shifts.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Market size (people)</Label>
                      <Input
                        type="number"
                        min={1000}
                        step={1000}
                        value={projectionMarketSize}
                        onChange={(e) => setProjectionMarketSize(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Time horizon (months, 6–60)</Label>
                      <Input
                        type="number"
                        min={6}
                        max={60}
                        value={projectionMonths}
                        onChange={(e) => setProjectionMonths(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>

                  <div className="rounded-md border p-3 bg-muted/30">
                    <BassDiffusionChart data={curve} />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="rounded-md border p-2.5">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Peak month</p>
                      <p className="text-base font-semibold mt-0.5">
                        {peak ? `M${peak.month}` : "—"}
                      </p>
                      {peak && (
                        <p className="text-[10px] text-muted-foreground">
                          {peak.new_adopters.toLocaleString()} new
                        </p>
                      )}
                    </div>
                    <div className="rounded-md border p-2.5">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">90% saturation</p>
                      <p className="text-base font-semibold mt-0.5">
                        {saturationMonth ? `M${saturationMonth}` : `>M${months}`}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {saturationMonth ? "reached" : "not within horizon"}
                      </p>
                    </div>
                    <div className="rounded-md border p-2.5">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Final penetration</p>
                      <p className="text-base font-semibold mt-0.5">
                        {Math.round(finalPenetration * 100)}%
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        at M{months}
                      </p>
                    </div>
                    <div className="rounded-md border p-2.5" title={`p=${p.toFixed(3)} (innovation), q=${q.toFixed(3)} (imitation)`}>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Bass params</p>
                      <p className="text-base font-semibold mt-0.5 font-mono">
                        p={p.toFixed(2)} q={q.toFixed(2)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        from this group
                      </p>
                    </div>
                  </div>

                  <p className="text-[10px] text-muted-foreground leading-relaxed border-t pt-3">
                    <strong>How it's derived:</strong> p (innovation) and q (imitation)
                    are computed from this focus group's aggregate signals —
                    sentiment ({((Number(agg.avg_sentiment) || 0).toFixed(2))}),
                    confidence ({Math.round(confidence * 100)}%),
                    consensus ({Math.round(consensus * 100)}%) —
                    via the Bass diffusion model. Treat as directional, not
                    precise. The math is bounded so extreme inputs don't produce
                    runaway curves.
                  </p>
                </CardContent>
              </Card>
            );
          })()}

          {/* Results: Round-by-round discussion */}
          {result?.rounds?.map((round: any[], roundIdx: number) => (
            <Card key={roundIdx} className="border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-primary" />
                  Round {roundIdx + 1} {roundIdx === 0 ? "— Initial Reactions" : "— Group Discussion"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {round.map((r: any, i: number) => (
                  <div key={i} className="flex gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-1 ${avatarColors[segments.findIndex((s: any) => s.id === r.segment_id) % avatarColors.length]}`}>
                      {r.segment_name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-sm font-semibold">{r.segment_name}</span>
                        
                        {/* Traffic Light Confidence UI */}
                        {(() => {
                           const conf = confidenceConfig(r.confidence || 0.5);
                           return (
                             <Badge variant="outline" className={`h-5 gap-1 text-[10px] px-1 border-transparent bg-muted/40 ${conf.text}`}>
                               <div className={`w-2 h-2 rounded-full ${conf.bg}`} />
                               {conf.label} ({Math.round((r.confidence || 0) * 100)}%)
                             </Badge>
                           );
                        })()}

                        <div className="ml-auto w-auto flex items-center gap-2">
                           <span className="text-xs">{emotionEmoji[r.emotional_reaction] || "😐"}</span>
                           <span className={`text-[10px] font-mono ${sentimentColor(r.sentiment || 0)}`}>
                             {r.sentiment > 0 ? "+" : ""}{(r.sentiment || 0).toFixed(2)}
                           </span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed bg-muted/40 rounded-lg px-3 py-2">
                        {r.response}
                      </p>
                      {r.key_themes?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {r.key_themes.map((t: string, j: number) => (
                            <Badge key={j} variant="outline" className="text-[9px]">{t}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Right: Aggregate Panel */}
        <div className="space-y-4">
          {result?.aggregate && (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Group Consensus
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Consensus Meter */}
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary">
                      {Math.round((result.aggregate.consensus_score || 0) * 100)}%
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase">Consensus Score</p>
                    <div className="w-full bg-muted rounded-full h-2 mt-2">
                      <div
                        className="bg-primary rounded-full h-2 transition-all"
                        style={{ width: `${(result.aggregate.consensus_score || 0) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Avg Sentiment */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-xs text-muted-foreground">Avg Sentiment</span>
                    <span className={`text-sm font-bold ${sentimentColor(result.aggregate.avg_sentiment)}`}>
                      {result.aggregate.avg_sentiment > 0 ? "+" : ""}{result.aggregate.avg_sentiment.toFixed(2)}
                    </span>
                  </div>

                  {/* Avg Confidence */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Avg Confidence</span>
                    <span className="text-sm font-bold text-blue-500">
                      {Math.round((result.aggregate.avg_confidence || 0) * 100)}%
                    </span>
                  </div>

                  {/* Participants */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Participants</span>
                    <span className="text-sm font-bold">{result.aggregate.participant_count}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Top Themes */}
              {result.aggregate.top_themes?.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Tag className="h-4 w-4" />
                      Key Themes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {result.aggregate.top_themes.map((t: any, i: number) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-xs capitalize">{t.theme}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-muted rounded-full h-1.5">
                              <div
                                className="bg-primary rounded-full h-1.5"
                                style={{ width: `${(t.count / result.aggregate.participant_count) * 100}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-muted-foreground w-4">{t.count}×</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Performance */}
              <Card>
                <CardContent className="pt-4 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>⏱ {result.duration_ms ? `${(result.duration_ms / 1000).toFixed(1)}s` : "—"}</span>
                  <span>⚡ {result.tokens_used || "—"} tokens</span>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FocusGroupStudio;
