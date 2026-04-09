import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Copy, Loader2, Plus, Trash2, Calendar, Users, Target, UserSearch, Sparkles, Beaker, Bot, LineChart, Scale } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { ParticipantMatchingTab } from "@/components/projects/ParticipantMatchingTab";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLogger";

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  active: "default",
  in_progress: "default",
  analysis: "secondary",
  completed: "secondary",
  archived: "outline",
};

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { canCreate } = useWorkspaceRole();
  const queryClient = useQueryClient();
  const workspaceId = currentWorkspace?.id;

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["project-sessions", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("id, title, status, scheduled_date, type")
        .eq("project_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: surveys = [] } = useQuery({
    queryKey: ["project-surveys", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("surveys")
        .select("id, title, status, response_count, target_responses")
        .eq("project_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("projects").update({ status }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(t("projects.statusUpdated"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicateMutation = useMutation({
    mutationFn: async () => {
      if (!project || !workspaceId || !user) throw new Error("Missing data");
      const { error } = await supabase.from("projects").insert({
        workspace_id: workspaceId,
        name: project.name + " (Copy)",
        description: project.description,
        objective: project.objective,
        methodology: project.methodology,
        discussion_guide: project.discussion_guide,
        screener_criteria: project.screener_criteria,
        target_participants: project.target_participants,
        target_sessions: project.target_sessions,
        tags: project.tags,
        status: "draft",
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(t("projects.duplicated"));
      if (workspaceId && user) {
        logActivity(workspaceId, user.id, "duplicated", "project", id, { name: project?.name });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Discussion guide editing
  const [editingGuide, setEditingGuide] = useState(false);
  const [guideData, setGuideData] = useState<Array<{ section: string; questions: string[] }>>([]);

  const saveGuideMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("projects")
        .update({ discussion_guide: guideData as unknown as Json })
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      setEditingGuide(false);
      toast.success(t("common.save"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (!project) {
    return <EmptyState icon={Target} title={t("projects.notFound")} description="" />;
  }

  type ScreenerCriterion = { criterion: string; requirement: string };
  type GuideSection = { section: string; questions: string[] };
  const discussionGuide = (project.discussion_guide || []) as unknown as GuideSection[];

  const startEditing = () => {
    setGuideData(discussionGuide.length > 0 ? [...discussionGuide] : [{ section: "", questions: [""] }]);
    setEditingGuide(true);
  };

  const addSection = () => setGuideData([...guideData, { section: "", questions: [""] }]);
  const removeSection = (i: number) => setGuideData(guideData.filter((_, idx) => idx !== i));
  const updateSectionTitle = (i: number, val: string) => {
    const copy = [...guideData];
    copy[i] = { ...copy[i], section: val };
    setGuideData(copy);
  };
  const addQuestion = (si: number) => {
    const copy = [...guideData];
    copy[si] = { ...copy[si], questions: [...copy[si].questions, ""] };
    setGuideData(copy);
  };
  const updateQuestion = (si: number, qi: number, val: string) => {
    const copy = [...guideData];
    const qs = [...copy[si].questions];
    qs[qi] = val;
    copy[si] = { ...copy[si], questions: qs };
    setGuideData(copy);
  };
  const removeQuestion = (si: number, qi: number) => {
    const copy = [...guideData];
    copy[si] = { ...copy[si], questions: copy[si].questions.filter((_, i) => i !== qi) };
    setGuideData(copy);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/projects")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">{project.name}</h1>
          {project.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{project.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={project.status}
            onValueChange={(v) => statusMutation.mutate(v)}
            disabled={!canCreate}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["draft", "active", "in_progress", "analysis", "completed", "archived"].map((s) => (
                <SelectItem key={s} value={s}>{t(`projects.${s}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canCreate && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => duplicateMutation.mutate()}
              disabled={duplicateMutation.isPending}
            >
              {duplicateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
              <span className="ms-1">{t("projects.duplicate")}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{t("projects.overview")}</TabsTrigger>
          <TabsTrigger value="guide">{t("projects.discussionGuide")}</TabsTrigger>
          <TabsTrigger value="sessions">{t("projects.sessions")} ({sessions.length})</TabsTrigger>
          <TabsTrigger value="surveys">{t("projects.surveys")} ({surveys.length})</TabsTrigger>
          <TabsTrigger value="recruit" className="gap-1">
            <UserSearch className="h-3.5 w-3.5" />
            {t("projects.recruit.tab")}
          </TabsTrigger>
          <TabsTrigger value="synthetic" className="gap-1 px-4 text-primary bg-primary/10 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Sparkles className="h-3.5 w-3.5 text-purple-600 data-[state=active]:text-white" />
            Synthetic Lab
          </TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("projects.methodology")}</CardTitle></CardHeader>
              <CardContent><p className="text-lg font-semibold capitalize">{project.methodology || "qualitative"}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1"><Users className="h-3.5 w-3.5" />{t("projects.targetParticipants")}</CardTitle></CardHeader>
              <CardContent><p className="text-lg font-semibold">{project.target_participants || "—"}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{t("projects.dueDate")}</CardTitle></CardHeader>
              <CardContent><p className="text-lg font-semibold">{project.due_date || "—"}</p></CardContent>
            </Card>
          </div>

          {project.objective && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">{t("projects.objective")}</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{project.objective}</p></CardContent>
            </Card>
          )}

          {project.screener_criteria && (project.screener_criteria as unknown as ScreenerCriterion[]).length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">{t("projects.screenerCriteria")}</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {(project.screener_criteria as unknown as ScreenerCriterion[]).map((c, i: number) => (
                    <li key={i} className="flex gap-2">
                      <span className="font-medium">{c.criterion}:</span>
                      <span className="text-muted-foreground">{c.requirement}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {project.tags && project.tags.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {project.tags.map((tag) => (
                <Badge key={tag} variant="outline">{tag}</Badge>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Discussion Guide */}
        <TabsContent value="guide" className="mt-4">
          {!editingGuide ? (
            <div className="space-y-4">
              <div className="flex justify-end">
                {canCreate && (
                  <Button variant="outline" size="sm" onClick={startEditing}>
                    {t("common.edit")}
                  </Button>
                )}
              </div>
              {discussionGuide.length === 0 ? (
                <EmptyState
                  icon={Target}
                  title={t("projects.noGuide")}
                  description={t("projects.noGuideDesc")}
                  actionLabel={canCreate ? t("common.edit") : undefined}
                  onAction={canCreate ? startEditing : undefined}
                />
              ) : (
                discussionGuide.map((section, i) => (
                  <Card key={i}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">{section.section}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                        {section.questions.map((q, qi) => (
                          <li key={qi}>{q}</li>
                        ))}
                      </ol>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {guideData.map((section, si) => (
                <Card key={si}>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Input
                        value={section.section}
                        onChange={(e) => updateSectionTitle(si, e.target.value)}
                        placeholder={t("projects.sectionTitle")}
                        className="font-medium"
                      />
                      <Button variant="ghost" size="icon" onClick={() => removeSection(si)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    {section.questions.map((q, qi) => (
                      <div key={qi} className="flex items-center gap-2 ps-4">
                        <span className="text-xs text-muted-foreground w-5">{qi + 1}.</span>
                        <Input
                          value={q}
                          onChange={(e) => updateQuestion(si, qi, e.target.value)}
                          placeholder={t("projects.questionPlaceholder")}
                        />
                        <Button variant="ghost" size="icon" onClick={() => removeQuestion(si, qi)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" onClick={() => addQuestion(si)} className="ms-4">
                      <Plus className="h-3.5 w-3.5 me-1" />{t("projects.addQuestion")}
                    </Button>
                  </CardContent>
                </Card>
              ))}
              <Button variant="outline" size="sm" onClick={addSection}>
                <Plus className="h-4 w-4 me-1" />{t("projects.addSection")}
              </Button>
              <div className="flex gap-2">
                <Button onClick={() => saveGuideMutation.mutate()} disabled={saveGuideMutation.isPending}>
                  {saveGuideMutation.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                  {t("common.save")}
                </Button>
                <Button variant="ghost" onClick={() => setEditingGuide(false)}>
                  {t("common.cancel")}
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Sessions */}
        <TabsContent value="sessions" className="mt-4">
          {sessions.length === 0 ? (
            <EmptyState
              icon={Target}
              title={t("projects.noSessions")}
              description={t("projects.noSessionsDesc")}
            />
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => (
                <Card
                  key={s.id}
                  className="cursor-pointer hover:shadow-card-hover transition-shadow"
                  onClick={() => navigate(`/sessions/${s.id}`)}
                >
                  <CardContent className="flex items-center justify-between py-3 px-4">
                    <div>
                      <p className="text-sm font-medium">{s.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">{s.type} · {s.scheduled_date || "—"}</p>
                    </div>
                    <Badge variant={statusVariant[s.status] || "secondary"}>{s.status}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Surveys */}
        <TabsContent value="surveys" className="mt-4">
          {surveys.length === 0 ? (
            <EmptyState
              icon={Target}
              title={t("projects.noSurveys")}
              description={t("projects.noSurveysDesc")}
            />
          ) : (
            <div className="space-y-2">
              {surveys.map((s) => (
                <Card
                  key={s.id}
                  className="cursor-pointer hover:shadow-card-hover transition-shadow"
                  onClick={() => navigate(`/surveys/${s.id}`)}
                >
                  <CardContent className="flex items-center justify-between py-3 px-4">
                    <div>
                      <p className="text-sm font-medium">{s.title}</p>
                      <p className="text-xs text-muted-foreground">{s.response_count}/{s.target_responses} {t("projects.responses")}</p>
                    </div>
                    <Badge variant={statusVariant[s.status] || "secondary"}>{s.status}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Recruit / Matching */}
        <TabsContent value="recruit" className="mt-4">
          <ParticipantMatchingTab
            projectId={id!}
            screenerCriteria={(project.screener_criteria as unknown as ScreenerCriterion[]) || []}
            sessions={sessions.map((s) => ({ id: s.id, title: s.title }))}
          />
        </TabsContent>

        {/* Synthetic Lab */}
        <TabsContent value="synthetic" className="mt-4">
          <div className="mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              InsightForge Synthetic Lab
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Pre-test your research hypotheses, optimize discussion guides, and forecast market impact using fully calibrated MENA Digital Consumer Twins before spending your recruitment budget.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="hover:border-purple-500/50 hover:shadow-md transition-all cursor-pointer group" onClick={() => navigate(`/twin-builder?project_id=${id}`)}>
              <CardContent className="p-6">
                <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Bot className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="font-bold text-lg mb-2">Custom Twin Builder</h3>
                <p className="text-sm text-muted-foreground">Architect specific consumer profiles matching this project's exact screener criteria.</p>
              </CardContent>
            </Card>
            
            <Card className="hover:border-purple-500/50 hover:shadow-md transition-all cursor-pointer group" onClick={() => navigate(`/focus-group?project_id=${id}`)}>
              <CardContent className="p-6">
                <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="font-bold text-lg mb-2">AI Focus Group</h3>
                <p className="text-sm text-muted-foreground">Pre-test your discussion guide with synthetic respondents to discover weak questions.</p>
              </CardContent>
            </Card>
            
            <Card className="hover:border-purple-500/50 hover:shadow-md transition-all cursor-pointer group" onClick={() => navigate(`/ab-test?project_id=${id}`)}>
              <CardContent className="p-6">
                <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Beaker className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="font-bold text-lg mb-2">A/B Concept Testing</h3>
                <p className="text-sm text-muted-foreground">Rapidly test two concepts or stimulus variants to see which generates higher twin purchase intent.</p>
              </CardContent>
            </Card>

            <Card className="hover:border-purple-500/50 hover:shadow-md transition-all cursor-pointer group" onClick={() => navigate(`/market-sim?project_id=${id}`)}>
              <CardContent className="p-6">
                <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <LineChart className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="font-bold text-lg mb-2">Market Simulation</h3>
                <p className="text-sm text-muted-foreground">Forecast adoption curves and viral coefficient potential across broad synthetic populations.</p>
              </CardContent>
            </Card>

            <Card className="hover:border-purple-500/50 hover:shadow-md transition-all cursor-pointer group" onClick={() => navigate(`/policy-sim?project_id=${id}`)}>
              <CardContent className="p-6">
                <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Scale className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="font-bold text-lg mb-2">Policy Testing</h3>
                <p className="text-sm text-muted-foreground">Simulate public reaction to pricing changes, feature deprecation, or brand crises.</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProjectDetail;
