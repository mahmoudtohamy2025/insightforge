import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Search, FolderKanban, ClipboardList, Video, Loader2, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLogger";
import { parseTierLimitError } from "@/lib/tierLimitError";

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  draft: "outline",
  active: "default",
  in_progress: "default",
  analysis: "secondary",
  completed: "secondary",
  archived: "outline",
};

const ALL_STATUSES = ["all", "draft", "active", "in_progress", "analysis", "completed", "archived"];

const Projects = () => {
  const { t, language } = useI18n();
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { canCreate } = useWorkspaceRole();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [createMode, setCreateMode] = useState<"quick" | "ai">("quick");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiPlan, setAiPlan] = useState<any>(null);
  const [generatingPlan, setGeneratingPlan] = useState(false);

  const workspaceId = currentWorkspace?.id;

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!workspaceId,
  });

  const { data: surveyCounts = {} } = useQuery({
    queryKey: ["project-survey-counts", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return {};
      const { data, error } = await supabase
        .from("surveys")
        .select("project_id")
        .eq("workspace_id", workspaceId)
        .not("project_id", "is", null);
      if (error) throw error;
      const counts: Record<string, number> = {};
      data.forEach((s) => {
        if (s.project_id) counts[s.project_id] = (counts[s.project_id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!workspaceId,
  });

  const { data: sessionCounts = {} } = useQuery({
    queryKey: ["project-session-counts", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return {};
      const { data, error } = await supabase
        .from("sessions")
        .select("project_id")
        .eq("workspace_id", workspaceId)
        .not("project_id", "is", null);
      if (error) throw error;
      const counts: Record<string, number> = {};
      data.forEach((s) => {
        if (s.project_id) counts[s.project_id] = (counts[s.project_id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!workspaceId,
  });

  const createMutation = useMutation({
    mutationFn: async (overrides?: any) => {
      const insertData: any = {
        workspace_id: workspaceId!,
        name: overrides?.name || name,
        description: overrides?.description || description || null,
        created_by: user!.id,
      };
      if (overrides) {
        Object.assign(insertData, overrides);
        insertData.created_by = user!.id;
        insertData.workspace_id = workspaceId!;
      }
      const { error } = await supabase.from("projects").insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", workspaceId] });
      resetDialog();
      toast.success(t("projects.created"));
      if (workspaceId && user) {
        logActivity(workspaceId, user.id, "created", "project", undefined, { name });
      }
    },
    onError: (e: Error) => {
      const tierErr = parseTierLimitError(e);
      if (tierErr) {
        toast.error(t("billing.tierLimitTitle"), {
          description: t("billing.tierLimitReached")
            .replace("{resource}", t("billing.projects").toLowerCase())
            .replace("{tier}", t(`billing.${tierErr.currentTier}`)),
        });
      } else {
        toast.error(e.message);
      }
    },
  });

  const generatePlan = async () => {
    if (!aiPrompt.trim()) return;
    setGeneratingPlan(true);
    setAiPlan(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-project-plan", {
        body: { description: aiPrompt, locale: language },
      });
      if (error) throw error;
      if (data?.plan) {
        setAiPlan(data.plan);
      } else {
        throw new Error("No plan returned");
      }
    } catch (e: any) {
      toast.error(e.message || t("projects.aiError"));
    } finally {
      setGeneratingPlan(false);
    }
  };

  const applyAiPlan = () => {
    if (!aiPlan) return;
    const dueDate = aiPlan.suggested_timeline_days
      ? new Date(Date.now() + aiPlan.suggested_timeline_days * 86400000).toISOString().split("T")[0]
      : null;
    createMutation.mutate({
      name: aiPlan.title,
      description: aiPrompt,
      objective: aiPlan.objective,
      methodology: aiPlan.methodology,
      discussion_guide: aiPlan.discussion_guide,
      screener_criteria: aiPlan.screener_criteria,
      target_participants: aiPlan.target_participants,
      target_sessions: aiPlan.target_sessions,
      ai_plan: aiPlan,
      due_date: dueDate,
      status: "draft",
    });
  };

  const resetDialog = () => {
    setOpen(false);
    setName("");
    setDescription("");
    setAiPrompt("");
    setAiPlan(null);
    setCreateMode("quick");
    setGeneratingPlan(false);
  };

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const countByStatus = (status: string) => filtered.filter((p) => p.status === status).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">{t("projects.title")}</h1>
        <Dialog open={open} onOpenChange={(v) => { if (!v) resetDialog(); else setOpen(true); }}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <DialogTrigger asChild>
                  <Button disabled={!canCreate}><Plus className="h-4 w-4 me-2" />{t("projects.create")}</Button>
                </DialogTrigger>
              </span>
            </TooltipTrigger>
            {!canCreate && <TooltipContent>{t("observer.noPermission")}</TooltipContent>}
          </Tooltip>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{t("projects.create")}</DialogTitle></DialogHeader>

            {/* Mode toggle */}
            <div className="flex gap-2 mb-2">
              <Button
                variant={createMode === "quick" ? "default" : "outline"}
                size="sm"
                onClick={() => { setCreateMode("quick"); setAiPlan(null); }}
              >
                {t("projects.quickCreate")}
              </Button>
              <Button
                variant={createMode === "ai" ? "default" : "outline"}
                size="sm"
                onClick={() => setCreateMode("ai")}
              >
                <Sparkles className="h-3.5 w-3.5 me-1" />{t("projects.aiAssisted")}
              </Button>
            </div>

            {createMode === "quick" ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("projects.name")}</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("projects.name")} />
                </div>
                <div className="space-y-2">
                  <Label>{t("projects.description")}</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("projects.description")} rows={3} />
                </div>
                <Button onClick={() => createMutation.mutate(undefined)} disabled={!name.trim() || createMutation.isPending} className="w-full">
                  {createMutation.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                  {t("common.create")}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("projects.describeGoal")}</Label>
                  <Textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder={t("projects.aiPlaceholder")}
                    rows={4}
                  />
                </div>
                {!aiPlan && (
                  <Button onClick={generatePlan} disabled={!aiPrompt.trim() || generatingPlan} className="w-full">
                    {generatingPlan ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Sparkles className="h-4 w-4 me-2" />}
                    {generatingPlan ? t("projects.generating") : t("projects.generatePlan")}
                  </Button>
                )}
                {aiPlan && (
                  <div className="space-y-3 rounded-md border p-3 bg-muted/50 max-h-64 overflow-y-auto text-sm">
                    <p className="font-semibold">{aiPlan.title}</p>
                    <p className="text-muted-foreground">{aiPlan.objective}</p>
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="outline" className="capitalize">{aiPlan.methodology}</Badge>
                      <Badge variant="outline">{aiPlan.target_participants} participants</Badge>
                      <Badge variant="outline">{aiPlan.target_sessions} sessions</Badge>
                      {aiPlan.suggested_timeline_days && <Badge variant="outline">{aiPlan.suggested_timeline_days} days</Badge>}
                    </div>
                    {aiPlan.discussion_guide?.length > 0 && (
                      <div>
                        <p className="font-medium mb-1">{t("projects.discussionGuide")}</p>
                        {aiPlan.discussion_guide.map((s: any, i: number) => (
                          <div key={i} className="mb-1">
                            <p className="text-xs font-medium">{s.section}</p>
                            <ul className="list-disc list-inside text-xs text-muted-foreground">
                              {s.questions?.map((q: string, qi: number) => <li key={qi}>{q}</li>)}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                    {aiPlan.cultural_notes?.length > 0 && (
                      <div>
                        <p className="font-medium mb-1">{t("projects.culturalNotes")}</p>
                        <ul className="list-disc list-inside text-xs text-muted-foreground">
                          {aiPlan.cultural_notes.map((n: string, i: number) => <li key={i}>{n}</li>)}
                        </ul>
                      </div>
                    )}
                    <div className="flex gap-2 pt-2">
                      <Button onClick={applyAiPlan} disabled={createMutation.isPending} className="flex-1">
                        {createMutation.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                        {t("projects.createFromPlan")}
                      </Button>
                      <Button variant="outline" onClick={() => setAiPlan(null)}>
                        {t("projects.regenerate")}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder={t("projects.search")} value={search} onChange={(e) => setSearch(e.target.value)} className="ps-9" />
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-36 rounded-lg" />)}
        </div>
      ) : (
        <Tabs defaultValue="all">
          <TabsList className="flex-wrap">
            {ALL_STATUSES.map((s) => (
              <TabsTrigger key={s} value={s}>
                {s === "all" ? `All (${filtered.length})` : `${t(`projects.${s}`)} (${s === "all" ? filtered.length : countByStatus(s)})`}
              </TabsTrigger>
            ))}
          </TabsList>

          {ALL_STATUSES.map((tab) => (
            <TabsContent key={tab} value={tab} className="mt-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered
                  .filter((p) => tab === "all" || p.status === tab)
                  .map((project) => (
                    <Card
                      key={project.id}
                      className="hover:shadow-card-hover transition-shadow cursor-pointer"
                      onClick={() => navigate(`/projects/${project.id}`)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-sm font-medium leading-snug">{project.name}</CardTitle>
                          <Badge variant={statusVariant[project.status] || "secondary"} className="shrink-0">
                            {t(`projects.${project.status}`)}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {project.description && (
                          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{project.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <ClipboardList className="h-3 w-3" />
                            {surveyCounts[project.id] || 0} {t("projects.surveys")}
                          </span>
                          <span className="flex items-center gap-1">
                            <Video className="h-3 w-3" />
                            {sessionCounts[project.id] || 0} {t("projects.sessions")}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
              {filtered.filter((p) => tab === "all" || p.status === tab).length === 0 && (
                <EmptyState
                  icon={FolderKanban}
                  title={t("projects.noProjects")}
                  description={t("projects.createFirst")}
                  actionLabel={t("projects.create")}
                  onAction={() => setOpen(true)}
                />
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
};

export default Projects;
