import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useToast } from "@/hooks/use-toast";
import { getSegments } from "@/services/segmentService";
import { getSimulationHistory, getSimulationById, runSimulation } from "@/services/simulationService";
import { useI18n } from "@/lib/i18n";
import { useSearchParams, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Send,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Clock,
  Zap,
  ArrowLeft,
  MessageSquare,
  TrendingUp,
  Tag,
} from "lucide-react";
import { TierGate } from "@/components/TierGate";
import { generateSimulationPDF } from "@/lib/pdfExport";
import { Download } from "lucide-react";
import { ProductTour } from "@/components/onboarding/ProductTour";
import { TOUR_SIMULATION } from "@/lib/tourDefinitions";

// Sentiment color helpers
const sentimentIcon = (s: number | null) => {
  if (!s && s !== 0) return <Minus className="h-4 w-4 text-muted-foreground" />;
  if (s > 0.2) return <ThumbsUp className="h-4 w-4 text-emerald-500" />;
  if (s < -0.2) return <ThumbsDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-amber-500" />;
};

const sentimentColor = (s: number | null) => {
  if (!s && s !== 0) return "text-muted-foreground";
  if (s > 0.2) return "text-emerald-500";
  if (s < -0.2) return "text-red-500";
  return "text-amber-500";
};

const emotionEmoji: Record<string, string> = {
  excited: "🤩",
  interested: "🤔",
  neutral: "😐",
  skeptical: "🧐",
  concerned: "😟",
  opposed: "😠",
};

const intentLabel: Record<string, { text: string; color: string }> = {
  definitely_yes: { text: "Definitely Yes", color: "bg-emerald-500/20 text-emerald-400" },
  probably_yes: { text: "Probably Yes", color: "bg-emerald-500/10 text-emerald-300" },
  neutral: { text: "Neutral", color: "bg-amber-500/20 text-amber-400" },
  probably_no: { text: "Probably No", color: "bg-red-500/10 text-red-300" },
  definitely_no: { text: "Definitely No", color: "bg-red-500/20 text-red-400" },
};

const SimulationStudio = () => {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { id: simId } = useParams();
  const workspaceId = currentWorkspace?.id;

  const preselectedSegment = searchParams.get("segment") || "";

  const [selectedSegmentId, setSelectedSegmentId] = useState(preselectedSegment);
  const [stimulus, setStimulus] = useState("");
  const [result, setResult] = useState<any>(null);

  // Load segments for dropdown
  const { data: segments = [] } = useQuery({
    queryKey: ["segment-profiles", workspaceId],
    queryFn: () => getSegments(workspaceId!),
    enabled: !!workspaceId,
  });

  // Load existing simulation if id in URL
  useEffect(() => {
    if (simId) {
      getSimulationById(simId).then((data) => {
        if (data) {
          setResult({
            simulation_id: data.id,
            segment: { id: (data.segment_ids as string[])?.[0] },
            response: (data.results as any)?.summary,
            sentiment: (data.results as any)?.sentiment,
            confidence: (data.results as any)?.confidence,
            key_themes: (data.results as any)?.key_themes,
            purchase_intent: (data.results as any)?.purchase_intent,
            emotional_reaction: (data.results as any)?.emotional_reaction,
            tokens_used: data.tokens_used,
            duration_ms: data.duration_ms,
          });
          setStimulus((data.stimulus as any)?.text || JSON.stringify(data.stimulus));
          setSelectedSegmentId((data.segment_ids as string[])?.[0] || "");
        }
      });
    }
  }, [simId]);

  // Load simulation history
  const { data: history = [] } = useQuery({
    queryKey: ["simulation-history", workspaceId],
    queryFn: () => getSimulationHistory(workspaceId!),
    enabled: !!workspaceId,
  });

  // Run simulation mutation
  const simulateMutation = useMutation({
    mutationFn: () =>
      runSimulation({
        segment_id: selectedSegmentId,
        stimulus,
        workspace_id: workspaceId!,
        title: stimulus.slice(0, 80),
      }),
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["simulation-history", workspaceId] });
      toast({ title: "Simulation complete", description: `Confidence: ${Math.round((data.confidence || 0) * 100)}%` });
    },
    onError: (e) => toast({ title: "Simulation failed", description: e.message, variant: "destructive" }),
  });

  const selectedSegment = segments.find((s: any) => s.id === selectedSegmentId) as any;

  return (
    <div className="space-y-6 max-w-7xl">
      <ProductTour tourId="simulation" steps={TOUR_SIMULATION} />
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/segments")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 id="simulation-header" className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            {t("simulation.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("simulation.description")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Input Panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Segment Selector */}
          <Card>
            <CardContent className="pt-5 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t("simulation.targetSegment")}</label>
                <Select value={selectedSegmentId} onValueChange={setSelectedSegmentId}>
                  <SelectTrigger id="segment-selector">
                    <SelectValue placeholder={t("simulation.selectSegment")} />
                  </SelectTrigger>
                  <SelectContent>
                    {segments.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedSegment && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(selectedSegment.demographics as any)?.age_range && <Badge variant="secondary" className="text-[10px]">{(selectedSegment.demographics as any).age_range}</Badge>}
                    {(selectedSegment.demographics as any)?.gender && <Badge variant="secondary" className="text-[10px]">{(selectedSegment.demographics as any).gender}</Badge>}
                    {(selectedSegment.demographics as any)?.location && <Badge variant="secondary" className="text-[10px]">{(selectedSegment.demographics as any).location}</Badge>}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t("simulation.stimulusLabel")}</label>
                <Textarea
                  id="stimulus-input"
                  rows={4}
                  placeholder={t("simulation.stimulusPlaceholder")}
                  value={stimulus}
                  onChange={(e) => setStimulus(e.target.value)}
                  className="resize-none"
                />
              </div>

              <TierGate resource="aiAnalysis">
                <Button
                  id="run-simulation-btn"
                  className="w-full"
                  size="lg"
                  onClick={() => simulateMutation.mutate()}
                  disabled={!selectedSegmentId || !stimulus.trim() || simulateMutation.isPending}
                >
                  {simulateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t("simulation.running")}
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      {t("simulation.runButton")}
                    </>
                  )}
                </Button>
              </TierGate>
            </CardContent>
          </Card>

          {/* Results Panel */}
          {result && (
            <Card className="border-primary/30">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  {t("simulation.consumerResponse")}
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const seg = segments.find((s: any) => s.id === selectedSegmentId);
                    generateSimulationPDF({
                      title: stimulus.slice(0, 80),
                      stimulus,
                      segmentName: (seg as any)?.name || "Unknown",
                      workspaceName: currentWorkspace?.name,
                      response: result.response || "",
                      sentiment: result.sentiment,
                      confidence: result.confidence,
                      purchaseIntent: result.purchase_intent,
                      emotionalReaction: result.emotional_reaction,
                      keyThemes: result.key_themes,
                      keyDecisionFactors: result.key_decision_factors,
                      tokensUsed: result.tokens_used,
                      durationMs: result.duration_ms,
                    });
                  }}
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Export PDF
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Main Response */}
                <div className="bg-muted/50 rounded-lg p-4 text-sm leading-relaxed">
                  {result.response}
                </div>

                {/* Metrics Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {/* Sentiment */}
                  <div className="bg-card border rounded-lg p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      {sentimentIcon(result.sentiment)}
                      <span className={`text-lg font-bold ${sentimentColor(result.sentiment)}`}>
                        {result.sentiment != null ? (result.sentiment > 0 ? "+" : "") + result.sentiment.toFixed(2) : "—"}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase">{t("simulation.sentiment")}</p>
                  </div>

                  {/* Confidence */}
                  <div className="bg-card border rounded-lg p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <TrendingUp className="h-4 w-4 text-blue-500" />
                      <span className="text-lg font-bold text-blue-500">
                        {result.confidence != null ? Math.round(result.confidence * 100) + "%" : "—"}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase">{t("simulation.confidence")}</p>
                  </div>

                  {/* Emotional Reaction */}
                  <div className="bg-card border rounded-lg p-3 text-center">
                    <div className="text-lg mb-1">
                      {emotionEmoji[result.emotional_reaction] || "😐"}
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase capitalize">
                      {result.emotional_reaction || "—"}
                    </p>
                  </div>

                  {/* Purchase Intent */}
                  <div className="bg-card border rounded-lg p-3 text-center">
                    <Badge className={`text-[10px] mb-1 ${intentLabel[result.purchase_intent]?.color || ""}`}>
                      {intentLabel[result.purchase_intent]?.text || result.purchase_intent || "—"}
                    </Badge>
                    <p className="text-[10px] text-muted-foreground uppercase">Intent</p>
                  </div>
                </div>

                {/* Key Themes */}
                {result.key_themes?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium flex items-center gap-1.5">
                      <Tag className="h-3 w-3" />
                      Key Decision Factors
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {result.key_themes.map((theme: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {theme}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Performance */}
                <div className="flex items-center gap-4 text-[10px] text-muted-foreground pt-2 border-t">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {result.duration_ms ? `${(result.duration_ms / 1000).toFixed(1)}s` : "—"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    {result.tokens_used || "—"} tokens
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: History Panel */}
        <div className="space-y-4">
          <Card id="recent-simulations">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Recent Simulations
              </CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No simulations yet. Run your first one!</p>
              ) : (
                <div className="space-y-2">
                  {history.map((sim: any) => {
                    const seg = segments.find((s: any) => (sim.segment_ids as string[])?.includes(s.id));
                    return (
                      <button
                        key={sim.id}
                        className="w-full text-left p-2.5 rounded-md hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
                        onClick={() => navigate(`/simulate/${sim.id}`)}
                      >
                        <p className="text-xs font-medium line-clamp-1">{sim.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {seg && <Badge variant="secondary" className="text-[9px]">{(seg as any).name}</Badge>}
                          <span className="text-[10px] text-muted-foreground">
                            {sim.created_at ? new Date(sim.created_at).toLocaleDateString() : ""}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SimulationStudio;
