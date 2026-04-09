import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, Filter, Loader2 } from "lucide-react";
import { format } from "date-fns";

const ACTION_OPTIONS = ["all", "created", "updated", "deleted", "invited_member", "removed_member", "changed_role", "launched", "completed", "paused"];
const ENTITY_OPTIONS = ["all", "session", "survey", "project", "participant", "member", "workspace"];

export function ActivityTab({ workspaceId, t }: { workspaceId?: string; t: (k: string) => string }) {
  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["workspace-activity", workspaceId, actionFilter, entityFilter],
    queryFn: async () => {
      let query = supabase
        .from("workspace_activity")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false })
        .limit(100);

      if (actionFilter !== "all") {
        query = query.eq("action", actionFilter);
      }
      if (entityFilter !== "all") {
        query = query.eq("entity_type", entityFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Array<{
        id: string;
        action: string;
        entity_type: string;
        metadata: Record<string, any>;
        created_at: string;
        user_id: string;
      }>;
    },
    enabled: !!workspaceId,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            {t("activity.title")}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <Filter className="h-3 w-3 me-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_OPTIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a === "all" ? t("activity.allActions") : t(`activity.${a}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_OPTIONS.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e === "all" ? t("activity.allEntities") : e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">{t("activity.noActivity")}</p>
        ) : (
          <div className="space-y-3">
            {activities.map((a) => (
              <div key={a.id} className="flex items-start gap-3 text-sm border-b border-border/50 pb-3 last:border-0">
                <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p>
                    <span className="font-medium capitalize">{t(`activity.${a.action}`)}</span>{" "}
                    <span className="text-muted-foreground">{a.entity_type}</span>
                    {a.metadata?.title && (
                      <span className="font-medium"> "{a.metadata.title}"</span>
                    )}
                    {a.metadata?.name && (
                      <span className="font-medium"> "{a.metadata.name}"</span>
                    )}
                    {a.metadata?.type === "retention_cleanup" && (
                      <span className="text-muted-foreground"> ({a.metadata.records_deleted} records)</span>
                    )}
                    {a.metadata?.type === "data_export" && (
                      <Badge variant="secondary" className="ms-2 text-[10px]">Export</Badge>
                    )}
                    {a.metadata?.type === "erasure_request" && (
                      <Badge variant="destructive" className="ms-2 text-[10px]">Erasure</Badge>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(a.created_at), "MMM d, yyyy · HH:mm")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
