import { useMemo, useState } from "react";
import type { ElementType } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  FileQuestion,
  Gauge,
  Megaphone,
  ShieldCheck,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateStudyDialog } from "@/components/studies/CreateStudyDialog";
import {
  fetchPanelCommandCenter,
  formatPanelCurrency,
  mapRequirementToStudyDraft,
  type PanelRequirement,
  type StudyLaunchDraft,
} from "@/services/panelService";

const STATUS_COLORS: Record<string, string> = {
  submitted: "bg-muted text-muted-foreground",
  under_review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  approved: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  in_progress: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  insights_ready: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

const JOURNEY = [
  "Intake",
  "Methodology",
  "Audience",
  "Launch",
  "Fielding",
  "Review",
  "Payout",
  "Insight Closeout",
];

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = "default",
}: {
  icon: ElementType;
  label: string;
  value: string | number;
  detail: string;
  tone?: "default" | "warning" | "success";
}) {
  const toneClass = tone === "warning"
    ? "border-amber-200 dark:border-amber-800/40"
    : tone === "success"
      ? "border-emerald-200 dark:border-emerald-800/40"
      : "";
  return (
    <Card className={toneClass}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-bold">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
          </div>
          <div className="rounded-md bg-primary/10 p-2 text-primary">
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PipelineCard({ requirements, onCreateStudy }: {
  requirements: PanelRequirement[];
  onCreateStudy: (requirement: PanelRequirement) => void;
}) {
  const byStatus = useMemo(() => {
    const map = new Map<string, number>();
    for (const requirement of requirements) {
      const status = requirement.status || "submitted";
      map.set(status, (map.get(status) || 0) + 1);
    }
    return Array.from(map.entries());
  }, [requirements]);

  const nextRequirement = requirements.find((requirement) =>
    ["approved", "under_review", "submitted"].includes(requirement.status || "submitted")
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileQuestion className="h-4 w-4 text-primary" />
          Study Pipeline
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {byStatus.length === 0 ? (
            <div className="col-span-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No requirements yet. Start with a research question.
            </div>
          ) : byStatus.map(([status, count]) => (
            <div key={status} className="rounded-lg border p-3">
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[status] || "bg-muted text-muted-foreground"}`}>
                {status.replace(/_/g, " ")}
              </span>
              <p className="mt-2 text-xl font-bold">{count}</p>
            </div>
          ))}
        </div>
        {nextRequirement && (
          <div className="rounded-lg bg-muted/40 p-3">
            <p className="text-xs font-medium text-muted-foreground">Next launch candidate</p>
            <p className="mt-1 text-sm font-semibold">{nextRequirement.title}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => onCreateStudy(nextRequirement)}>
                <Megaphone className="h-3.5 w-3.5 me-1.5" />
                Create Study
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link to={`/requirements/${nextRequirement.id}`}>Review brief</Link>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Panel() {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const [studyOpen, setStudyOpen] = useState(false);
  const [initialDraft, setInitialDraft] = useState<Partial<StudyLaunchDraft> | null>(null);
  const workspaceId = currentWorkspace?.id;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["panel-command-center", workspaceId],
    queryFn: () => fetchPanelCommandCenter(workspaceId!),
    enabled: !!workspaceId,
  });

  const openStudyWizard = (requirement?: PanelRequirement) => {
    setInitialDraft(requirement ? mapRequirementToStudyDraft(requirement) : null);
    setStudyOpen(true);
  };

  if (!workspaceId) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-10 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <h1 className="text-lg font-semibold">Select a workspace to open panel operations</h1>
            <p className="mt-1 text-sm text-muted-foreground">Audience supply, fieldwork, incentives, and decision impact are scoped to a workspace.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-12 w-80" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-28" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-10 text-center">
            <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-destructive" />
            <h1 className="text-lg font-semibold">Panel operations could not load</h1>
            <p className="mt-1 text-sm text-muted-foreground">{(error as Error)?.message || "Refresh and try again."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const budgetUsedPct = data.stats.totalBudgetCents
    ? Math.min(100, Math.round((data.stats.spentBudgetCents / data.stats.totalBudgetCents) * 100))
    : 0;
  const openRequirements = data.requirements.filter((requirement) => !["completed", "declined"].includes(requirement.status || ""));
  const latestStudies = data.studies.slice(0, 5);
  const qualityLabel = data.stats.avgQualityScore >= 4.5 ? "Strong" : data.stats.avgQualityScore >= 3.5 ? "Watch" : "Needs attention";

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge variant="outline" className="mb-3">Participant Operations</Badge>
          <h1 className="text-3xl font-bold tracking-tight">Panel Command Center</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Turn research needs into the right audience, fair incentives, healthy fieldwork, approvals, payouts, and decision-ready evidence.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate("/requirements")}>
            <ClipboardList className="h-4 w-4 me-2" />
            Intake Pipeline
          </Button>
          <Button onClick={() => openStudyWizard()}>
            <Megaphone className="h-4 w-4 me-2" />
            Launch Study
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Megaphone}
          label="Active studies"
          value={data.stats.activeStudies}
          detail={`${data.stats.pendingApprovals} submissions need review`}
          tone={data.stats.pendingApprovals > 0 ? "warning" : "default"}
        />
        <MetricCard
          icon={Users}
          label="Audience supply"
          value={data.stats.totalParticipants + data.stats.marketplaceParticipants}
          detail={`${data.stats.totalParticipants} owned, ${data.stats.marketplaceParticipants} marketplace-visible`}
        />
        <MetricCard
          icon={Gauge}
          label="Recruitment health"
          value={`${data.stats.completionRate}%`}
          detail={`${data.stats.acceptanceRate}% capacity accepted`}
          tone={data.stats.completionRate >= 70 ? "success" : "default"}
        />
        <MetricCard
          icon={DollarSign}
          label="Pending payouts"
          value={formatPanelCurrency(data.stats.pendingPayoutCents)}
          detail={`${budgetUsedPct}% of incentive budget used`}
          tone={data.stats.exhaustedBudgets > 0 ? "warning" : "default"}
        />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-8">
            {JOURNEY.map((stage, index) => (
              <div key={stage} className="rounded-lg border bg-card p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                    {index + 1}
                  </span>
                  <span className="text-xs font-medium">{stage}</span>
                </div>
                <Progress value={index < 3 ? 100 : index === 3 && data.stats.activeStudies > 0 ? 60 : 20} className="h-1" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-primary" />
                Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border p-3">
                  <p className="text-sm font-semibold">{data.stats.pendingApprovals} approvals</p>
                  <p className="mt-1 text-xs text-muted-foreground">Submitted work waiting for researcher review.</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-sm font-semibold">{data.stats.studiesAtRisk} studies at risk</p>
                  <p className="mt-1 text-xs text-muted-foreground">Low fill or closing soon.</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-sm font-semibold">{data.stats.exhaustedBudgets} budget issues</p>
                  <p className="mt-1 text-xs text-muted-foreground">Programs exhausted or fully consumed.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Active Fieldwork
                </CardTitle>
                <Button size="sm" variant="outline" asChild>
                  <Link to="/participants">Audience CRM <ArrowRight className="h-3.5 w-3.5 ms-1.5" /></Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {latestStudies.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center">
                  <Target className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                  <p className="font-medium">No active fieldwork yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">Create a study from a requirement or launch one directly.</p>
                  <Button className="mt-4" onClick={() => openStudyWizard()}>
                    <Megaphone className="h-4 w-4 me-2" />
                    Launch Study
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Study</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Fill</TableHead>
                      <TableHead>Reward</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {latestStudies.map((study) => {
                      const fillPct = study.max_participants
                        ? Math.round((Number(study.current_participants || 0) / Number(study.max_participants)) * 100)
                        : 0;
                      return (
                        <TableRow key={study.id}>
                          <TableCell>
                            <p className="font-medium">{study.title}</p>
                            <p className="text-xs text-muted-foreground">{study.study_type?.replace(/_/g, " ")}</p>
                          </TableCell>
                          <TableCell><Badge variant="outline">{study.status}</Badge></TableCell>
                          <TableCell>
                            <div className="min-w-32">
                              <Progress value={fillPct} className="h-1.5" />
                              <p className="mt-1 text-xs text-muted-foreground">{study.current_participants || 0}/{study.max_participants || 0}</p>
                            </div>
                          </TableCell>
                          <TableCell>{formatPanelCurrency(Number(study.reward_amount_cents || 0))}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <PipelineCard requirements={openRequirements} onCreateStudy={openStudyWizard} />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Audience Supply
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Owned participant quality</span>
                <Badge variant={qualityLabel === "Strong" ? "secondary" : "outline"}>{qualityLabel}</Badge>
              </div>
              <Progress value={Math.min(100, (data.stats.avgQualityScore / 5) * 100)} className="h-2" />
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <p className="text-xl font-bold">{data.stats.totalParticipants}</p>
                  <p className="text-xs text-muted-foreground">Owned participants</p>
                </div>
                <div>
                  <p className="text-xl font-bold">{data.stats.marketplaceParticipants}</p>
                  <p className="text-xs text-muted-foreground">Marketplace profiles</p>
                </div>
              </div>
              <Button className="w-full" variant="outline" asChild>
                <Link to="/participants">Open Audience CRM</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Decision Impact
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold">{data.stats.completedRequirements}</span>
                <span className="pb-1 text-sm text-muted-foreground">requirements closed</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Link completed studies back to requirements so founders see which product, pricing, or GTM decisions were changed by evidence.
              </p>
              <Button className="w-full" variant="outline" asChild>
                <Link to="/requirements">Close out insights</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {workspaceId && (
        <CreateStudyDialog
          open={studyOpen}
          onOpenChange={setStudyOpen}
          workspaceId={workspaceId}
          initialDraft={initialDraft}
        />
      )}
    </div>
  );
}
