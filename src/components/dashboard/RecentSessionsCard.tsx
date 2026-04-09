import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useI18n } from "@/lib/i18n";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Video, MessageSquare, FileText, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  idi: MessageSquare,
  focus_group: Video,
  default: FileText,
};

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-500/10 text-blue-600 border-blue-200",
  live: "bg-green-500/10 text-green-600 border-green-200",
  completed: "bg-slate-500/10 text-slate-600 border-slate-200",
  cancelled: "bg-red-500/10 text-red-600 border-red-200",
};

export function RecentSessionsCard() {
  const { currentWorkspace } = useWorkspace();
  const { t } = useI18n();
  const navigate = useNavigate();
  const workspaceId = currentWorkspace?.id;

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["recent-sessions", workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("id, title, type, status, scheduled_date, created_at")
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
          <Clock className="h-4 w-4 text-primary" />
          {t("dashboard.recentSessions") || "Recent Sessions"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-[200px]">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
            {t("dashboard.noSessions") || "No sessions yet"}
          </div>
        ) : (
          <div className="space-y-1">
            {sessions.map((s) => {
              const Icon = typeIcons[s.type || "default"] || typeIcons.default;
              return (
                <button
                  key={s.id}
                  onClick={() => navigate(`/sessions/${s.id}`)}
                  className="w-full flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-muted transition-colors text-left"
                >
                  <div className="rounded-md bg-primary/10 p-1.5 shrink-0">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] shrink-0 ${statusColors[s.status || "scheduled"] || ""}`}
                  >
                    {s.status}
                  </Badge>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
