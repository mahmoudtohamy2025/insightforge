import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { Loader2, Sparkles, Copy, Check, X, MessageSquare, FileText } from "lucide-react";

interface ProbesTabProps {
  sessionId: string;
  workspaceId: string;
  projectId: string | null;
  hasTranscript: boolean;
}

export function ProbesTab({ sessionId, workspaceId, projectId, hasTranscript }: ProbesTabProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: probes = [], isLoading } = useQuery({
    queryKey: ["session-probes", sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_probes")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (source: "discussion_guide" | "post_session") => {
      const { data, error } = await supabase.functions.invoke("generate-probes", {
        body: { session_id: sessionId, workspace_id: workspaceId, source },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["session-probes", sessionId] });
      toast({ title: t("probes.generated"), description: `${data.count} ${t("probes.probesGenerated")}` });
    },
    onError: (e) => toast({ title: t("probes.generateError"), description: e.message, variant: "destructive" }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ probeId, status }: { probeId: string; status: string }) => {
      const { error } = await supabase
        .from("session_probes")
        .update({ status })
        .eq("id", probeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session-probes", sessionId] });
    },
  });

  const copyProbe = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const guideProbes = probes.filter((p: any) => p.source === "discussion_guide");
  const postProbes = probes.filter((p: any) => p.source === "post_session");

  // Group guide probes by question
  const groupedGuideProbes: Record<string, any[]> = {};
  guideProbes.forEach((p: any) => {
    const key = p.guide_question_text || t("probes.generalProbes");
    if (!groupedGuideProbes[key]) groupedGuideProbes[key] = [];
    groupedGuideProbes[key].push(p);
  });

  const statusColors: Record<string, string> = {
    suggested: "bg-muted text-muted-foreground",
    used: "bg-primary/10 text-primary",
    dismissed: "bg-destructive/10 text-destructive",
  };

  const renderProbeCard = (probe: any) => (
    <Card key={probe.id} className={probe.status === "dismissed" ? "opacity-50" : ""}>
      <CardContent className="p-3 flex items-start gap-3">
        <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm">{probe.suggested_text}</p>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className={`text-xs ${statusColors[probe.status] || ""}`}>
              {t(`probes.status.${probe.status}`)}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => copyProbe(probe.id, probe.suggested_text)}
          >
            {copiedId === probe.id ? (
              <Check className="h-3.5 w-3.5 text-primary" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
          {probe.status === "suggested" && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => updateStatusMutation.mutate({ probeId: probe.id, status: "used" })}
                title={t("probes.markUsed")}
              >
                <Check className="h-3.5 w-3.5 text-primary" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => updateStatusMutation.mutate({ probeId: probe.id, status: "dismissed" })}
                title={t("probes.dismiss")}
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {projectId && (
          <Button
            size="sm"
            onClick={() => generateMutation.mutate("discussion_guide")}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 me-1.5" />
            )}
            {t("probes.generateFromGuide")}
          </Button>
        )}
        {hasTranscript && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => generateMutation.mutate("post_session")}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />
            ) : (
              <FileText className="h-3.5 w-3.5 me-1.5" />
            )}
            {t("probes.generateFromTranscript")}
          </Button>
        )}
      </div>

      {probes.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title={t("probes.noProbes")}
          description={projectId ? t("probes.noProbesDesc") : t("probes.noProjectLinked")}
        />
      ) : (
        <>
          {/* Discussion Guide Probes */}
          {Object.keys(groupedGuideProbes).length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                {t("probes.discussionGuideProbes")}
              </h3>
              {Object.entries(groupedGuideProbes).map(([question, qProbes]) => (
                <div key={question} className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground px-1">{question}</p>
                  {qProbes.map(renderProbeCard)}
                </div>
              ))}
            </div>
          )}

          {/* Post-session Probes */}
          {postProbes.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                {t("probes.postSessionProbes")}
              </h3>
              <div className="space-y-2">
                {postProbes.map(renderProbeCard)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
