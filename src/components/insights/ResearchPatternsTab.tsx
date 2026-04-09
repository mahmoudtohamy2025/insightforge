import { useState, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, Quote, TrendingUp, TrendingDown, Minus, Shuffle, Lightbulb, Sparkles, Loader2, ArrowUpRight, ArrowDownRight, RotateCcw, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/hooks/useWorkspace";
import { toast } from "sonner";
import { PatternDetailDialog } from "./PatternDetailDialog";

interface InsightPattern {
  id: string;
  title: string;
  description: string | null;
  sentiment: string;
  session_count: number;
  theme_ids: string[];
  evidence_quotes: { quote: string; session_title: string }[];
  created_at: string;
  updated_at: string;
  synthesis_run_id: string | null;
}

interface SynthesisRun {
  id: string;
  workspace_id: string;
  project_id: string | null;
  patterns_count: number;
  sessions_analyzed: number;
  themes_processed: number;
  created_at: string;
}

interface Project {
  id: string;
  name: string;
}

const sentimentConfig = {
  positive: { icon: TrendingUp, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
  negative: { icon: TrendingDown, color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10" },
  neutral: { icon: Minus, color: "text-muted-foreground", bg: "bg-muted" },
  mixed: { icon: Shuffle, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
};

export function ResearchPatternsTab() {
  const { t } = useI18n();
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [sentimentFilter, setSentimentFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [selectedRunId, setSelectedRunId] = useState<string>("latest");
  const [selectedPattern, setSelectedPattern] = useState<InsightPattern | null>(null);

  // Fetch synthesis runs
  const { data: runs = [] } = useQuery({
    queryKey: ["synthesis-runs", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace) return [];
      const { data } = await supabase
        .from("synthesis_runs")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .order("created_at", { ascending: false });
      return (data || []) as SynthesisRun[];
    },
    enabled: !!currentWorkspace,
  });

  const { data: allPatterns = [], isLoading } = useQuery({
    queryKey: ["insight-patterns", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace) return [];
      const { data } = await supabase
        .from("insight_patterns")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .order("session_count", { ascending: false });
      return (data || []) as unknown as InsightPattern[];
    },
    enabled: !!currentWorkspace,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-filter", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace) return [];
      const { data } = await supabase
        .from("projects")
        .select("id, name")
        .eq("workspace_id", currentWorkspace.id)
        .order("name");
      return (data || []) as Project[];
    },
    enabled: !!currentWorkspace,
  });

  // Fetch pattern snapshots for trend detection
  const { data: snapshots = [] } = useQuery({
    queryKey: ["pattern-snapshots", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace) return [];
      const { data } = await supabase
        .from("pattern_snapshots")
        .select("*")
        .eq("workspace_id", currentWorkspace.id)
        .order("snapshot_date", { ascending: false });
      return data || [];
    },
    enabled: !!currentWorkspace,
  });

  const { data: sessionCount = 0 } = useQuery({
    queryKey: ["session-theme-count", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace) return 0;
      const { data } = await supabase
        .from("session_themes")
        .select("session_id")
        .eq("workspace_id", currentWorkspace.id);
      if (!data) return 0;
      return new Set(data.map((d) => d.session_id)).size;
    },
    enabled: !!currentWorkspace,
  });

  // Determine which run is selected
  const latestRun = runs.length > 0 ? runs[0] : null;
  const activeRunId = selectedRunId === "latest" ? latestRun?.id : selectedRunId;
  const previousRun = useMemo(() => {
    if (!activeRunId || runs.length < 2) return null;
    const idx = runs.findIndex((r) => r.id === activeRunId);
    return idx >= 0 && idx < runs.length - 1 ? runs[idx + 1] : null;
  }, [activeRunId, runs]);

  // Filter patterns by selected run
  const runPatterns = useMemo(() => {
    if (!activeRunId) return allPatterns.filter((p) => !p.synthesis_run_id); // legacy patterns
    return allPatterns.filter((p) => p.synthesis_run_id === activeRunId);
  }, [allPatterns, activeRunId]);

  // Previous run patterns for trend comparison
  const previousPatterns = useMemo(() => {
    if (!previousRun) return [];
    return allPatterns.filter((p) => p.synthesis_run_id === previousRun.id);
  }, [allPatterns, previousRun]);

  // Compute trend using snapshots: compare latest two snapshot dates for each pattern
  const getTrend = (pattern: InsightPattern): { type: "new" | "recurring" | "gone" | "trending"; delta: number } => {
    const patternSnapshots = snapshots.filter((s: any) => s.pattern_id === pattern.id);
    if (patternSnapshots.length < 2) {
      // Check previous run patterns as fallback
      if (!previousRun || previousPatterns.length === 0) return { type: "new", delta: 0 };
      const match = previousPatterns.find((pp) => pp.title.toLowerCase() === pattern.title.toLowerCase());
      if (!match) return { type: "new", delta: 0 };
      return { type: "recurring", delta: pattern.session_count - match.session_count };
    }
    // Compare two most recent snapshots
    const latest = patternSnapshots[0];
    const previous = patternSnapshots[1];
    const delta = latest.session_count - previous.session_count;
    const pctChange = previous.session_count > 0 ? (delta / previous.session_count) * 100 : 0;
    if (pctChange >= 30) return { type: "trending", delta };
    return { type: "recurring", delta };
  };

  const handleSynthesize = async () => {
    if (!currentWorkspace) return;
    setIsSynthesizing(true);
    try {
      const { data, error } = await supabase.functions.invoke("synthesize-insights", {
        body: {
          workspace_id: currentWorkspace.id,
          project_id: projectFilter !== "all" ? projectFilter : undefined,
        },
      });

      if (error) {
        toast.error(error.message || "Failed to synthesize insights");
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      toast.success(`Found ${data.patterns_count} patterns across ${data.sessions_analyzed} sessions`);
      setSelectedRunId("latest");
      queryClient.invalidateQueries({ queryKey: ["insight-patterns"] });
      queryClient.invalidateQueries({ queryKey: ["synthesis-runs"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to synthesize insights");
    } finally {
      setIsSynthesizing(false);
    }
  };

  const filteredPatterns = runPatterns.filter((p) => {
    if (sentimentFilter !== "all" && p.sentiment !== sentimentFilter) return false;
    if (dateFilter !== "all") {
      const now = new Date();
      const created = new Date(p.created_at);
      const days = dateFilter === "7d" ? 7 : 30;
      if (now.getTime() - created.getTime() > days * 86400000) return false;
    }
    return true;
  });

  const activeRun = runs.find((r) => r.id === activeRunId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const hasEnoughData = sessionCount >= 2;

  return (
    <div className="space-y-4">
      {/* Controls bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Button
          onClick={handleSynthesize}
          disabled={isSynthesizing || !hasEnoughData}
          size="sm"
        >
          {isSynthesizing ? (
            <Loader2 className="h-4 w-4 me-2 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 me-2" />
          )}
          {isSynthesizing ? t("insights.synthesizing") : t("insights.synthesize")}
        </Button>

        <div className="flex gap-2 flex-1 flex-wrap">
          {runs.length > 1 && (
            <Select value={selectedRunId} onValueChange={setSelectedRunId}>
              <SelectTrigger className="w-[200px] h-9 text-sm">
                <SelectValue placeholder={t("insights.latestRun")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="latest">{t("insights.latestRun")}</SelectItem>
                {runs.map((r, i) => (
                  <SelectItem key={r.id} value={r.id}>
                    {new Date(r.created_at).toLocaleDateString()} ({r.patterns_count} {t("insights.patternsLabel")})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-[180px] h-9 text-sm">
              <SelectValue placeholder={t("insights.allProjects")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("insights.allProjects")}</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <SelectValue placeholder={t("insights.allSentiments")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("insights.allSentiments")}</SelectItem>
              <SelectItem value="positive">Positive</SelectItem>
              <SelectItem value="negative">Negative</SelectItem>
              <SelectItem value="neutral">Neutral</SelectItem>
              <SelectItem value="mixed">Mixed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[140px] h-9 text-sm">
              <SelectValue placeholder={t("insights.dateAll")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("insights.dateAll")}</SelectItem>
              <SelectItem value="7d">{t("insights.date7d")}</SelectItem>
              <SelectItem value="30d">{t("insights.date30d")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {activeRun && (
          <p className="text-[11px] text-muted-foreground whitespace-nowrap">
            {t("insights.lastSynthesized")}: {new Date(activeRun.created_at).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Content */}
      {!hasEnoughData ? (
        <Card className="py-8">
          <CardContent className="flex flex-col items-center text-center">
            <Lightbulb className="h-8 w-8 text-muted-foreground mb-3" />
            <h3 className="text-sm font-semibold mb-1">{t("insights.needMoreThemes")}</h3>
            <p className="text-xs text-muted-foreground max-w-sm">{t("insights.needMoreThemesDesc")}</p>
          </CardContent>
        </Card>
      ) : filteredPatterns.length === 0 ? (
        <Card className="py-8">
          <CardContent className="flex flex-col items-center text-center">
            <Sparkles className="h-8 w-8 text-muted-foreground mb-3" />
            <h3 className="text-sm font-semibold mb-1">{t("insights.noPatterns")}</h3>
            <p className="text-xs text-muted-foreground max-w-sm">{t("insights.noPatternsDesc")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredPatterns.map((pattern) => (
            <PatternCard
              key={pattern.id}
              pattern={pattern}
              totalSessions={sessionCount}
              trend={getTrend(pattern)}
              onClick={() => setSelectedPattern(pattern)}
            />
          ))}
        </div>
      )}

      <PatternDetailDialog
        pattern={selectedPattern}
        open={!!selectedPattern}
        onOpenChange={(open) => { if (!open) setSelectedPattern(null); }}
        totalSessions={sessionCount}
      />
    </div>
  );
}

function TrendBadge({ trend }: { trend: { type: "new" | "recurring" | "gone" | "trending"; delta: number } }) {
  const { t } = useI18n();
  if (trend.type === "trending") {
    return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <TrendingUp className="h-2.5 w-2.5 me-0.5" />
        {t("insights.trendTrending")}
      </Badge>
    );
  }
  if (trend.type === "new") {
    return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-0 bg-primary/10 text-primary">
        <Zap className="h-2.5 w-2.5 me-0.5" />
        {t("insights.trendNew")}
      </Badge>
    );
  }
  if (trend.type === "recurring") {
    const deltaText = trend.delta > 0 ? `+${trend.delta}` : trend.delta < 0 ? `${trend.delta}` : "";
    return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-0 bg-muted text-muted-foreground">
        <RotateCcw className="h-2.5 w-2.5 me-0.5" />
        {t("insights.trendRecurring")}
        {deltaText && (
          <span className={`ms-1 ${trend.delta > 0 ? "text-emerald-600" : "text-red-600"}`}>
            {trend.delta > 0 ? <ArrowUpRight className="h-2.5 w-2.5 inline" /> : <ArrowDownRight className="h-2.5 w-2.5 inline" />}
            {deltaText}
          </span>
        )}
      </Badge>
    );
  }
  return null;
}

function PatternCard({ pattern, totalSessions, trend, onClick }: { pattern: InsightPattern; totalSessions: number; trend: { type: "new" | "recurring" | "gone" | "trending"; delta: number }; onClick: () => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const sc = sentimentConfig[pattern.sentiment as keyof typeof sentimentConfig] || sentimentConfig.neutral;
  const SentimentIcon = sc.icon;
  const quotes = pattern.evidence_quotes || [];
  const previewQuotes = quotes.slice(0, 2);
  const hasMore = quotes.length > 2;

  return (
    <Card className="overflow-hidden cursor-pointer hover:border-primary/40 transition-colors" onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium text-sm">{pattern.title}</h3>
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border-0 ${sc.bg} ${sc.color}`}>
              <SentimentIcon className="h-2.5 w-2.5 me-0.5" />
              {pattern.sentiment}
            </Badge>
            <TrendBadge trend={trend} />
          </div>
          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
            {t("insights.foundInSessions")
              .replace("{count}", String(pattern.session_count))
              .replace("{total}", String(totalSessions))}
          </span>
        </div>

        {pattern.description && (
          <p className="text-xs text-muted-foreground mb-3">{pattern.description}</p>
        )}

        {previewQuotes.length > 0 && (
          <div className="space-y-1.5">
            {previewQuotes.map((q, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <Quote className="h-3 w-3 text-primary/60 shrink-0 mt-0.5" />
                <span className="text-muted-foreground italic line-clamp-1">
                  "{q.quote}" <span className="not-italic text-[10px] opacity-70">— {q.session_title}</span>
                </span>
              </div>
            ))}
          </div>
        )}

        {hasMore && (
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] mt-2">
                <ChevronDown className={`h-3 w-3 me-1 transition-transform ${open ? "rotate-180" : ""}`} />
                {open
                  ? t("insights.hideQuotes")
                  : t("insights.showAllQuotes").replace("{count}", String(quotes.length))}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-1.5 mt-2 pt-2 border-t">
                {quotes.slice(2).map((q, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <Quote className="h-3 w-3 text-primary/60 shrink-0 mt-0.5" />
                    <span className="text-muted-foreground italic">
                      "{q.quote}" <span className="not-italic text-[10px] opacity-70">— {q.session_title}</span>
                    </span>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
