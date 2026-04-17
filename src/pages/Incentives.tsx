import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Gift, Plus, Search, ChevronRight, DollarSign, TrendingUp, Users } from "lucide-react";
import { CreateProgramDialog } from "@/components/incentives/CreateProgramDialog";
import { FOUNDER_RESEARCH_HEADERS } from "@/lib/founderResearchCopy";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  paused: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  exhausted: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  closed: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

const TYPE_LABELS: Record<string, string> = {
  cash: "Cash",
  gift_card: "Gift Card",
  points: "Points",
  donation: "Donation",
  lottery: "Lottery",
  physical: "Physical Gift",
  custom: "Custom",
};

function formatCents(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

function getBudgetColor(pct: number) {
  if (pct >= 100) return "bg-destructive";
  if (pct >= 90) return "bg-red-500";
  if (pct >= 75) return "bg-yellow-500";
  return "bg-primary";
}

export default function Incentives() {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { isAdmin, isOwner } = useWorkspaceRole();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const workspaceId = currentWorkspace?.id;
  const canManage = isAdmin || isOwner;

  const { data: programs = [], isLoading, refetch } = useQuery({
    queryKey: ["incentive-programs", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from("incentive_programs")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!workspaceId,
  });

  const { data: disbursements = [] } = useQuery({
    queryKey: ["incentive-disbursements-summary", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from("incentive_disbursements")
        .select("status, amount_cents, currency")
        .eq("workspace_id", workspaceId);
      if (error) throw error;
      return data;
    },
    enabled: !!workspaceId,
  });

  const filtered = programs.filter((p: any) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalBudget = programs.reduce((sum: number, p: any) => sum + (p.total_budget_cents || 0), 0);
  const totalSpent = programs.reduce((sum: number, p: any) => sum + (p.spent_cents || 0), 0);
  const sentCount = disbursements.filter((d: any) => d.status === "sent").length;
  const claimedCount = disbursements.filter((d: any) => d.status === "claimed").length;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Gift className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">{FOUNDER_RESEARCH_HEADERS.rewards.title}</h1>
          </div>
        </div>
        {canManage && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 me-2" />
            Create reward program
          </Button>
        )}
      </div>

      <Card className="border-dashed border-primary/20 bg-primary/5">
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">{FOUNDER_RESEARCH_HEADERS.rewards.description}</p>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Total Budget</span>
            </div>
            <div className="text-xl font-bold">{formatCents(totalBudget)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Total Spent</span>
            </div>
            <div className="text-xl font-bold text-primary">{formatCents(totalSpent)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Gift className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Sent</span>
            </div>
            <div className="text-xl font-bold">{sentCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Claimed</span>
            </div>
            <div className="text-xl font-bold text-green-600">{claimedCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search reward programs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Programs */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Gift className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No reward programs yet</p>
          <p className="text-sm mt-1">Create a reward program to manage research payouts and keep budget under control.</p>
          {canManage && (
            <Button className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 me-2" />
              Create reward program
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((program: any) => {
            const spentPct = program.total_budget_cents > 0
              ? Math.min(100, Math.round((program.spent_cents / program.total_budget_cents) * 100))
              : 0;
            return (
              <Card
                key={program.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/incentives/${program.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base line-clamp-1">{program.name}</CardTitle>
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ms-2 ${STATUS_COLORS[program.status] || ""}`}>
                      {program.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {TYPE_LABELS[program.incentive_type] || program.incentive_type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{program.currency}</span>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Budget used</span>
                      <span className={spentPct >= 90 ? "text-destructive font-medium" : ""}>{spentPct}%</span>
                    </div>
                    <Progress value={spentPct} className={`h-2 [&>div]:${getBudgetColor(spentPct)}`} />
                    <div className="flex justify-between text-xs mt-1 text-muted-foreground">
                      <span>{formatCents(program.spent_cents, program.currency)} spent</span>
                      <span>{formatCents(program.total_budget_cents, program.currency)} total</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Default: {formatCents(program.default_amount_cents, program.currency)} / participant
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CreateProgramDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        workspaceId={workspaceId}
        userId={user?.id}
        onCreated={() => refetch()}
      />
    </div>
  );
}
