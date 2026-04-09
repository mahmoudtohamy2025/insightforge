import { useEffect, useState, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Copy, Inbox, BarChart3, Lightbulb } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { ResearchPatternsTab } from "@/components/insights/ResearchPatternsTab";
import { exportPatternsToCSV, exportSurveyBreakdownToCSV, patternsToMarkdown } from "@/lib/exportUtils";
import { toast } from "@/hooks/use-toast";

interface SurveyInsight {
  id: string;
  title: string;
  response_count: number;
  target_responses: number;
  status: string;
  project_id: string | null;
}

interface QuestionBreakdown {
  question_text: string;
  question_type: string;
  options: string[] | null;
  answers: string[];
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--muted-foreground))",
  "hsl(var(--destructive))",
  "hsl(var(--secondary))",
];

const Insights = () => {
  const { t } = useI18n();
  const { currentWorkspace } = useWorkspace();
  const [surveys, setSurveys] = useState<SurveyInsight[]>([]);
  const [selectedSurvey, setSelectedSurvey] = useState<string | null>(null);
  const [questionBreakdowns, setQuestionBreakdowns] = useState<QuestionBreakdown[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingBreakdown, setIsLoadingBreakdown] = useState(false);
  const [surveyProjectFilter, setSurveyProjectFilter] = useState<string>("all");

  // Fetch projects for survey filter
  const { data: projects = [] } = useQuery({
    queryKey: ["projects-filter-insights", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace) return [];
      const { data } = await supabase
        .from("projects")
        .select("id, name")
        .eq("workspace_id", currentWorkspace.id)
        .order("name");
      return data || [];
    },
    enabled: !!currentWorkspace,
  });

  // Fetch pattern count for stats
  const { data: patternCount = 0 } = useQuery({
    queryKey: ["insight-patterns-count", currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace) return 0;
      const { data } = await supabase
        .from("insight_patterns")
        .select("id")
        .eq("workspace_id", currentWorkspace.id);
      return data?.length || 0;
    },
    enabled: !!currentWorkspace,
  });

  // Fetch sessions analyzed count
  const { data: sessionsAnalyzed = 0 } = useQuery({
    queryKey: ["sessions-analyzed-count", currentWorkspace?.id],
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

  // Fetch surveys with responses
  useEffect(() => {
    if (!currentWorkspace) return;
    const fetchSurveys = async () => {
      setIsLoading(true);
      const { data } = await supabase
        .from("surveys")
        .select("id, title, response_count, target_responses, status, project_id")
        .eq("workspace_id", currentWorkspace.id)
        .gt("response_count", 0)
        .order("response_count", { ascending: false });

      setSurveys(data || []);
      if (data && data.length > 0) {
        setSelectedSurvey(data[0].id);
      }
      setIsLoading(false);
    };
    fetchSurveys();
  }, [currentWorkspace]);

  // Fetch question breakdowns for selected survey
  useEffect(() => {
    if (!selectedSurvey || !currentWorkspace) return;
    const fetchBreakdown = async () => {
      setIsLoadingBreakdown(true);
      const { data: questions } = await supabase
        .from("survey_questions")
        .select("id, question_text, question_type, options")
        .eq("survey_id", selectedSurvey)
        .eq("workspace_id", currentWorkspace.id)
        .order("sort_order");

      const { data: responses } = await supabase
        .from("survey_responses")
        .select("answers")
        .eq("survey_id", selectedSurvey)
        .eq("workspace_id", currentWorkspace.id);

      if (questions && responses) {
        const breakdowns: QuestionBreakdown[] = questions.map((q) => {
          const answers = responses
            .map((r) => {
              const answersObj = r.answers as Record<string, any>;
              return answersObj?.[q.id] as string | undefined;
            })
            .filter(Boolean) as string[];
          return {
            question_text: q.question_text,
            question_type: q.question_type,
            options: q.options as string[] | null,
            answers,
          };
        });
        setQuestionBreakdowns(breakdowns);
      }
      setIsLoadingBreakdown(false);
    };
    fetchBreakdown();
  }, [selectedSurvey, currentWorkspace]);

  const getAnswerDistribution = (breakdown: QuestionBreakdown) => {
    const counts: Record<string, number> = {};
    breakdown.answers.forEach((a) => {
      counts[a] = (counts[a] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  };

  const filteredSurveys = surveyProjectFilter === "all"
    ? surveys
    : surveys.filter((s) => s.project_id === surveyProjectFilter);

  // Auto-select first filtered survey
  useEffect(() => {
    if (filteredSurveys.length > 0 && !filteredSurveys.find((s) => s.id === selectedSurvey)) {
      setSelectedSurvey(filteredSurveys[0].id);
    }
  }, [filteredSurveys, selectedSurvey]);

  const totalResponses = surveys.reduce((sum, s) => sum + s.response_count, 0);

  // Export handlers
  const handleExportCSV = async () => {
    if (!currentWorkspace) return;
    const { data: patterns } = await supabase
      .from("insight_patterns")
      .select("*")
      .eq("workspace_id", currentWorkspace.id)
      .order("session_count", { ascending: false });

    if (patterns && patterns.length > 0) {
      exportPatternsToCSV(
        patterns.map((p) => ({
          title: p.title,
          description: p.description,
          sentiment: p.sentiment || "neutral",
          session_count: p.session_count,
          evidence_quotes: (p.evidence_quotes || []) as unknown as { quote: string; session_title: string }[],
        }))
      );
    } else if (questionBreakdowns.length > 0) {
      exportSurveyBreakdownToCSV(questionBreakdowns);
    }
    toast({ title: t("insights.csvExported") });
  };

  const handleCopyReport = async () => {
    if (!currentWorkspace) return;
    const { data: patterns } = await supabase
      .from("insight_patterns")
      .select("*")
      .eq("workspace_id", currentWorkspace.id)
      .order("session_count", { ascending: false });

    if (!patterns || patterns.length === 0) {
      toast({ title: t("insights.noDataToExport"), variant: "destructive" });
      return;
    }

    const md = patternsToMarkdown(
      patterns.map((p) => ({
        title: p.title,
        description: p.description,
        sentiment: p.sentiment || "neutral",
        session_count: p.session_count,
        evidence_quotes: (p.evidence_quotes || []) as unknown as { quote: string; session_title: string }[],
      })),
      sessionsAnalyzed
    );

    await navigator.clipboard.writeText(md);
    toast({ title: t("insights.reportCopied") });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const hasData = surveys.length > 0;
  const hasPatterns = patternCount > 0;
  const hasAnyData = hasData || hasPatterns || sessionsAnalyzed > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">{t("insights.title")}</h1>
        {hasAnyData && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCopyReport}><Copy className="h-4 w-4 me-2" />{t("insights.copyReport")}</Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV}><Download className="h-4 w-4 me-2" />{t("insights.exportCsv")}</Button>
          </div>
        )}
      </div>

      {!hasAnyData ? (
        <Card className="py-16">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">No insights yet</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Insights will appear here once you collect survey responses or add session transcripts. Launch a survey or run a session to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid gap-4 sm:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">{t("insights.totalResponses")}</p>
                <p className="text-2xl font-bold">{totalResponses}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">{t("insights.sessionsAnalyzed")}</p>
                <p className="text-2xl font-bold">{sessionsAnalyzed}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">{t("insights.patternsFound")}</p>
                <p className="text-2xl font-bold">{patternCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Surveys with Data</p>
                <p className="text-2xl font-bold">{surveys.length}</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="patterns">
            <TabsList>
              <TabsTrigger value="patterns">
                <Lightbulb className="h-4 w-4 me-2" />
                {t("insights.researchPatterns")}
              </TabsTrigger>
              <TabsTrigger value="quantitative">
                <BarChart3 className="h-4 w-4 me-2" />
                {t("insights.surveyResults")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="patterns" className="space-y-6 mt-4">
              <ResearchPatternsTab />
            </TabsContent>

            <TabsContent value="quantitative" className="space-y-6 mt-4">
              <div className="flex flex-wrap items-center gap-2">
                {projects.length > 0 && (
                  <Select value={surveyProjectFilter} onValueChange={(v) => { setSurveyProjectFilter(v); setSelectedSurvey(null); }}>
                    <SelectTrigger className="w-[200px] h-9 text-sm">
                      <SelectValue placeholder={t("insights.filterByProject")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("insights.allProjects")}</SelectItem>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {filteredSurveys.length > 1 && filteredSurveys.map((s) => (
                  <Button
                    key={s.id}
                    variant={selectedSurvey === s.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedSurvey(s.id)}
                  >
                    {s.title}
                    <Badge variant="secondary" className="ms-2 text-[10px]">{s.response_count}</Badge>
                  </Button>
                ))}
              </div>

              {isLoadingBreakdown ? (
                <div className="space-y-4">
                  <Skeleton className="h-64 w-full" />
                  <Skeleton className="h-64 w-full" />
                </div>
              ) : questionBreakdowns.length === 0 ? (
                <Card className="py-8">
                  <CardContent className="text-center text-sm text-muted-foreground">
                    No question data available for this survey.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-6 lg:grid-cols-2">
                  {questionBreakdowns.map((breakdown, i) => {
                    const distribution = getAnswerDistribution(breakdown);
                    if (distribution.length === 0) return null;
                    const useBarChart = distribution.length > 5;

                    return (
                      <Card key={i}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm line-clamp-2">{breakdown.question_text}</CardTitle>
                          <p className="text-xs text-muted-foreground">{breakdown.answers.length} responses</p>
                        </CardHeader>
                        <CardContent>
                          {useBarChart ? (
                            <ResponsiveContainer width="100%" height={220}>
                              <BarChart data={distribution} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                                <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                                <YAxis dataKey="label" type="category" width={120} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} />
                                <Tooltip />
                                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          ) : (
                            <ResponsiveContainer width="100%" height={220}>
                              <PieChart>
                                <Pie
                                  data={distribution}
                                  cx="50%"
                                  cy="50%"
                                  outerRadius={80}
                                  dataKey="value"
                                  label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`}
                                >
                                  {distribution.map((_, idx) => (
                                    <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip />
                              </PieChart>
                            </ResponsiveContainer>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
};

export default Insights;
