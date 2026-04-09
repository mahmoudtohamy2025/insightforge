import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Search, ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLogger";
import { parseTierLimitError } from "@/lib/tierLimitError";
import { SurveyCard, type Survey } from "@/components/surveys/SurveyCard";
import { CreateSurveyWizard, type GeneratedQuestion } from "@/components/surveys/CreateSurveyWizard";

const Surveys = () => {
  const { t } = useI18n();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { canCreate } = useWorkspaceRole();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);

  const workspaceId = currentWorkspace?.id;

  const { data: surveys = [], isLoading } = useQuery({
    queryKey: ["surveys", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from("surveys")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Survey[];
    },
    enabled: !!workspaceId,
  });

  const createMutation = useMutation({
    mutationFn: async (input: { title: string; description: string; targetResponses: number; projectId?: string; questions: GeneratedQuestion[] }) => {
      const { data: survey, error } = await supabase.from("surveys").insert({
        workspace_id: workspaceId!,
        title: input.title,
        description: input.description,
        target_responses: input.targetResponses,
        project_id: input.projectId || null,
        created_by: user?.id,
      }).select("id").single();
      if (error) throw error;

      if (input.questions.length > 0) {
        const { error: qError } = await supabase.from("survey_questions").insert(
          input.questions.map((q, i) => ({
            survey_id: survey.id,
            workspace_id: workspaceId!,
            question_text: q.question,
            question_type: q.type,
            options: q.options ? q.options : null,
            sort_order: i,
            required: true,
          }))
        );
        if (qError) throw qError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["surveys", workspaceId] });
      setWizardOpen(false);
      toast.success("Survey created successfully");
      if (workspaceId && user) {
        logActivity(workspaceId, user.id, "created", "survey");
      }
    },
    onError: (err: Error) => {
      const tierErr = parseTierLimitError(err);
      if (tierErr) {
        toast.error(t("billing.tierLimitTitle"), {
          description: t("billing.tierLimitReached")
            .replace("{resource}", t("surveys.title").toLowerCase())
            .replace("{tier}", t(`billing.${tierErr.currentTier}`)),
        });
      } else {
        toast.error(err.message);
      }
    },
  });

  const filteredSurveys = surveys.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase())
  );

  const countByStatus = (status: string) => filteredSurveys.filter((s) => s.status === status).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">{t("surveys.title")}</h1>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button onClick={() => setWizardOpen(true)} disabled={!canCreate}>
                <Plus className="h-4 w-4 me-2" />
                {t("surveys.create")}
              </Button>
            </span>
          </TooltipTrigger>
          {!canCreate && <TooltipContent>{t("observer.noPermission")}</TooltipContent>}
        </Tooltip>
      </div>

      <CreateSurveyWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onLaunch={(data) => createMutation.mutate(data)}
        isCreating={createMutation.isPending}
      />

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder={t("surveys.search")} value={search} onChange={(e) => setSearch(e.target.value)} className="ps-9" />
      </div>

      {/* Survey Cards */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 rounded-lg" />
          ))}
        </div>
      ) : (
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All ({filteredSurveys.length})</TabsTrigger>
            <TabsTrigger value="live">{t("surveys.live")} ({countByStatus("live")})</TabsTrigger>
            <TabsTrigger value="draft">{t("surveys.draft")} ({countByStatus("draft")})</TabsTrigger>
            <TabsTrigger value="paused">{t("surveys.paused")} ({countByStatus("paused")})</TabsTrigger>
            <TabsTrigger value="completed">{t("surveys.completed")} ({countByStatus("completed")})</TabsTrigger>
          </TabsList>

          {["all", "live", "draft", "paused", "completed"].map((tab) => (
            <TabsContent key={tab} value={tab} className="mt-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredSurveys
                  .filter((s) => tab === "all" || s.status === tab)
                  .map((survey) => (
                    <SurveyCard key={survey.id} survey={survey} />
                  ))}
              </div>
              {filteredSurveys.filter((s) => tab === "all" || s.status === tab).length === 0 && (
                <EmptyState
                  icon={ClipboardList}
                  title={t("surveys.noSurveys")}
                  description={t("surveys.createFirst")}
                  actionLabel={t("surveys.create")}
                  onAction={() => setWizardOpen(true)}
                />
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
};

export default Surveys;
