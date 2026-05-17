import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowUp,
  Compass,
  FileQuestion,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { SubmitRequirementDialog } from "@/components/requirements/SubmitRequirementDialog";
import {
  FOUNDER_DECISION_TEMPLATES,
  estimateDecisionConfidence,
  getConfidenceMeta,
} from "@/lib/founderDecision";

const STATUSES = ["submitted", "under_review", "approved", "in_progress", "insights_ready", "completed"] as const;
type RequirementStatus = typeof STATUSES[number];

const STATUS_LABELS: Record<RequirementStatus, string> = {
  submitted: "Captured",
  under_review: "Scoping",
  approved: "Ready to test",
  in_progress: "Running",
  insights_ready: "Memo ready",
  completed: "Closed",
};

const STATUS_COLORS: Record<RequirementStatus, string> = {
  submitted: "bg-muted text-muted-foreground",
  under_review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  approved: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  in_progress: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  insights_ready: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

const CATEGORY_LABELS: Record<string, string> = {
  product: "Feature bet",
  market: "Market",
  ux: "Onboarding",
  brand: "Messaging",
  competitor: "Competitor",
  pricing: "Pricing",
  customer_experience: "Retention",
  general: "General",
};

export default function Requirements() {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [submitOpen, setSubmitOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const workspaceId = currentWorkspace?.id;

  const { data: requirements = [], isLoading } = useQuery({
    queryKey: ["requirements", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from("requirements")
        .select("*, requirement_votes(count)")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!workspaceId,
  });

  const voteMutation = useMutation({
    mutationFn: async (requirementId: string) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("requirement_votes")
        .insert({ requirement_id: requirementId, user_id: user.id });

      if (error) {
        if (error.code === "23505") {
          await supabase
            .from("requirement_votes")
            .delete()
            .eq("requirement_id", requirementId)
            .eq("user_id", user.id);
        } else {
          throw error;
        }
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["requirements", workspaceId] }),
  });

  const filtered = useMemo(
    () =>
      requirements.filter((requirement: any) =>
        requirement.title.toLowerCase().includes(search.toLowerCase()) ||
        (requirement.description || "").toLowerCase().includes(search.toLowerCase()) ||
        (requirement.business_context || "").toLowerCase().includes(search.toLowerCase())
      ),
    [requirements, search]
  );

  const byStatus = (status: RequirementStatus) =>
    filtered.filter((requirement: any) => requirement.status === status);

  const stats = {
    total: requirements.length,
    open: requirements.filter((requirement: any) => !["completed", "declined"].includes(requirement.status)).length,
    critical: requirements.filter((requirement: any) => requirement.priority === "critical").length,
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3">
            <FileQuestion className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Decisions</h1>
              <p className="text-sm text-muted-foreground">
                Keep track of pricing, messaging, onboarding, and feature decisions. Start with an AI test, then move to real-customer checks when needed.
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={() => {
            setSelectedTemplateId(null);
            setSubmitOpen(true);
          }}
        >
          <Plus className="me-2 h-4 w-4" />
          Add decision
        </Button>
      </div>

      <section className="rounded-[28px] border border-border/70 bg-muted/20 p-6">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-emerald-600" />
          <div>
            <h2 className="text-lg font-semibold">Start with a template</h2>
            <p className="text-sm text-muted-foreground">
              Use a ready-made starting point for the founder jobs people usually tackle first.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {FOUNDER_DECISION_TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => {
                setSelectedTemplateId(template.id);
                setSubmitOpen(true);
              }}
              className="rounded-[24px] border border-border/70 bg-background p-5 text-left transition hover:border-emerald-500/30"
            >
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">
                {template.category}
              </div>
              <h3 className="mt-3 text-lg font-medium">{template.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{template.description}</p>
            </button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard title="Total decisions" value={stats.total} />
        <MetricCard title="Open decisions" value={stats.open} tone="blue" />
        <MetricCard title="High-risk decisions" value={stats.critical} tone="rose" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search decisions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Tabs value={view} onValueChange={(value) => setView(value as "kanban" | "list")}>
            <TabsList>
            <TabsTrigger value="kanban">Board</TabsTrigger>
            <TabsTrigger value="list">List</TabsTrigger>
            </TabsList>
          </Tabs>
      </div>

      {view === "kanban" && (
        <div className="overflow-x-auto pb-4">
          {isLoading ? (
            <div className="flex gap-4">
              {STATUSES.map((status) => (
                <div key={status} className="w-80 shrink-0">
                  <Skeleton className="mb-3 h-8 w-full" />
                  <Skeleton className="mb-2 h-36 w-full" />
                  <Skeleton className="h-36 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex gap-4">
              {STATUSES.map((status) => {
                const cards = byStatus(status);
                return (
                  <div key={status} className="w-80 shrink-0">
                    <div className="mb-3 flex items-center justify-between">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${STATUS_COLORS[status]}`}>
                        {STATUS_LABELS[status]}
                      </span>
                      <span className="text-xs text-muted-foreground">{cards.length}</span>
                    </div>

                    <div className="flex flex-col gap-3">
                      {cards.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-border/70 p-4 text-center text-xs text-muted-foreground">
                          No decisions in this step yet
                        </div>
                      )}

                      {cards.map((requirement: any) => (
                        <DecisionCard
                          key={requirement.id}
                          requirement={requirement}
                          onVote={() => voteMutation.mutate(requirement.id)}
                          onClick={() => navigate(`/requirements/${requirement.id}`)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {view === "list" && (
        <div className="flex flex-col gap-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-20 w-full" />)
          ) : filtered.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-border/70 py-12 text-center text-muted-foreground">
              <Compass className="mx-auto mb-3 h-10 w-10 opacity-30" />
              <p>No decisions yet. Add the first one you want help with.</p>
            </div>
          ) : (
            filtered.map((requirement: any) => (
              <button
                key={requirement.id}
                onClick={() => navigate(`/requirements/${requirement.id}`)}
                className="flex items-center gap-4 rounded-[24px] border border-border/70 p-5 text-left transition hover:border-emerald-500/30"
              >
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{requirement.title}</span>
                    <Badge variant="outline" className="text-xs">
                      {CATEGORY_LABELS[requirement.category] || requirement.category || "General"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {requirement.description || requirement.business_context || "No summary yet."}
                  </p>
                </div>
                <div className="min-w-[140px] text-right">
                  <div className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getConfidenceMeta(estimateDecisionConfidence(requirement)).badgeClassName}`}>
                    {getConfidenceMeta(estimateDecisionConfidence(requirement)).label}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">{STATUS_LABELS[requirement.status as RequirementStatus] || requirement.status}</div>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      <SubmitRequirementDialog
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        workspaceId={workspaceId}
        userId={user?.id}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ["requirements", workspaceId] })}
        templateId={selectedTemplateId}
      />
    </div>
  );
}

function MetricCard({
  title,
  value,
  tone = "default",
}: {
  title: string;
  value: number;
  tone?: "default" | "blue" | "rose";
}) {
  const valueClassName =
    tone === "blue"
      ? "text-blue-600"
      : tone === "rose"
        ? "text-rose-600 dark:text-rose-400"
        : "text-foreground";

  return (
    <Card>
      <CardContent className="pt-5">
        <div className={`text-3xl font-semibold ${valueClassName}`}>{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{title}</div>
      </CardContent>
    </Card>
  );
}

function DecisionCard({
  requirement,
  onVote,
  onClick,
}: {
  requirement: any;
  onVote: () => void;
  onClick: () => void;
}) {
  const confidence = getConfidenceMeta(estimateDecisionConfidence(requirement));

  return (
    <div
      className="rounded-[24px] border border-border/70 bg-background p-4 shadow-sm transition hover:border-emerald-500/30"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onClick();
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="text-sm font-medium leading-6">{requirement.title}</div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {CATEGORY_LABELS[requirement.category] || requirement.category || "General"}
            </Badge>
            <span className={`rounded-full px-3 py-1 text-[11px] font-medium ${confidence.badgeClassName}`}>
              {confidence.label}
            </span>
          </div>
        </div>

        <button
          className="flex items-center gap-1 rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
          onClick={(event) => {
            event.stopPropagation();
            onVote();
          }}
        >
          <ArrowUp className="h-3 w-3" />
          {requirement.requirement_votes?.[0]?.count ?? 0}
        </button>
      </div>

      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {requirement.description || requirement.business_context || "No supporting context yet."}
      </p>

      <div className={`mt-4 rounded-2xl border p-3 text-xs ${confidence.railClassName}`}>
        <div className="flex items-center gap-2 font-medium">
          <ShieldCheck className="h-3.5 w-3.5" />
          {confidence.ctaLabel}
        </div>
        <div className="mt-1 text-muted-foreground">{confidence.summary}</div>
      </div>
    </div>
  );
}
