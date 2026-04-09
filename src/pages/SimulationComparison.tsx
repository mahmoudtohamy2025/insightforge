import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useNavigate } from "react-router-dom";
import { getSimulationHistory, getSimulationsByIds } from "@/services/simulationService";
import { getSegments } from "@/services/segmentService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  GitCompareArrows,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Minus,
  TrendingUp,
  Tag,
  Loader2,
} from "lucide-react";

const sentimentColor = (s: number | null) => {
  if (!s && s !== 0) return "text-muted-foreground";
  if (s > 0.2) return "text-emerald-500";
  if (s < -0.2) return "text-red-500";
  return "text-amber-500";
};

const sentimentIcon = (s: number | null) => {
  if (!s && s !== 0) return <Minus className="h-4 w-4 text-muted-foreground" />;
  if (s > 0.2) return <ThumbsUp className="h-4 w-4 text-emerald-500" />;
  if (s < -0.2) return <ThumbsDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-amber-500" />;
};

const intentLabel: Record<string, string> = {
  definitely_yes: "Definitely Yes",
  probably_yes: "Probably Yes",
  neutral: "Neutral",
  probably_no: "Probably No",
  definitely_no: "Definitely No",
};

export default function SimulationComparison() {
  const { currentWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const workspaceId = currentWorkspace?.id;

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);

  // Fetch history for selection
  const { data: history = [] } = useQuery({
    queryKey: ["simulation-history", workspaceId],
    queryFn: () => getSimulationHistory(workspaceId!, 50),
    enabled: !!workspaceId,
  });

  // Fetch segments for names
  const { data: segments = [] } = useQuery({
    queryKey: ["segment-profiles", workspaceId],
    queryFn: () => getSegments(workspaceId!),
    enabled: !!workspaceId,
  });

  // Fetch full simulation data when comparing
  const { data: comparisonData, isLoading: loadingComparison } = useQuery({
    queryKey: ["simulation-compare", selectedIds],
    queryFn: () => getSimulationsByIds(selectedIds),
    enabled: comparing && selectedIds.length >= 2,
  });

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 4 ? [...prev, id] : prev
    );
    setComparing(false);
  };

  const getSegmentName = (segIds: string[] | null) => {
    if (!segIds?.length) return "Unknown";
    const seg = segments.find((s: any) => s.id === segIds[0]);
    return (seg as any)?.name || "Unknown";
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/segments")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GitCompareArrows className="h-6 w-6 text-primary" />
            Compare Simulations
          </h1>
          <p className="text-sm text-muted-foreground">
            Select 2-4 simulations to compare results side-by-side.
          </p>
        </div>
      </div>

      {!comparing ? (
        <>
          {/* Selection list */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Select Simulations ({selectedIds.length}/4)</CardTitle>
                <Button
                  size="sm"
                  disabled={selectedIds.length < 2}
                  onClick={() => setComparing(true)}
                >
                  <GitCompareArrows className="h-3.5 w-3.5 mr-1.5" />
                  Compare ({selectedIds.length})
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No simulations yet. Run simulations first to compare them.
                </p>
              ) : (
                <div className="space-y-1">
                  {history.map((sim: any) => (
                    <label
                      key={sim.id}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                        selectedIds.includes(sim.id) ? "bg-primary/5 border border-primary/20" : "border border-transparent"
                      }`}
                    >
                      <Checkbox
                        checked={selectedIds.includes(sim.id)}
                        onCheckedChange={() => toggleSelection(sim.id)}
                        disabled={!selectedIds.includes(sim.id) && selectedIds.length >= 4}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{sim.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="secondary" className="text-[9px]">
                            {getSegmentName(sim.segment_ids)}
                          </Badge>
                          <Badge variant="outline" className="text-[9px]">{sim.type || "solo"}</Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {sim.created_at ? new Date(sim.created_at).toLocaleDateString() : ""}
                          </span>
                        </div>
                      </div>
                      {sim.confidence_score != null && (
                        <span className="text-xs text-blue-500 font-medium">
                          {Math.round(sim.confidence_score * 100)}%
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          {/* Comparison View */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setComparing(false)}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to selection
            </Button>
          </div>

          {loadingComparison ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Loading comparison data...</span>
            </div>
          ) : comparisonData && comparisonData.length >= 2 ? (
            <div className="space-y-6">
              {/* Side-by-side cards */}
              <div className={`grid gap-4 ${comparisonData.length === 2 ? "grid-cols-2" : comparisonData.length === 3 ? "grid-cols-3" : "grid-cols-4"}`}>
                {comparisonData.map((sim: any) => {
                  const results = sim.results || {};
                  const segName = getSegmentName(sim.segment_ids);

                  return (
                    <Card key={sim.id} className="border-primary/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm line-clamp-2">{sim.title}</CardTitle>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge variant="secondary" className="text-[9px]">{segName}</Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {sim.created_at ? new Date(sim.created_at).toLocaleDateString() : ""}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Main response excerpt */}
                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4 bg-muted/50 rounded p-2.5">
                          {results.summary || results.response || "No response"}
                        </p>

                        {/* Metrics */}
                        <div className="space-y-3">
                          {/* Sentiment */}
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              {sentimentIcon(results.sentiment)} Sentiment
                            </span>
                            <span className={`text-sm font-bold ${sentimentColor(results.sentiment)}`}>
                              {results.sentiment != null ? (results.sentiment > 0 ? "+" : "") + results.sentiment.toFixed(2) : "—"}
                            </span>
                          </div>

                          {/* Confidence */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <TrendingUp className="h-3 w-3" /> Confidence
                              </span>
                              <span className="text-xs font-medium text-blue-500">
                                {results.confidence != null ? Math.round(results.confidence * 100) + "%" : "—"}
                              </span>
                            </div>
                            <Progress value={(results.confidence || 0) * 100} className="h-1.5" />
                          </div>

                          {/* Intent */}
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground">Intent</span>
                            <Badge variant="outline" className="text-[9px]">
                              {intentLabel[results.purchase_intent] || results.purchase_intent || "—"}
                            </Badge>
                          </div>

                          {/* Emotion */}
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground">Emotion</span>
                            <span className="text-xs capitalize">{results.emotional_reaction || "—"}</span>
                          </div>
                        </div>

                        {/* Key Themes */}
                        {results.key_themes?.length > 0 && (
                          <div>
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1.5">
                              <Tag className="h-2.5 w-2.5" /> Key Themes
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {results.key_themes.map((theme: string, i: number) => (
                                <Badge key={i} variant="outline" className="text-[9px]">
                                  {theme}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Performance */}
                        <div className="text-[10px] text-muted-foreground pt-2 border-t flex gap-3">
                          <span>{sim.tokens_used || 0} tokens</span>
                          <span>{sim.duration_ms ? `${(sim.duration_ms / 1000).toFixed(1)}s` : "—"}</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Summary comparison chart */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Metric Comparison
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Sentiment comparison bar */}
                    <div>
                      <p className="text-xs font-medium mb-2">Sentiment Score</p>
                      <div className="space-y-1.5">
                        {comparisonData.map((sim: any) => {
                          const sentiment = sim.results?.sentiment ?? 0;
                          const normalized = ((sentiment + 1) / 2) * 100; // -1..1 -> 0..100
                          return (
                            <div key={sim.id} className="flex items-center gap-2">
                              <span className="text-[10px] w-24 truncate text-muted-foreground">
                                {sim.title?.slice(0, 20)}
                              </span>
                              <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    sentiment > 0.2 ? "bg-emerald-500" : sentiment < -0.2 ? "bg-red-500" : "bg-amber-500"
                                  }`}
                                  style={{ width: `${normalized}%` }}
                                />
                              </div>
                              <span className={`text-xs font-mono w-12 text-right ${sentimentColor(sentiment)}`}>
                                {sentiment > 0 ? "+" : ""}{sentiment.toFixed(2)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Confidence comparison bar */}
                    <div>
                      <p className="text-xs font-medium mb-2">Confidence Level</p>
                      <div className="space-y-1.5">
                        {comparisonData.map((sim: any) => {
                          const conf = sim.results?.confidence ?? 0;
                          return (
                            <div key={sim.id} className="flex items-center gap-2">
                              <span className="text-[10px] w-24 truncate text-muted-foreground">
                                {sim.title?.slice(0, 20)}
                              </span>
                              <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-blue-500 transition-all"
                                  style={{ width: `${conf * 100}%` }}
                                />
                              </div>
                              <span className="text-xs font-mono w-12 text-right text-blue-500">
                                {Math.round(conf * 100)}%
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10">
              Unable to load comparison data. Please try again.
            </p>
          )}
        </>
      )}
    </div>
  );
}
