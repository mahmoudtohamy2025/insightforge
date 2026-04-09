import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  BarChart3,
  Clock,
  CheckCircle2,
  Rocket,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  Link2,
  Pencil,
} from "lucide-react";
import { QuestionEditor } from "@/components/surveys/QuestionEditor";
import { SurveyResponsesTab } from "@/components/surveys/SurveyResponsesTab";
import { SurveyAnalyticsTab } from "@/components/surveys/SurveyAnalyticsTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DistributeSurveyDialog } from "@/components/surveys/DistributeSurveyDialog";

const statusConfig = {
  draft: { label: "surveys.draft", variant: "secondary" as const, icon: Clock },
  live: { label: "surveys.live", variant: "default" as const, icon: BarChart3 },
  paused: { label: "surveys.paused", variant: "outline" as const, icon: PauseCircle },
  completed: { label: "surveys.completed", variant: "outline" as const, icon: CheckCircle2 },
  archived: { label: "surveys.completed", variant: "outline" as const, icon: CheckCircle2 },
};


interface StatusUpdate {
  status: string;
  launched_at?: string | null;
  completed_at?: string | null;
  paused_at?: string | null;
}

const SurveyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const { data: survey, isLoading: surveyLoading } = useQuery({
    queryKey: ["survey", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("surveys")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: questions = [], isLoading: questionsLoading } = useQuery({
    queryKey: ["survey-questions", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("survey_questions")
        .select("*")
        .eq("survey_id", id!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: async (update: StatusUpdate) => {
      const { error } = await supabase
        .from("surveys")
        .update(update)
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["survey", id] });
      queryClient.invalidateQueries({ queryKey: ["surveys"] });
      toast.success(t("surveys.detail.statusUpdated"));
    },
  });

  const isLoading = surveyLoading || questionsLoading;
  const canGoLive = questions.length > 0;
  const isDraft = survey?.status === "draft";

  // Inline editing state
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editingTitle && titleInputRef.current) titleInputRef.current.focus();
  }, [editingTitle]);
  useEffect(() => {
    if (editingDescription && descInputRef.current) descInputRef.current.focus();
  }, [editingDescription]);

  const updateFieldMutation = useMutation({
    mutationFn: async (fields: { title?: string; description?: string }) => {
      const { error } = await supabase
        .from("surveys")
        .update(fields)
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["survey", id] });
      queryClient.invalidateQueries({ queryKey: ["surveys"] });
      toast.success(t(variables.title !== undefined ? "surveys.detail.titleSaved" : "surveys.detail.descriptionSaved"));
    },
  });

  const handleGoLive = () => {
    statusMutation.mutate({
      status: "live",
      launched_at: new Date().toISOString(),
    });
  };

  const handlePause = () => {
    statusMutation.mutate({
      status: "paused",
      paused_at: new Date().toISOString(),
    });
  };

  const handleResume = () => {
    statusMutation.mutate({
      status: "live",
      paused_at: null,
    });
  };

  const handleComplete = () => {
    statusMutation.mutate({
      status: "completed",
      completed_at: new Date().toISOString(),
      paused_at: null,
    });
  };

  const handleReopen = () => {
    statusMutation.mutate({
      status: "live",
      completed_at: null,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 rounded-lg" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Survey not found</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate("/surveys")}>
          <ArrowLeft className="h-4 w-4 me-2" />
          {t("surveys.title")}
        </Button>
      </div>
    );
  }

  const config = statusConfig[survey.status as keyof typeof statusConfig] ?? statusConfig.draft;
  const StatusIcon = config.icon;
  const progress = survey.target_responses > 0
    ? (survey.response_count / survey.target_responses) * 100
    : 0;
  const isAutoCompleted =
    survey.status === "completed" &&
    survey.target_responses > 0 &&
    survey.response_count >= survey.target_responses;

  return (
    <div className="space-y-6">
      {/* Back button & header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/surveys")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            {isDraft && editingTitle ? (
              <Input
                ref={titleInputRef}
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                className="text-2xl font-bold h-auto py-1 max-w-md"
                onBlur={() => {
                  const trimmed = titleDraft.trim();
                  if (!trimmed) {
                    toast.error(t("surveys.detail.titleRequired"));
                    setTitleDraft(survey.title);
                    setEditingTitle(false);
                    return;
                  }
                  if (trimmed !== survey.title) {
                    updateFieldMutation.mutate({ title: trimmed });
                  }
                  setEditingTitle(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  if (e.key === "Escape") { setTitleDraft(survey.title); setEditingTitle(false); }
                }}
              />
            ) : (
              <h1
                className={`text-2xl font-bold ${isDraft ? "cursor-pointer group/title" : ""}`}
                onClick={() => {
                  if (isDraft) {
                    setTitleDraft(survey.title);
                    setEditingTitle(true);
                  }
                }}
              >
                {survey.title}
                {isDraft && <Pencil className="inline-block h-3.5 w-3.5 ms-2 opacity-0 group-hover/title:opacity-50 transition-opacity" />}
              </h1>
            )}
            <Badge variant={config.variant}>
              <StatusIcon className="h-3 w-3 me-1" />
              {t(config.label)}
            </Badge>
            {(survey.status === "live" || survey.status === "paused") && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const link = `${window.location.origin}/s/${survey.id}`;
                    navigator.clipboard.writeText(link);
                    toast.success(t("surveys.detail.linkCopied"));
                  }}
                >
                  <Link2 className="h-3.5 w-3.5 me-1" />
                  {t("surveys.detail.copyLink")}
                </Button>
                {survey.status === "live" && (
                  <DistributeSurveyDialog surveyId={survey.id} surveyTitle={survey.title} />
                )}
              </>
            )}
            {isAutoCompleted && (
              <Badge variant="secondary" className="text-[11px]">
                {t("surveys.detail.autoCompleted")}
              </Badge>
            )}

            {/* === Draft: Go Live === */}
            {survey.status === "draft" && (
              <AlertDialog>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <AlertDialogTrigger asChild>
                        <Button size="sm" disabled={!canGoLive || statusMutation.isPending}>
                          <Rocket className="h-3.5 w-3.5 me-1" />
                          {t("surveys.detail.goLive")}
                        </Button>
                      </AlertDialogTrigger>
                    </span>
                  </TooltipTrigger>
                  {!canGoLive && (
                    <TooltipContent>{t("surveys.detail.needQuestions")}</TooltipContent>
                  )}
                </Tooltip>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("surveys.detail.confirmGoLiveTitle")}</AlertDialogTitle>
                    <AlertDialogDescription>{t("surveys.detail.confirmGoLiveDesc")}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleGoLive}>
                      {t("surveys.detail.goLive")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {/* === Live: Pause + Complete === */}
            {survey.status === "live" && (
              <>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" disabled={statusMutation.isPending}>
                      <PauseCircle className="h-3.5 w-3.5 me-1" />
                      {t("surveys.detail.pause")}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("surveys.detail.confirmPauseTitle")}</AlertDialogTitle>
                      <AlertDialogDescription>{t("surveys.detail.confirmPauseDesc")}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                      <AlertDialogAction onClick={handlePause}>
                        {t("surveys.detail.pause")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" disabled={statusMutation.isPending}>
                      <CheckCircle2 className="h-3.5 w-3.5 me-1" />
                      {t("surveys.detail.markCompleted")}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("surveys.detail.confirmCompleteTitle")}</AlertDialogTitle>
                      <AlertDialogDescription>{t("surveys.detail.confirmCompleteDesc")}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                      <AlertDialogAction onClick={handleComplete}>
                        {t("surveys.detail.markCompleted")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}

            {/* === Paused: Resume + Complete === */}
            {survey.status === "paused" && (
              <>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" disabled={statusMutation.isPending}>
                      <PlayCircle className="h-3.5 w-3.5 me-1" />
                      {t("surveys.detail.resume")}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("surveys.detail.confirmResumeTitle")}</AlertDialogTitle>
                      <AlertDialogDescription>{t("surveys.detail.confirmResumeDesc")}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                      <AlertDialogAction onClick={handleResume}>
                        {t("surveys.detail.resume")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" disabled={statusMutation.isPending}>
                      <CheckCircle2 className="h-3.5 w-3.5 me-1" />
                      {t("surveys.detail.markCompleted")}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("surveys.detail.confirmCompleteTitle")}</AlertDialogTitle>
                      <AlertDialogDescription>{t("surveys.detail.confirmCompleteDesc")}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                      <AlertDialogAction onClick={handleComplete}>
                        {t("surveys.detail.markCompleted")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}

            {/* === Completed: Reopen === */}
            {survey.status === "completed" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" disabled={statusMutation.isPending}>
                    <RotateCcw className="h-3.5 w-3.5 me-1" />
                    {t("surveys.detail.reopen")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("surveys.detail.confirmReopenTitle")}</AlertDialogTitle>
                    <AlertDialogDescription>{t("surveys.detail.confirmReopenDesc")}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleReopen}>
                      {t("surveys.detail.reopen")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
          {isDraft && editingDescription ? (
            <Textarea
              ref={descInputRef}
              value={descriptionDraft}
              onChange={(e) => setDescriptionDraft(e.target.value)}
              className="text-sm mt-1 max-w-lg"
              rows={2}
              onBlur={() => {
                const trimmed = descriptionDraft.trim();
                if (trimmed !== (survey.description || "")) {
                  updateFieldMutation.mutate({ description: trimmed || null });
                }
                setEditingDescription(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") { setDescriptionDraft(survey.description || ""); setEditingDescription(false); }
              }}
            />
          ) : isDraft ? (
            <p
              className="text-sm text-muted-foreground mt-1 cursor-pointer group/desc"
              onClick={() => {
                setDescriptionDraft(survey.description || "");
                setEditingDescription(true);
              }}
            >
              {survey.description || t("surveys.detail.addDescription")}
              <Pencil className="inline-block h-3 w-3 ms-1.5 opacity-0 group-hover/desc:opacity-50 transition-opacity" />
            </p>
          ) : survey.description ? (
            <p className="text-sm text-muted-foreground mt-1">{survey.description}</p>
          ) : null}
        </div>
      </div>

      {/* Progress + Timestamps */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>{survey.response_count} / {survey.target_responses} {t("surveys.responses")}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
          {/* Timestamps */}
          <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-xs text-muted-foreground">
            {survey.launched_at && (
              <span>{t("surveys.detail.launchedAt")}: {new Date(survey.launched_at).toLocaleDateString()}</span>
            )}
            {survey.completed_at && (
              <span>{t("surveys.detail.completedAt")}: {new Date(survey.completed_at).toLocaleDateString()}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Questions & Responses Tabs */}
      <Tabs defaultValue="questions">
        <TabsList>
          <TabsTrigger value="questions">{t("surveys.detail.questions")}</TabsTrigger>
          <TabsTrigger value="responses">
            {t("surveys.responses.tab")} ({survey.response_count})
          </TabsTrigger>
          <TabsTrigger value="analytics">
            {t("surveys.analytics.tab")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="questions" className="mt-4">
          <QuestionEditor
            questions={questions}
            surveyId={id!}
            workspaceId={survey.workspace_id}
            isDraft={survey.status === "draft"}
          />
        </TabsContent>
        <TabsContent value="responses" className="mt-4">
          <SurveyResponsesTab surveyId={id!} workspaceId={survey.workspace_id} />
        </TabsContent>
        <TabsContent value="analytics" className="mt-4">
          <SurveyAnalyticsTab surveyId={id!} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SurveyDetail;
