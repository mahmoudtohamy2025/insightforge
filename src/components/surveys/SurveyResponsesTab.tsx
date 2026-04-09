import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Search, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

const PAGE_SIZE = 50;

interface SurveyResponsesTabProps {
  surveyId: string;
  workspaceId: string;
}

export const SurveyResponsesTab = ({ surveyId, workspaceId }: SurveyResponsesTabProps) => {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const { data: questions = [] } = useQuery({
    queryKey: ["survey-questions", surveyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("survey_questions")
        .select("id, question_text, sort_order")
        .eq("survey_id", surveyId)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: responses = [], isLoading } = useQuery({
    queryKey: ["survey-responses", surveyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("survey_responses")
        .select("id, answers, completed_at, created_at")
        .eq("survey_id", surveyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return responses;
    const q = search.toLowerCase();
    return responses.filter((r) => {
      const answers = r.answers as Record<string, string>;
      return Object.values(answers).some((v) =>
        String(v).toLowerCase().includes(q)
      );
    });
  }, [responses, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const exportCsv = () => {
    const headers = ["#", "Date", ...questions.map((q) => q.question_text)];
    const rows = filtered.map((r, i) => {
      const answers = r.answers as Record<string, string>;
      return [
        String(i + 1),
        r.completed_at
          ? new Date(r.completed_at).toLocaleDateString()
          : new Date(r.created_at!).toLocaleDateString(),
        ...questions.map((q) => {
          const val = answers[q.id] ?? "";
          return `"${String(val).replace(/"/g, '""')}"`;
        }),
      ];
    });
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `responses-${surveyId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
        icon={Search}
        title={t("surveys.responses.noResponses")}
        description={t("surveys.responses.noResponsesDesc")}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder={t("surveys.responses.search")}
            className="ps-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="h-4 w-4 me-1.5" />
          {t("surveys.responses.exportCsv")}
        </Button>
        <span className="text-sm text-muted-foreground">
          {filtered.length} / {responses.length}
        </span>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead className="w-28">{t("surveys.responses.date")}</TableHead>
              {questions.map((q) => (
                <TableHead key={q.id} className="min-w-[150px]">
                  {q.question_text}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.map((r, i) => {
              const answers = r.answers as Record<string, string>;
              return (
                <TableRow key={r.id}>
                  <TableCell className="text-muted-foreground">{page * PAGE_SIZE + i + 1}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.completed_at
                      ? new Date(r.completed_at).toLocaleDateString()
                      : new Date(r.created_at!).toLocaleDateString()}
                  </TableCell>
                  {questions.map((q) => (
                    <TableCell key={q.id} className="text-sm">
                      {(() => {
                        const val = answers[q.id];
                        if (val === undefined || val === null) return "—";
                        try {
                          const parsed = JSON.parse(val);
                          if (Array.isArray(parsed)) return parsed.join(", ");
                        } catch { /* not JSON */ }
                        return String(val);
                      })()}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            {t("common.previous")}
          </Button>
          <span className="text-sm text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            {t("common.next")}
          </Button>
        </div>
      )}
    </div>
  );
};
