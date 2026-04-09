import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { getSegments } from "@/services/segmentService";
import { runFocusGroup } from "@/services/simulationService";
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
  Info
} from "lucide-react";
import { TierGate } from "@/components/TierGate";
import { generateFocusGroupPDF } from "@/lib/pdfExport";
import { Download } from "lucide-react";

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

  const { data: segments = [] } = useQuery({
    queryKey: ["segment-profiles", workspaceId],
    queryFn: () => getSegments(workspaceId!),
    enabled: !!workspaceId,
  });

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
      toast({ title: "Focus group complete!", description: `${data.aggregate.participant_count} participants, ${data.rounds.length} rounds` });
    },
    onError: (e) => toast({ title: "Focus group failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(projectId ? `/projects/${projectId}` : "/segments")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users2 className="h-6 w-6 text-primary" />
            {t("focusGroup.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("focusGroup.description")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Setup Panel */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardContent className="pt-5 space-y-4">
              {/* Segment Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t("focusGroup.selectParticipants")}</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
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
                  rows={3}
                  placeholder="What topic should the focus group discuss?&#10;&#10;Example: 'We're considering launching a subscription meal-kit service targeting busy professionals. What do you think?'"
                  value={stimulus}
                  onChange={(e) => setStimulus(e.target.value)}
                  className="resize-none"
                />
              </div>

              <TierGate resource="aiAnalysis">
                <Button
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
