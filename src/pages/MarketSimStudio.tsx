import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/hooks/useWorkspace";
import { getSegments } from "@/services/segmentService";
import { runMarketSimulation } from "@/services/simulationService";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  ArrowLeft,
  Loader2,
  TrendingUp,
  DollarSign,
  Users2,
  Activity,
  Zap,
  Target,
  BarChart3,
} from "lucide-react";
import { ProductTour } from "@/components/onboarding/ProductTour";
import { TOUR_MARKET_SIM } from "@/lib/tourDefinitions";

const sentimentColor = (s: number) => {
  if (s > 0.5) return "text-emerald-500";
  if (s < 0.3) return "text-red-500";
  return "text-amber-500";
};

const timingLabel: Record<string, string> = {
  innovator: "🚀 Innovator",
  early_adopter: "⚡ Early Adopter",
  early_majority: "📈 Early Majority",
  late_majority: "📊 Late Majority",
  laggard: "🐢 Laggard",
};

const priceSensLabel: Record<string, string> = {
  very_low: "💎 Very Low", low: "🟢 Low", moderate: "🟡 Moderate",
  high: "🟠 High", very_high: "🔴 Very High",
};

// SVG adoption curve chart — extracted to reusable component
import { BassDiffusionChart as AdoptionChart } from "@/components/charts/BassDiffusionChart";

const MarketSimStudio = () => {
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const workspaceId = currentWorkspace?.id;

  const [selectedSegmentIds, setSelectedSegmentIds] = useState<string[]>([]);
  const [product, setProduct] = useState("");
  const [pricing, setPricing] = useState("");
  const [marketSize, setMarketSize] = useState([100000]);
  const [timeHorizon, setTimeHorizon] = useState([24]);
  const [result, setResult] = useState<any>(null);

  const { data: segments = [] } = useQuery({
    queryKey: ["segment-profiles", workspaceId],
    queryFn: () => getSegments(workspaceId!),
    enabled: !!workspaceId,
  });

  const toggleSegment = (id: string) => setSelectedSegmentIds(prev =>
    prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
  );

  const runMutation = useMutation({
    mutationFn: () =>
      runMarketSimulation({
        segment_ids: selectedSegmentIds,
        product: {
          description: product,
          pricing,
          market_size: marketSize[0],
          time_horizon_months: timeHorizon[0],
        },
        workspace_id: workspaceId!,
      }),
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["simulation-history"] });
      toast({ title: "Market simulation complete!", description: `${data.aggregate?.total_adopters_projected?.toLocaleString()} projected adopters` });
    },
    onError: (e) => toast({ title: "Simulation failed", description: e.message, variant: "destructive" }),
  });

  const agg = result?.aggregate;

  return (
    <div className="space-y-6 max-w-7xl">
      <ProductTour tourId="market-sim" steps={TOUR_MARKET_SIM} />
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/segments")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 id="market-header" className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            Market Simulation
          </h1>
          <p className="text-sm text-muted-foreground">Model adoption curves, network effects, and revenue projections.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Inputs */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardContent className="pt-5 space-y-4">
              {/* Segments */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Target Segments</Label>
                <div className="flex flex-wrap gap-2">
                  {segments.map((seg: any) => (
                    <button key={seg.id} onClick={() => toggleSegment(seg.id)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-all ${
                        selectedSegmentIds.includes(seg.id) ? "border-primary bg-primary/5 font-medium" : "border-border hover:border-muted-foreground/30"
                      }`}
                    >
                      <Checkbox checked={selectedSegmentIds.includes(seg.id)} className="pointer-events-none h-3.5 w-3.5" />
                      {seg.name}
                    </button>
                  ))}
                  {segments.length === 0 && <p className="text-xs text-muted-foreground">No segments. <button className="text-primary underline" onClick={() => navigate("/segments")}>Create one first</button>.</p>}
                </div>
              </div>

              {/* Product */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Product / Service Description</Label>
                <Textarea id="market-product-input" rows={3} placeholder="Describe the product or service you want to simulate...&#10;&#10;Example: 'A premium organic meal-kit delivery service with locally sourced ingredients, weekly subscription, targeting health-conscious urban professionals'" value={product} onChange={e => setProduct(e.target.value)} className="resize-none" />
              </div>

              {/* Pricing + Market Size */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" />Price Point</Label>
                  <Input type="number" placeholder="29.99" value={pricing} onChange={e => setPricing(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-1"><Users2 className="h-3.5 w-3.5" />Market Size</Label>
                  <div className="flex items-center gap-2">
                    <Slider min={1000} max={10000000} step={1000} value={marketSize} onValueChange={setMarketSize} className="flex-1" />
                    <span className="text-xs font-mono w-16 text-right">{marketSize[0] >= 1000000 ? `${(marketSize[0]/1000000).toFixed(1)}M` : `${(marketSize[0]/1000).toFixed(0)}K`}</span>
                  </div>
                </div>
              </div>

              {/* Time Horizon */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Time Horizon</Label>
                <div className="flex items-center gap-2">
                  <Slider min={6} max={60} step={3} value={timeHorizon} onValueChange={setTimeHorizon} className="flex-1" />
                  <span className="text-xs font-mono w-20 text-right">{timeHorizon[0]} months</span>
                </div>
              </div>

              <Button id="market-run-btn" className="w-full" size="lg" onClick={() => runMutation.mutate()}
                disabled={selectedSegmentIds.length < 1 || !product.trim() || runMutation.isPending}
              >
                {runMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Running market simulation...</>
                ) : (
                  <><TrendingUp className="h-4 w-4 mr-2" />Run Market Simulation</>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Adoption Curve Chart */}
          {result?.adoption_curve && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Adoption Curve (Bass Diffusion Model)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AdoptionChart data={result.adoption_curve} />
              </CardContent>
            </Card>
          )}

          {/* Per-Segment Evaluations */}
          {result?.segment_evaluations?.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Segment Evaluations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.segment_evaluations.map((ev: any, i: number) => (
                  <div key={i} className="p-3 rounded-lg border bg-muted/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{ev.segment_name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[9px]">{timingLabel[ev.adoption_timing] || ev.adoption_timing}</Badge>
                        <Badge variant="outline" className="text-[9px]">{priceSensLabel[ev.price_sensitivity] || ev.price_sensitivity}</Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{ev.response}</p>
                    <div className="flex items-center gap-4 text-[10px]">
                      <span className={sentimentColor(ev.purchase_probability)}>
                        Purchase: {Math.round((ev.purchase_probability || 0) * 100)}%
                      </span>
                      <span className="text-blue-500">
                        WOM: {Math.round((ev.word_of_mouth_likelihood || 0) * 100)}%
                      </span>
                    </div>
                    {ev.key_drivers?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {ev.key_drivers.map((d: string, j: number) => <Badge key={j} className="text-[8px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20">✓ {d}</Badge>)}
                        {ev.key_barriers?.map((b: string, j: number) => <Badge key={j} className="text-[8px] bg-red-500/10 text-red-500 border-red-500/20">✗ {b}</Badge>)}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Aggregate Metrics */}
        <div className="space-y-4">
          {agg && (
            <>
              {/* Key Metrics */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4" />Key Metrics</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-center pb-2">
                    <div className="text-3xl font-bold text-primary">{agg.total_adopters_projected?.toLocaleString()}</div>
                    <p className="text-[10px] text-muted-foreground uppercase">Projected Adopters</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {Math.round((agg.final_penetration || 0) * 100)}% market penetration
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-xs border-t pt-2">
                    <span className="text-muted-foreground">Peak Month</span>
                    <span className="font-bold">Month {agg.peak_adoption_month}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Peak New Adopters</span>
                    <span className="font-bold">{agg.peak_new_adopters?.toLocaleString()}/mo</span>
                  </div>
                  {agg.saturation_month && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">90% Saturation</span>
                      <span className="font-bold">Month {agg.saturation_month}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Avg Purchase Prob.</span>
                    <span className={`font-bold ${sentimentColor(agg.avg_purchase_probability)}`}>
                      {Math.round((agg.avg_purchase_probability || 0) * 100)}%
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Network Effects */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Zap className="h-4 w-4 text-amber-500" />Network Effects</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-amber-500">{(agg.network_multiplier || 0).toFixed(1)}×</div>
                    <p className="text-[10px] text-muted-foreground uppercase">Network Multiplier</p>
                  </div>
                  <div className="flex items-center justify-between text-xs border-t pt-2">
                    <span className="text-muted-foreground">Innovation (p)</span>
                    <span className="font-mono text-[10px]">{agg.bass_parameters?.p?.toFixed(4)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Imitation (q)</span>
                    <span className="font-mono text-[10px]">{agg.bass_parameters?.q?.toFixed(4)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Avg WOM</span>
                    <span className="font-bold text-blue-500">{Math.round((agg.avg_word_of_mouth || 0) * 100)}%</span>
                  </div>
                </CardContent>
              </Card>

              {/* Revenue (if pricing provided) */}
              {result?.revenue_projections && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4 text-emerald-500" />Revenue</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-emerald-500">
                        ${agg.total_revenue_projected >= 1000000
                          ? `${(agg.total_revenue_projected / 1000000).toFixed(1)}M`
                          : agg.total_revenue_projected >= 1000
                          ? `${(agg.total_revenue_projected / 1000).toFixed(0)}K`
                          : agg.total_revenue_projected?.toLocaleString()}
                      </div>
                      <p className="text-[10px] text-muted-foreground uppercase">Projected Revenue ({timeHorizon[0]}mo)</p>
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

export default MarketSimStudio;
