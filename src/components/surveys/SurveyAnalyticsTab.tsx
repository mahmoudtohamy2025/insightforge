import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { BarChart3 } from "lucide-react";

interface SurveyAnalyticsTabProps {
  surveyId: string;
}

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  options: string[] | null;
  sort_order: number;
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(210, 70%, 55%)",
  "hsl(150, 60%, 45%)",
  "hsl(30, 80%, 55%)",
  "hsl(340, 65%, 50%)",
];

export function SurveyAnalyticsTab({ surveyId }: SurveyAnalyticsTabProps) {
  const { t } = useI18n();

  const { data: questions = [] } = useQuery({
    queryKey: ["survey-questions", surveyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("survey_questions")
        .select("id, question_text, question_type, options, sort_order")
        .eq("survey_id", surveyId)
        .order("sort_order");
      if (error) throw error;
      return data as Question[];
    },
  });

  const { data: responses = [], isLoading } = useQuery({
    queryKey: ["survey-responses", surveyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("survey_responses")
        .select("answers")
        .eq("survey_id", surveyId);
      if (error) throw error;
      return data;
    },
  });

  const analytics = useMemo(() => {
    return questions.map((q) => {
      const allAnswers = responses
        .map((r) => (r.answers as Record<string, string>)?.[q.id])
        .filter((a) => a !== undefined && a !== null && a !== "");

      if (["multiple_choice", "yes_no"].includes(q.question_type)) {
        const counts: Record<string, number> = {};
        allAnswers.forEach((a) => { counts[a] = (counts[a] || 0) + 1; });
        const chartData = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => ({ name, count, pct: allAnswers.length ? Math.round((count / allAnswers.length) * 100) : 0 }));
        return { question: q, type: "bar" as const, data: chartData, total: allAnswers.length };
      }

      if (q.question_type === "multi_select") {
        const counts: Record<string, number> = {};
        allAnswers.forEach((a) => {
          try {
            const arr = JSON.parse(a);
            if (Array.isArray(arr)) arr.forEach((v: string) => { counts[v] = (counts[v] || 0) + 1; });
          } catch { /* skip */ }
        });
        const chartData = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => ({ name, count, pct: allAnswers.length ? Math.round((count / allAnswers.length) * 100) : 0 }));
        return { question: q, type: "bar" as const, data: chartData, total: allAnswers.length };
      }

      if (q.question_type === "scale") {
        const nums = allAnswers.map(Number).filter((n) => !isNaN(n));
        const avg = nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : "—";
        const dist: Record<string, number> = {};
        [1, 2, 3, 4, 5].forEach((n) => { dist[String(n)] = 0; });
        nums.forEach((n) => { dist[String(n)] = (dist[String(n)] || 0) + 1; });
        const chartData = Object.entries(dist).map(([name, count]) => ({ name, count, pct: nums.length ? Math.round((count / nums.length) * 100) : 0 }));
        return { question: q, type: "scale" as const, data: chartData, total: nums.length, avg };
      }

      if (q.question_type === "nps") {
        const nums = allAnswers.map(Number).filter((n) => !isNaN(n) && n >= 0 && n <= 10);
        const promoters = nums.filter((n) => n >= 9).length;
        const detractors = nums.filter((n) => n <= 6).length;
        const npsScore = nums.length ? Math.round(((promoters - detractors) / nums.length) * 100) : 0;
        const dist: Record<string, number> = {};
        Array.from({ length: 11 }, (_, i) => i).forEach((n) => { dist[String(n)] = 0; });
        nums.forEach((n) => { dist[String(n)] = (dist[String(n)] || 0) + 1; });
        const chartData = Object.entries(dist).map(([name, count]) => ({ name, count, pct: nums.length ? Math.round((count / nums.length) * 100) : 0 }));
        return { question: q, type: "nps" as const, data: chartData, total: nums.length, npsScore, promoters, detractors, passives: nums.length - promoters - detractors };
      }

      if (q.question_type === "matrix") {
        const opts = q.options as any;
        const rows: string[] = opts?.rows || [];
        const cols: string[] = opts?.columns || [];
        
        const data = rows.map(r => {
          const rowData: any = { name: r };
          cols.forEach(c => rowData[c] = 0);
          
          allAnswers.forEach(a => {
            try {
              const parsed = JSON.parse(a);
              if (parsed[r] && cols.includes(parsed[r])) {
                rowData[parsed[r]]++;
              }
            } catch { /* skip */ }
          });
          return rowData;
        });

        return { question: q, type: "matrix" as const, data, total: allAnswers.length, cols };
      }

      // open_ended / text
      const wordCount = allAnswers.reduce((acc, a) => acc + a.split(/\s+/).length, 0);
      return { question: q, type: "text" as const, total: allAnswers.length, wordCount, data: [] };
    });
  }, [questions, responses]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (responses.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title={t("surveys.analytics.noData")}
        description={t("surveys.analytics.noDataDesc")}
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{responses.length} {t("surveys.responses")}</p>
      {analytics.map((a, i) => (
        <Card key={a.question.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {i + 1}. {a.question.question_text}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">{a.question.question_type}</Badge>
              <span className="text-xs text-muted-foreground">{a.total} {t("surveys.responses")}</span>
            </div>
          </CardHeader>
          <CardContent>
            {(a.type === "bar") && a.data.length > 0 && (
              <ResponsiveContainer width="100%" height={Math.max(120, a.data.length * 36)}>
                <RechartsBarChart data={a.data} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number, _: string, entry: any) => [`${value} (${entry.payload.pct}%)`, "Count"]} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {a.data.map((_, idx) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </RechartsBarChart>
              </ResponsiveContainer>
            )}

            {a.type === "scale" && (
              <div className="space-y-2">
                <div className="text-2xl font-bold text-primary">{a.avg} <span className="text-sm font-normal text-muted-foreground">/ 5 avg</span></div>
                <ResponsiveContainer width="100%" height={120}>
                  <RechartsBarChart data={a.data} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis hide />
                    <Tooltip formatter={(value: number, _: string, entry: any) => [`${value} (${entry.payload.pct}%)`, "Count"]} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
            )}

            {a.type === "nps" && (
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <div className={`text-3xl font-bold ${a.npsScore! >= 0 ? "text-primary" : "text-destructive"}`}>
                    {a.npsScore! > 0 ? "+" : ""}{a.npsScore}
                  </div>
                  <div className="text-sm text-muted-foreground">NPS Score</div>
                </div>
                <div className="flex gap-4 text-xs">
                  <span className="text-primary">Promoters (9-10): {a.promoters}</span>
                  <span className="text-muted-foreground">Passives (7-8): {a.passives}</span>
                  <span className="text-destructive">Detractors (0-6): {a.detractors}</span>
                </div>
                <ResponsiveContainer width="100%" height={100}>
                  <RechartsBarChart data={a.data} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis hide />
                    <Tooltip formatter={(value: number) => [value, "Count"]} />
                    <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                      {a.data.map((entry) => {
                        const n = Number(entry.name);
                        const color = n <= 6 ? "hsl(var(--destructive))" : n <= 8 ? "hsl(var(--muted-foreground))" : "hsl(var(--primary))";
                        return <Cell key={entry.name} fill={color} />;
                      })}
                    </Bar>
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
            )}

            {a.type === "matrix" && a.data.length > 0 && (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={Math.max(150, a.data.length * 40)}>
                  <RechartsBarChart data={a.data} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value: number, name: string) => [`${value}`, name]} />
                    {a.cols.map((c: string, idx: number) => (
                      <Bar key={c} dataKey={c} stackId="a" fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </RechartsBarChart>
                </ResponsiveContainer>
                
                <div className="flex flex-wrap gap-3 justify-center text-xs">
                  {a.cols.map((c: string, idx: number) => (
                    <div key={c} className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                      <span className="text-muted-foreground">{c}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {a.type === "text" && (
              <div className="text-sm text-muted-foreground">
                {a.total} {t("surveys.responses")} · {a.wordCount} {t("surveys.analytics.words")}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
