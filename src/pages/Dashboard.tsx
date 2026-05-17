import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  FlaskConical,
  FolderKanban,
  Lightbulb,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { SampleDataCTA } from "@/components/dashboard/SampleDataCTA";
import { ResearchVelocityChart } from "@/components/dashboard/ResearchVelocityChart";
import { RecentSessionsCard } from "@/components/dashboard/RecentSessionsCard";
import { TrendingPatternsCard } from "@/components/dashboard/TrendingPatternsCard";
import { FOUNDER_DECISION_TEMPLATES, getConfidenceMeta } from "@/lib/founderDecision";

const decisionWorkstreams = [
  {
    title: "Run an AI test",
    description: "Get a fast read on pricing, messaging, onboarding, or product ideas.",
    route: "/simulate",
    icon: FlaskConical,
  },
  {
    title: "Run a panel discussion",
    description: "See how multiple customer profiles react when one AI test is not enough.",
    route: "/focus-group",
    icon: Lightbulb,
  },
  {
    title: "Talk to real customers",
    description: "Use surveys and interviews when you need proof from real people.",
    route: "/surveys",
    icon: Compass,
  },
  {
    title: "Track decisions",
    description: "Keep every open product and growth decision in one place.",
    route: "/requirements",
    icon: FolderKanban,
  },
];

export default function Dashboard() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const workspaceId = currentWorkspace?.id;
  const [days, setDays] = useState(30);
  const [showWizard, setShowWizard] = useState(false);
  const wizardAutoShown = useRef(false);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, onboarding_completed_at")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;
      const [surveys, sessions, participants, insightPatterns, simulations, requirements, requirementStates] = await Promise.all([
        supabase.from("surveys").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
        supabase.from("sessions").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
        supabase.from("participants").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
        supabase.from("insight_patterns").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
        supabase.from("simulations").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
        supabase.from("requirements").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
        supabase
          .from("requirements")
          .select("confidence_score, status")
          .eq("workspace_id", workspaceId)
          .not("status", "in", '("completed","declined")'),
      ]);

      const liveSessions = await supabase
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("status", "live");

      const confidenceRows = requirementStates.data ?? [];
      const averageOpenConfidence =
        confidenceRows.length > 0
          ? confidenceRows.reduce((sum, row: any) => sum + (row.confidence_score ?? 0.52), 0) / confidenceRows.length
          : null;

      return {
        totalSurveys: surveys.count ?? 0,
        liveSessions: liveSessions.count ?? 0,
        totalParticipants: participants.count ?? 0,
        insightsGenerated: insightPatterns.count ?? 0,
        simulations: simulations.count ?? 0,
        requirements: requirements.count ?? 0,
        averageOpenConfidence,
      };
    },
    enabled: !!workspaceId,
  });

  const { data: openDecisions = [] } = useQuery({
    queryKey: ["dashboard-open-decisions", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from("requirements")
        .select("id, title, priority, status, created_at, category")
        .eq("workspace_id", workspaceId)
        .not("status", "in", '("completed","declined")')
        .order("created_at", { ascending: false })
        .limit(4);
      if (error) return [];
      return data;
    },
    enabled: !!workspaceId,
  });

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "Founder";
  const initials = displayName.slice(0, 2).toUpperCase();

  const confidenceScore =
    stats?.averageOpenConfidence ??
    Math.min(
      0.92,
      0.34 +
        (stats?.simulations || 0) * 0.06 +
        (stats?.totalSurveys || 0) * 0.05 +
        (stats?.totalParticipants || 0) * 0.03 +
        (stats?.insightsGenerated || 0) * 0.04
    );
  const confidence = getConfidenceMeta(confidenceScore);

  useEffect(() => {
    if (!profile || profile.onboarding_completed_at || wizardAutoShown.current) return;
    const createdAt = user?.created_at ? new Date(user.created_at) : null;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (createdAt && createdAt > oneHourAgo) {
      wizardAutoShown.current = true;
      const timeoutId = window.setTimeout(() => setShowWizard(true), 500);
      return () => window.clearTimeout(timeoutId);
    }
  }, [profile, user?.created_at]);

  return (
    <div className="space-y-6">
      {showWizard && <OnboardingWizard onComplete={() => setShowWizard(false)} />}

      <div className="rounded-[32px] border border-border/70 bg-[linear-gradient(135deg,rgba(16,185,129,0.08),rgba(14,165,233,0.04),rgba(255,255,255,0))] p-6 sm:p-8">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="flex items-center gap-3">
              <Avatar className="h-11 w-11">
                <AvatarImage src={profile?.avatar_url || undefined} alt={displayName} />
                <AvatarFallback className="bg-primary/10 text-primary text-sm">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600">
                  Your workspace
                </div>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight">Welcome back, {displayName}</h1>
              </div>
            </div>

            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
              Use this workspace to track important decisions, test ideas quickly, and know when you have enough proof to move.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="rounded-full px-6" onClick={() => navigate("/requirements")}>
                Open decisions
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="rounded-full px-6" onClick={() => navigate("/simulate")}>
                Run an AI test
              </Button>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <MetricChip label="Open decisions" value={stats?.requirements ?? 0} />
              <MetricChip label="AI tests" value={stats?.simulations ?? 0} />
              <MetricChip label="Real customer inputs" value={(stats?.totalSurveys ?? 0) + (stats?.liveSessions ?? 0)} />
            </div>
          </div>

          <div className="rounded-[28px] border border-border/70 bg-background/70 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Decision confidence</div>
                <div className="mt-2 text-2xl font-semibold">{confidence.label}</div>
              </div>
              <div className={`rounded-full px-4 py-2 text-sm font-medium ${confidence.badgeClassName}`}>
                {Math.round(confidenceScore * 100)}%
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">{confidence.summary}</p>

            <div className="mt-6 space-y-3">
              <ConfidenceStep label="AI tests run" state={(stats?.simulations ?? 0) > 0} />
              <ConfidenceStep label="Real customer checks" state={(stats?.totalSurveys ?? 0) + (stats?.liveSessions ?? 0) > 0} />
              <ConfidenceStep label="Patterns found" state={(stats?.insightsGenerated ?? 0) > 0} />
            </div>
          </div>
        </div>
      </div>

      <OnboardingChecklist />

      {stats && stats.liveSessions === 0 && (stats.totalSurveys ?? 0) === 0 && <SampleDataCTA />}

      <section className="grid gap-4 lg:grid-cols-4">
        {decisionWorkstreams.map((workstream) => (
          <button
            key={workstream.title}
            onClick={() => navigate(workstream.route)}
            className="rounded-[24px] border border-border/70 bg-background p-5 text-left shadow-sm transition hover:border-emerald-500/30 hover:shadow-md"
          >
            <workstream.icon className="h-5 w-5 text-emerald-600" />
            <h2 className="mt-4 text-lg font-medium">{workstream.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{workstream.description}</p>
          </button>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Suggested starting points</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            {FOUNDER_DECISION_TEMPLATES.map((template) => (
              <div key={template.id} className="rounded-2xl border border-border/70 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{template.category}</div>
                <div className="mt-2 text-base font-medium">{template.title}</div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{template.description}</p>
                <Button variant="ghost" className="mt-3 h-auto px-0 text-emerald-700 dark:text-emerald-400" onClick={() => navigate("/requirements")}>
                  Add to decisions
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Open decisions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {openDecisions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 p-6 text-sm text-muted-foreground">
                Add your first pricing, messaging, or onboarding decision to start building a record of what you learn.
              </div>
            ) : (
              openDecisions.map((decision: any) => (
                <button
                  key={decision.id}
                  onClick={() => navigate(`/requirements/${decision.id}`)}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border/70 p-4 text-left transition hover:border-emerald-500/30"
                >
                  <div>
                    <div className="text-sm font-medium">{decision.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {(decision.category || "general").replace("_", " ")} · {decision.status.replace("_", " ")}
                    </div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-medium ${
                    decision.priority === "critical"
                      ? "bg-rose-500/10 text-rose-700 dark:text-rose-400"
                      : decision.priority === "high"
                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                        : "bg-muted text-muted-foreground"
                  }`}>
                    {decision.priority}
                  </span>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <div className="flex items-center justify-end gap-1">
        {[7, 30, 90].map((d) => (
          <Button
            key={d}
            variant={days === d ? "default" : "ghost"}
            size="sm"
            className="h-7 px-3 text-xs"
            onClick={() => setDays(d)}
          >
            {d}d
          </Button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <ResearchVelocityChart days={days} />
        <FounderOpsCard
          onBacklog={() => navigate("/requirements")}
          onValidation={() => navigate("/validation")}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RecentSessionsCard />
        <TrendingPatternsCard />
      </div>
    </div>
  );
}

function MetricChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function ConfidenceStep({ label, state }: { label: string; state: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/70 px-4 py-3 text-sm">
      {state ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
      ) : (
        <Target className="h-4 w-4 text-muted-foreground" />
      )}
      <span>{label}</span>
    </div>
  );
}

function FounderOpsCard({
  onBacklog,
  onValidation,
}: {
  onBacklog: () => void;
  onValidation: () => void;
}) {
  return (
      <Card>
        <CardHeader className="pb-3">
        <CardTitle className="text-base">How to move a decision forward</CardTitle>
        </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-2xl border border-border/70 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-emerald-600" />
            Step 1: run an AI test
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Get a fast directional read before you spend time talking to real customers.</p>
        </div>
        <div className="rounded-2xl border border-border/70 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Users className="h-4 w-4 text-sky-600" />
            Step 2: check with real customers
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Use surveys, interviews, or participants when you need stronger proof.</p>
        </div>
        <div className="rounded-2xl border border-border/70 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="h-4 w-4 text-purple-600" />
            Step 3: share the recommendation
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Turn the evidence into a simple recommendation your team can review and act on.</p>
        </div>

        <div className="flex flex-col gap-3 pt-2">
          <Button onClick={onBacklog}>Open decisions</Button>
          <Button variant="outline" onClick={onValidation}>Review real-world accuracy</Button>
        </div>
      </CardContent>
    </Card>
  );
}
