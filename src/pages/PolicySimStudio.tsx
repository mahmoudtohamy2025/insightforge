import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Loader2,
  Scale,
  Shield,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  Tag,
} from "lucide-react";

const IMPACT_AREAS = [
  { id: "health", label: "🏥 Health", color: "text-rose-500" },
  { id: "economy", label: "💰 Economy", color: "text-emerald-500" },
  { id: "environment", label: "🌱 Environment", color: "text-green-500" },
  { id: "social", label: "👥 Social", color: "text-blue-500" },
  { id: "education", label: "📚 Education", color: "text-purple-500" },
  { id: "technology", label: "💻 Technology", color: "text-cyan-500" },
  { id: "security", label: "🔒 Security", color: "text-amber-500" },
  { id: "infrastructure", label: "🏗️ Infrastructure", color: "text-orange-500" },
];

const stanceEmoji: Record<string, string> = {
  strongly_support: "👍👍", support: "👍", neutral: "😐",
  oppose: "👎", strongly_oppose: "👎👎",
};

const stanceColor: Record<string, string> = {
  strongly_support: "text-emerald-500", support: "text-emerald-400", neutral: "text-muted-foreground",
  oppose: "text-red-400", strongly_oppose: "text-red-500",
};

const impactLabel: Record<string, { text: string; color: string }> = {
  very_positive: { text: "Very Positive", color: "text-emerald-500" },
  positive: { text: "Positive", color: "text-emerald-400" },
  neutral: { text: "Neutral", color: "text-muted-foreground" },
  negative: { text: "Negative", color: "text-red-400" },
  very_negative: { text: "Very Negative", color: "text-red-500" },
};

// Support/Oppose gauge
const SupportGauge = ({ ratio }: { ratio: number }) => {
  // ratio: -1 (all oppose) to +1 (all support)
  const pct = ((ratio + 1) / 2) * 100; // 0..100
  const supportPct = Math.round(pct);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-red-500 font-medium">Oppose</span>
        <span className="text-emerald-500 font-medium">Support</span>
      </div>
      <div className="relative w-full h-4 bg-gradient-to-r from-red-500/20 via-muted to-emerald-500/20 rounded-full overflow-hidden">
        <div
          className="absolute top-0 h-full w-1 bg-foreground rounded-full transition-all"
          style={{ left: `${supportPct}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] font-bold">{supportPct > 50 ? `+${supportPct - 50}%` : `−${50 - supportPct}%`}</span>
        </div>
      </div>
    </div>
  );
};

const PolicySimStudio = () => {
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const workspaceId = currentWorkspace?.id;

  const [selectedSegmentIds, setSelectedSegmentIds] = useState<string[]>([]);
  const [policyDescription, setPolicyDescription] = useState("");
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [severity, setSeverity] = useState("moderate");
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

  const toggleSegment = (id: string) => setSelectedSegmentIds(prev =>
    prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
  );

  const toggleArea = (id: string) => setSelectedAreas(prev =>
    prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
  );

  const runMutation = useMutation({
    mutationFn: async () => {
      const response = await supabase.functions.invoke("simulate-policy", {
        body: {
          segment_ids: selectedSegmentIds,
          policy_description: policyDescription,
          impact_areas: selectedAreas,
          severity,
          workspace_id: workspaceId,
        },
      });
      if (response.error) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["simulation-history"] });
      const supportPct = Math.round(((data.aggregate.support_ratio + 1) / 2) * 100);
      toast({ title: "Policy simulation complete!", description: `Support: ${supportPct}%, Compliance: ${Math.round(data.aggregate.avg_compliance * 100)}%` });
    },
    onError: (e) => toast({ title: "Simulation failed", description: e.message, variant: "destructive" }),
  });

  const agg = result?.aggregate;

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/segments")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Scale className="h-6 w-6 text-primary" />
            Policy Impact Simulation
          </h1>
          <p className="text-sm text-muted-foreground">Simulate how different consumer segments would react to a proposed policy.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Inputs + Per-segment results */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardContent className="pt-5 space-y-4">
              {/* Segments */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Affected Segments</Label>
                <div className="flex flex-wrap gap-2">
                  {segments.map((seg: any) => (
                    <button key={seg.id} onClick={() => toggleSegment(seg.id)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition-all ${
                        selectedSegmentIds.includes(seg.id) ? "border-primary bg-primary/5 font-medium" : "border-border"
                      }`}
                    >
                      <Checkbox checked={selectedSegmentIds.includes(seg.id)} className="pointer-events-none h-3.5 w-3.5" />
                      {seg.name}
                    </button>
                  ))}
                  {segments.length === 0 && <p className="text-xs text-muted-foreground">No segments. <button className="text-primary underline" onClick={() => navigate("/segments")}>Create one first</button>.</p>}
                </div>
              </div>

              {/* Policy description */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Policy Description</Label>
                <Textarea rows={4} placeholder="Describe the proposed policy in detail...&#10;&#10;Example: 'Mandatory 4-day work week for all companies with 50+ employees, maintaining current salaries. Companies that don't comply will face a 5% payroll tax penalty.'" value={policyDescription} onChange={e => setPolicyDescription(e.target.value)} className="resize-none" />
              </div>

              {/* Impact Areas */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Impact Areas</Label>
                <div className="flex flex-wrap gap-2">
                  {IMPACT_AREAS.map(area => (
                    <button key={area.id} onClick={() => toggleArea(area.id)}
                      className={`px-3 py-1.5 rounded-full border text-xs transition-all ${
                        selectedAreas.includes(area.id) ? "border-primary bg-primary/5 font-medium" : "border-border"
                      }`}
                    >
                      {area.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Severity */}
              <div className="flex items-center gap-3">
                <Label className="text-sm font-medium whitespace-nowrap">Severity</Label>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button className="w-full" size="lg" onClick={() => runMutation.mutate()}
                disabled={selectedSegmentIds.length < 1 || !policyDescription.trim() || runMutation.isPending}
              >
                {runMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Evaluating policy impact...</>
                ) : (
                  <><Scale className="h-4 w-4 mr-2" />Run Policy Simulation</>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Per-Segment Stance Cards */}
          {result?.segment_evaluations?.map((ev: any, i: number) => (
            <Card key={i} className="border-l-4" style={{
              borderLeftColor: ev.stance?.includes("support") ? "hsl(var(--chart-2))" : ev.stance?.includes("oppose") ? "hsl(var(--destructive))" : "hsl(var(--muted))"
            }}>
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{ev.segment_name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{stanceEmoji[ev.stance]}</span>
                    <Badge variant="outline" className={`text-[10px] ${stanceColor[ev.stance]}`}>
                      {ev.stance?.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{ev.response}</p>
                <div className="flex flex-wrap gap-3 text-[10px]">
                  <span>Compliance: <strong>{Math.round((ev.compliance_likelihood || 0) * 100)}%</strong></span>
                  <span>Advocacy: <strong>{Math.round((ev.willingness_to_advocate || 0) * 100)}%</strong></span>
                  <span className={impactLabel[ev.personal_impact]?.color}>
                    Personal: {impactLabel[ev.personal_impact]?.text}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 pt-1">
                  {ev.key_benefits?.map((b: string, j: number) => <Badge key={`b${j}`} className="text-[8px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20">✓ {b}</Badge>)}
                  {ev.key_concerns?.map((c: string, j: number) => <Badge key={`c${j}`} className="text-[8px] bg-red-500/10 text-red-500 border-red-500/20">⚠ {c}</Badge>)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Right: Aggregate */}
        <div className="space-y-4">
          {agg && (
            <>
              {/* Support Gauge */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Scale className="h-4 w-4" />Public Sentiment</CardTitle></CardHeader>
                <CardContent>
                  <SupportGauge ratio={agg.support_ratio} />
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t">
                    {Object.entries(agg.stance_distribution || {}).map(([stance, count]) => (
                      <div key={stance} className="flex items-center justify-between text-[10px]">
                        <span className={stanceColor[stance]}>{stance.replace(/_/g, " ")}</span>
                        <span className="font-bold">{count as number}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Compliance */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4 text-blue-500" />Compliance</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-500">{Math.round((agg.avg_compliance || 0) * 100)}%</div>
                    <p className="text-[10px] text-muted-foreground uppercase">Avg Compliance Likelihood</p>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 mt-2">
                    <div className="bg-blue-500 rounded-full h-2 transition-all" style={{ width: `${(agg.avg_compliance || 0) * 100}%` }} />
                  </div>
                </CardContent>
              </Card>

              {/* Impact Heatmap */}
              {Object.keys(agg.impact_heatmap || {}).length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" />Impact by Area</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {Object.entries(agg.impact_heatmap).map(([area, score]) => {
                      const s = score as number;
                      const pct = ((s + 2) / 4) * 100; // -2..2 → 0..100
                      const areaInfo = IMPACT_AREAS.find(a => a.id === area);
                      return (
                        <div key={area} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span>{areaInfo?.label || area}</span>
                            <span className={s > 0 ? "text-emerald-500" : s < 0 ? "text-red-500" : "text-muted-foreground"}>
                              {s > 0 ? "+" : ""}{s.toFixed(1)}
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5">
                            <div
                              className={`rounded-full h-1.5 transition-all ${s > 0 ? "bg-emerald-500" : s < 0 ? "bg-red-500" : "bg-muted-foreground"}`}
                              style={{ width: `${Math.max(pct, 5)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              {/* Top Concerns / Benefits */}
              {(agg.top_concerns?.length > 0 || agg.top_benefits?.length > 0) && (
                <Card>
                  <CardContent className="pt-4 space-y-3">
                    {agg.top_benefits?.length > 0 && (
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1 mb-1"><ThumbsUp className="h-3 w-3 text-emerald-500" />Top Benefits</p>
                        {agg.top_benefits.map((b: any, i: number) => (
                          <div key={i} className="text-xs flex items-center justify-between"><span className="capitalize">{b.text}</span><span className="text-muted-foreground">{b.count}×</span></div>
                        ))}
                      </div>
                    )}
                    {agg.top_concerns?.length > 0 && (
                      <div className={agg.top_benefits?.length ? "pt-2 border-t" : ""}>
                        <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1 mb-1"><ThumbsDown className="h-3 w-3 text-red-500" />Top Concerns</p>
                        {agg.top_concerns.map((c: any, i: number) => (
                          <div key={i} className="text-xs flex items-center justify-between"><span className="capitalize">{c.text}</span><span className="text-muted-foreground">{c.count}×</span></div>
                        ))}
                      </div>
                    )}
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

export default PolicySimStudio;
