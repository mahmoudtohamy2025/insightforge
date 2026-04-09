import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, FileQuestion, ChevronRight, ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { logActivity } from "@/lib/activityLogger";
import { SubmitRequirementDialog } from "@/components/requirements/SubmitRequirementDialog";

const STATUSES = ["submitted", "under_review", "approved", "in_progress", "insights_ready", "completed"] as const;
type RequirementStatus = typeof STATUSES[number];

const STATUS_LABELS: Record<RequirementStatus, string> = {
  submitted: "Submitted",
  under_review: "Under Review",
  approved: "Approved",
  in_progress: "In Progress",
  insights_ready: "Insights Ready",
  completed: "Completed",
};

const STATUS_COLORS: Record<RequirementStatus, string> = {
  submitted: "bg-muted text-muted-foreground",
  under_review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  approved: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  in_progress: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  insights_ready: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "destructive",
  high: "default",
  medium: "secondary",
  low: "outline",
};

const CATEGORY_LABELS: Record<string, string> = {
  product: "Product",
  market: "Market",
  ux: "UX",
  brand: "Brand",
  competitor: "Competitor",
  pricing: "Pricing",
  customer_experience: "CX",
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
          // Already voted — delete the vote (toggle)
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

  const filtered = requirements.filter((r: any) =>
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    (r.description || "").toLowerCase().includes(search.toLowerCase())
  );

  const byStatus = (status: RequirementStatus) =>
    filtered.filter((r: any) => r.status === status);

  const stats = {
    total: requirements.length,
    open: requirements.filter((r: any) => !["completed", "declined"].includes(r.status)).length,
    critical: requirements.filter((r: any) => r.priority === "critical").length,
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileQuestion className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Requirements</h1>
            <p className="text-sm text-muted-foreground">Track research needs from stakeholders to insights</p>
          </div>
        </div>
        <Button onClick={() => setSubmitOpen(true)}>
          <Plus className="h-4 w-4 me-2" />
          Submit Requirement
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total Requirements</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-blue-600">{stats.open}</div>
            <div className="text-xs text-muted-foreground">Open</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-destructive">{stats.critical}</div>
            <div className="text-xs text-muted-foreground">Critical Priority</div>
          </CardContent>
        </Card>
      </div>

      {/* Search + View Toggle */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search requirements..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Tabs value={view} onValueChange={(v) => setView(v as "kanban" | "list")}>
          <TabsList>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
            <TabsTrigger value="list">List</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Kanban view */}
      {view === "kanban" && (
        <div className="overflow-x-auto pb-4">
          {isLoading ? (
            <div className="flex gap-4">
              {STATUSES.map((s) => (
                <div key={s} className="w-72 shrink-0">
                  <Skeleton className="h-8 w-full mb-3" />
                  <Skeleton className="h-32 w-full mb-2" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex gap-4">
              {STATUSES.map((status) => {
                const cards = byStatus(status);
                return (
                  <div key={status} className="w-72 shrink-0">
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_COLORS[status]}`}>
                        {STATUS_LABELS[status]}
                      </span>
                      <span className="text-xs text-muted-foreground">{cards.length}</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {cards.length === 0 && (
                        <div className="border border-dashed rounded-lg p-4 text-xs text-muted-foreground text-center">
                          No requirements
                        </div>
                      )}
                      {cards.map((req: any) => (
                        <RequirementCard
                          key={req.id}
                          req={req}
                          onVote={() => voteMutation.mutate(req.id)}
                          onClick={() => navigate(`/requirements/${req.id}`)}
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

      {/* List view */}
      {view === "list" && (
        <div className="flex flex-col gap-2">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileQuestion className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No requirements yet. Submit the first one!</p>
            </div>
          ) : (
            filtered.map((req: any) => (
              <div
                key={req.id}
                className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                onClick={() => navigate(`/requirements/${req.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm truncate">{req.title}</span>
                    <Badge variant={PRIORITY_COLORS[req.priority] as any} className="text-xs shrink-0">
                      {req.priority}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[req.status as RequirementStatus] || ""}`}>
                      {STATUS_LABELS[req.status as RequirementStatus] || req.status}
                    </span>
                    {req.category && (
                      <span className="text-xs text-muted-foreground">{CATEGORY_LABELS[req.category] || req.category}</span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
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
      />
    </div>
  );
}

function RequirementCard({ req, onVote, onClick }: { req: any; onVote: () => void; onClick: () => void }) {
  const voteCount = req.requirement_votes?.[0]?.count ?? 0;

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-sm font-medium leading-snug line-clamp-2">{req.title}</p>
          <Badge variant={PRIORITY_COLORS[req.priority] as any} className="text-xs shrink-0">
            {req.priority}
          </Badge>
        </div>
        {req.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{req.description}</p>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {CATEGORY_LABELS[req.category] || req.category}
          </span>
          <button
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
            onClick={(e) => { e.stopPropagation(); onVote(); }}
          >
            <ArrowUp className="h-3 w-3" />
            {voteCount}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
