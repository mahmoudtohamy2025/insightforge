import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2 } from "lucide-react";

const sentimentColors: Record<string, string> = {
  positive: "bg-green-500/10 text-green-600 border-green-200",
  negative: "bg-red-500/10 text-red-600 border-red-200",
  neutral: "bg-slate-500/10 text-slate-600 border-slate-200",
  mixed: "bg-amber-500/10 text-amber-600 border-amber-200",
};

export function TrendingPatternsCard() {
  const { currentWorkspace } = useWorkspace();
  const { t } = useI18n();
  const workspaceId = currentWorkspace?.id;

  const { data: patterns = [], isLoading } = useQuery({
    queryKey: ["trending-patterns", workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("insight_patterns")
        .select("id, title, sentiment, session_count, evidence_quotes")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!workspaceId,
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          {t("dashboard.trendingPatterns") || "Trending Patterns"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-[200px]">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : patterns.length === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
            {t("dashboard.noPatterns") || "No patterns discovered yet"}
          </div>
        ) : (
          <div className="space-y-1">
            {patterns.map((p) => {
              const evidenceCount = Array.isArray(p.evidence_quotes)
                ? p.evidence_quotes.length
                : 0;
              return (
                <div
                  key={p.id}
                  className="flex items-start gap-3 rounded-md px-2 py-2.5 hover:bg-muted transition-colors"
                >
                  <div className="rounded-md bg-primary/10 p-1.5 shrink-0 mt-0.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {p.session_count} session{p.session_count !== 1 ? "s" : ""}
                      {evidenceCount > 0 && ` · ${evidenceCount} evidence`}
                    </p>
                  </div>
                  {p.sentiment && (
                    <Badge
                      variant="outline"
                      className={`text-[10px] shrink-0 ${sentimentColors[p.sentiment] || ""}`}
                    >
                      {p.sentiment}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
