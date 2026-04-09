import { useI18n } from "@/lib/i18n";
import { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ClipboardList,
  Video,
  Users,
  Lightbulb,
  Plus,
  Calendar,
  Eye,
  UserPlus,
  FileQuestion,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { SampleDataCTA } from "@/components/dashboard/SampleDataCTA";
import { ResearchVelocityChart } from "@/components/dashboard/ResearchVelocityChart";
import { RecentSessionsCard } from "@/components/dashboard/RecentSessionsCard";
import { TrendingPatternsCard } from "@/components/dashboard/TrendingPatternsCard";

const quickActions = [
  { key: "dashboard.createSurvey", icon: Plus, path: "/surveys", color: "text-primary" },
  { key: "dashboard.scheduleSession", icon: Calendar, path: "/sessions", color: "text-accent" },
  { key: "dashboard.viewInsights", icon: Eye, path: "/insights", color: "text-success" },
  { key: "dashboard.managePanel", icon: UserPlus, path: "/participants", color: "text-warning" },
];

const Dashboard = () => {
  const { t } = useI18n();
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
      const [surveys, sessions, participants, insightPatterns] = await Promise.all([
        supabase.from("surveys").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
        supabase.from("sessions").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
        supabase.from("participants").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
        supabase.from("insight_patterns").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
      ]);
      const liveSessions = await supabase
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("status", "live");
      return {
        totalSurveys: surveys.count ?? 0,
        activeSessions: liveSessions.count ?? 0,
        totalParticipants: participants.count ?? 0,
        insightsGenerated: insightPatterns.count ?? 0,
      };
    },
    enabled: !!workspaceId,
  });

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "User";
  const initials = displayName.slice(0, 2).toUpperCase();

  const statCards = [
    { key: "dashboard.totalSurveys", value: stats?.totalSurveys ?? 0, icon: ClipboardList },
    { key: "dashboard.activeSessions", value: stats?.activeSessions ?? 0, icon: Video },
    { key: "dashboard.totalParticipants", value: stats?.totalParticipants ?? 0, icon: Users },
    { key: "dashboard.insightsGenerated", value: stats?.insightsGenerated ?? 0, icon: Lightbulb },
  ];

  return (
    <div className="space-y-6">
      {/* Full-screen onboarding wizard for new users */}
      {showWizard && (
        <OnboardingWizard onComplete={() => setShowWizard(false)} />
      )}
      {/* Auto-show wizard once for brand new users that haven't completed onboarding */}
      {profile && !profile.onboarding_completed_at && !wizardAutoShown.current && (() => {
        const createdAt = user?.created_at ? new Date(user.created_at) : null;
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (createdAt && createdAt > oneHourAgo) {
          wizardAutoShown.current = true;
          setTimeout(() => setShowWizard(true), 500);
        }
        return null;
      })()}

      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={profile?.avatar_url || undefined} alt={displayName} />
          <AvatarFallback className="bg-primary/10 text-primary text-sm">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
          <p className="text-muted-foreground text-sm">
            {t("dashboard.welcome")}, <span className="text-foreground font-medium">{displayName}</span>
          </p>
        </div>
      </div>

      {/* Onboarding Checklist */}
      <OnboardingChecklist />

      {/* Sample Data CTA — show when workspace has no sessions */}
      {stats && stats.activeSessions === 0 && (stats.totalSurveys ?? 0) === 0 && (
        <SampleDataCTA />
      )}

      {/* Stats Grid — real data */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.key} className="hover:shadow-card-hover transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t(stat.key)}</p>
                  <p className="text-3xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className="rounded-lg bg-primary/10 p-2.5">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Date Range Selector */}
      <div className="flex items-center gap-1 justify-end">
        {[7, 30, 90].map((d) => (
          <Button
            key={d}
            variant={days === d ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs px-3"
            onClick={() => setDays(d)}
          >
            {d}d
          </Button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Research Velocity Chart — spans 2 cols */}
        <ResearchVelocityChart days={days} />

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("dashboard.quickActions")}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {quickActions.map((action) => (
              <Button
                key={action.key}
                variant="outline"
                className="h-auto flex-col gap-2 py-4 hover:shadow-card-hover transition-all"
                onClick={() => navigate(action.path)}
              >
                <action.icon className={`h-5 w-5 ${action.color}`} />
                <span className="text-xs text-center">{t(action.key)}</span>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RecentSessionsCard />
        <TrendingPatternsCard />
      </div>

      {/* Open Requirements Summary */}
      <OpenRequirementsCard workspaceId={workspaceId} />
    </div>
  );
};

function OpenRequirementsCard({ workspaceId }: { workspaceId?: string }) {
  const navigate = useNavigate();
  const { data: openReqs = [] } = useQuery({
    queryKey: ["dashboard-open-requirements", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from("requirements")
        .select("id, title, priority, status, created_at")
        .eq("workspace_id", workspaceId)
        .not("status", "in", '("completed","declined")')
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) return [];
      return data;
    },
    enabled: !!workspaceId,
  });

  if (openReqs.length === 0) return null;

  const criticalCount = openReqs.filter((r: any) => r.priority === "critical").length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileQuestion className="h-4 w-4 text-primary" />
            Open Research Requirements
          </CardTitle>
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/requirements")}>
            View all
          </Button>
        </div>
        {criticalCount > 0 && (
          <p className="text-xs text-destructive">{criticalCount} critical requirement{criticalCount > 1 ? "s" : ""} need attention</p>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {openReqs.map((req: any) => (
          <div
            key={req.id}
            className="flex items-center justify-between p-2 rounded-md hover:bg-accent/50 cursor-pointer transition-colors"
            onClick={() => navigate(`/requirements/${req.id}`)}
          >
            <span className="text-sm truncate flex-1">{req.title}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ms-2 shrink-0 ${
              req.priority === "critical" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
              req.priority === "high" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" :
              "bg-muted text-muted-foreground"
            }`}>{req.priority}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default Dashboard;
