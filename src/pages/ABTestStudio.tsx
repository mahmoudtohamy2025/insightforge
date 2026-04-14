import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Sparkles,
  Loader2,
  ArrowLeft,
  FlaskConical,
  Tag,
  Trophy,
  Minus,
} from "lucide-react";
import { ProductTour } from "@/components/onboarding/ProductTour";
import { TOUR_AB_TEST } from "@/lib/tourDefinitions";

const sentimentColor = (s: number) => {
  if (s > 0.2) return "text-emerald-500";
  if (s < -0.2) return "text-red-500";
  return "text-amber-500";
};

const emotionEmoji: Record<string, string> = {
  excited: "🤩", interested: "🤔", neutral: "😐",
  skeptical: "🧐", concerned: "😟", opposed: "😠",
};

const ABTestStudio = () => {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const workspaceId = currentWorkspace?.id;

  const [selectedSegmentIds, setSelectedSegmentIds] = useState<string[]>([]);
  const [variantA, setVariantA] = useState("");
  const [variantB, setVariantB] = useState("");
  const [result, setResult] = useState<any>(null);

  const { data: segments = [] } = useQuery({
    queryKey: ["segment-profiles", workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("segment_profiles")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!workspaceId,
  });

  const toggleSegment = (id: string) => {
    setSelectedSegmentIds(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const runMutation = useMutation({
    mutationFn: async () => {
      const response = await supabase.functions.invoke("simulate-ab-test", {
        body: {
          segment_ids: selectedSegmentIds,
          variant_a: variantA,
          variant_b: variantB,
          workspace_id: workspaceId,
        },
      });
      if (response.error) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["simulation-history", workspaceId] });
      toast({ title: "A/B Test complete!", description: `Winner: Variant ${data.comparison.winner === "tie" ? "Tie" : data.comparison.winner}` });
    },
    onError: (e) => toast({ title: "Test failed", description: e.message, variant: "destructive" }),
  });

  const comp = result?.comparison;

  return (
    <div className="space-y-6 max-w-7xl">
      <ProductTour tourId="ab-test" steps={TOUR_AB_TEST} />
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/segments")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 id="ab-header" className="text-2xl font-bold flex items-center gap-2">
            <FlaskConical className="h-6 w-6 text-primary" />
            A/B Test Studio
          </h1>
          <p className="text-sm text-muted-foreground">Compare two product/campaign variants across consumer segments.</p>
        </div>
      </div>

      {/* Segment selector */}
      <Card>
        <CardContent className="pt-5">
          <Label className="text-sm font-medium mb-2 block">Test Audience (select 1+ segments)</Label>
          <div className="flex flex-wrap gap-2">
            {segments.map((seg: any) => {
              const isSelected = selectedSegmentIds.includes(seg.id);
              return (
                <button
                  key={seg.id}
                  onClick={() => toggleSegment(seg.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                    isSelected ? "border-primary bg-primary/5 font-medium" : "border-border hover:border-muted-foreground/30"
                  }`}
                >
                  <Checkbox checked={isSelected} className="pointer-events-none" />
                  {seg.name}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Variant Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-blue-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">A</Badge>
              Variant A
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              id="ab-variant-a"
              rows={4}
              placeholder="Describe your first variant...&#10;&#10;Example: 'Organic Snack Bar - $3.99, emphasis on health benefits'"
              value={variantA}
              onChange={(e) => setVariantA(e.target.value)}
              className="resize-none"
            />
          </CardContent>
        </Card>

        <Card className="border-purple-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">B</Badge>
              Variant B
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              id="ab-variant-b"
              rows={4}
              placeholder="Describe your second variant...&#10;&#10;Example: 'Organic Snack Bar - $2.49, emphasis on taste and convenience'"
              value={variantB}
              onChange={(e) => setVariantB(e.target.value)}
              className="resize-none"
            />
          </CardContent>
        </Card>
      </div>

      <Button
        id="ab-run-btn"
        className="w-full"
        size="lg"
        onClick={() => runMutation.mutate()}
        disabled={selectedSegmentIds.length < 1 || !variantA.trim() || !variantB.trim() || runMutation.isPending}
      >
        {runMutation.isPending ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Running A/B test across {selectedSegmentIds.length} segment(s)...</>
        ) : (
          <><FlaskConical className="h-4 w-4 mr-2" />Run A/B Test</>
        )}
      </Button>

      {/* Results */}
      {comp && (
        <div className="space-y-4">
          {/* Winner Banner */}
          <Card className={`border-2 ${comp.winner === "A" ? "border-blue-500/50 bg-blue-500/5" : comp.winner === "B" ? "border-purple-500/50 bg-purple-500/5" : "border-amber-500/50 bg-amber-500/5"}`}>
            <CardContent className="pt-5 flex items-center justify-center gap-3">
              <Trophy className={`h-6 w-6 ${comp.winner === "A" ? "text-blue-500" : comp.winner === "B" ? "text-purple-500" : "text-amber-500"}`} />
              <span className="text-xl font-bold">
                {comp.winner === "tie" ? "It's a Tie!" : `Variant ${comp.winner} Wins!`}
              </span>
              <span className="text-sm text-muted-foreground">
                Sentiment delta: {comp.sentiment_delta > 0 ? "+" : ""}{comp.sentiment_delta.toFixed(3)}
              </span>
            </CardContent>
          </Card>

          {/* Side-by-side Metrics */}
          <div className="grid grid-cols-2 gap-4">
            {/* Variant A */}
            <Card className="border-blue-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Badge className="bg-blue-500/20 text-blue-400">A</Badge>
                  Variant A Results
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Avg Sentiment</span>
                  <span className={`font-bold ${sentimentColor(comp.variant_a.avg_sentiment)}`}>
                    {comp.variant_a.avg_sentiment > 0 ? "+" : ""}{comp.variant_a.avg_sentiment.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Avg Confidence</span>
                  <span className="font-bold text-blue-500">{Math.round(comp.variant_a.avg_confidence * 100)}%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Purchase Intent</span>
                  <span className="font-bold">{comp.variant_a.avg_intent.toFixed(1)}/5</span>
                </div>

                {comp.variant_a.top_themes?.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-[10px] text-muted-foreground uppercase mb-1 flex items-center gap-1"><Tag className="h-3 w-3" />Themes</p>
                    <div className="flex flex-wrap gap-1">
                      {comp.variant_a.top_themes.map((t: any, i: number) => (
                        <Badge key={i} variant="outline" className="text-[9px]">{t.theme}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Per-segment responses */}
                <div className="pt-2 border-t space-y-2">
                  {comp.variant_a.responses?.map((r: any, i: number) => (
                    <div key={i} className="text-xs">
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className="font-semibold">{r.segment_name}</span>
                        <span>{emotionEmoji[r.emotional_reaction] || "😐"}</span>
                      </div>
                      <p className="text-muted-foreground bg-muted/40 rounded px-2 py-1 text-[11px]">{r.response}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Variant B */}
            <Card className="border-purple-500/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Badge className="bg-purple-500/20 text-purple-400">B</Badge>
                  Variant B Results
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Avg Sentiment</span>
                  <span className={`font-bold ${sentimentColor(comp.variant_b.avg_sentiment)}`}>
                    {comp.variant_b.avg_sentiment > 0 ? "+" : ""}{comp.variant_b.avg_sentiment.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Avg Confidence</span>
                  <span className="font-bold text-purple-500">{Math.round(comp.variant_b.avg_confidence * 100)}%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Purchase Intent</span>
                  <span className="font-bold">{comp.variant_b.avg_intent.toFixed(1)}/5</span>
                </div>

                {comp.variant_b.top_themes?.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-[10px] text-muted-foreground uppercase mb-1 flex items-center gap-1"><Tag className="h-3 w-3" />Themes</p>
                    <div className="flex flex-wrap gap-1">
                      {comp.variant_b.top_themes.map((t: any, i: number) => (
                        <Badge key={i} variant="outline" className="text-[9px]">{t.theme}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Per-segment responses */}
                <div className="pt-2 border-t space-y-2">
                  {comp.variant_b.responses?.map((r: any, i: number) => (
                    <div key={i} className="text-xs">
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className="font-semibold">{r.segment_name}</span>
                        <span>{emotionEmoji[r.emotional_reaction] || "😐"}</span>
                      </div>
                      <p className="text-muted-foreground bg-muted/40 rounded px-2 py-1 text-[11px]">{r.response}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance stats */}
          <div className="flex items-center justify-center gap-6 text-[10px] text-muted-foreground">
            <span>⏱ {result.duration_ms ? `${(result.duration_ms / 1000).toFixed(1)}s` : "—"}</span>
            <span>⚡ {result.tokens_used || "—"} tokens</span>
            <span>👥 {comp.participant_count} segments</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ABTestStudio;
