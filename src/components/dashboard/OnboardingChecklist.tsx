import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  Circle,
  Sparkles,
  Zap,
  Target,
  UserPlus,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ChecklistItem {
  key: string;
  label: string;
  description: string;
  icon: React.ElementType;
  path: string;
  done: boolean;
}

export function OnboardingChecklist() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const workspaceId = currentWorkspace?.id;

  // Check if onboarding already completed
  const { data: profile } = useQuery({
    queryKey: ["profile-onboarding", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("onboarding_completed_at")
        .eq("id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const { data: counts } = useQuery({
    queryKey: ["onboarding-counts", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return { twins: 0, simulations: 0, calibrations: 0, members: 0 };
      const [twins, simulations, calibrations, members] = await Promise.all([
        supabase.from("segment_profiles").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
        supabase.from("simulations").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
        supabase.from("calibration_data").select("id", { count: "exact", head: true }),
        supabase.from("workspace_memberships").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
      ]);
      return {
        twins: twins.count ?? 0,
        simulations: simulations.count ?? 0,
        calibrations: calibrations.count ?? 0,
        members: members.count ?? 0,
      };
    },
    enabled: !!workspaceId,
  });

  // Mark onboarding complete
  const completeOnboarding = useMutation({
    mutationFn: async () => {
      await supabase
        .from("profiles")
        .update({ onboarding_completed_at: new Date().toISOString() })
        .eq("id", user!.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-onboarding"] });
    },
  });

  // Hide if already completed
  if (profile?.onboarding_completed_at) return null;
  if (!counts) return null;

  const items: ChecklistItem[] = [
    {
      key: "twin",
      label: "Create a customer profile",
      description: "Describe the founder or buyer you most need to understand before you ship.",
      icon: Sparkles,
      path: "/segments",
      done: counts.twins > 0,
    },
    {
      key: "simulation",
      label: "Run an AI test",
      description: "Get a fast read on pricing, messaging, or onboarding before you spend more time.",
      icon: Zap,
      path: "/simulate",
      done: counts.simulations > 0,
    },
    {
      key: "validate",
      label: "Check with real customers",
      description: "Use surveys or interviews when the AI signal is not strong enough on its own.",
      icon: Target,
      path: "/validation",
      done: counts.calibrations > 0,
    },
    {
      key: "team",
      label: "Invite your team",
      description: "Bring cofounders, PMs, or teammates into the same decision flow.",
      icon: UserPlus,
      path: "/settings",
      done: counts.members > 1,
    },
  ];

  const completedCount = items.filter((i) => i.done).length;
  const progress = Math.round((completedCount / items.length) * 100);

  // Auto-mark complete when all done
  if (completedCount === items.length && !profile?.onboarding_completed_at) {
    completeOnboarding.mutate();
    return null;
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.03] to-purple-500/[0.02]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Set up your workspace</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => completeOnboarding.mutate()}
          >
            Dismiss
          </Button>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <Progress value={progress} className="h-2 flex-1" />
          <span className="text-xs text-muted-foreground font-medium">{completedCount}/{items.length}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => (
          <div
            key={item.key}
            className={`flex items-center gap-3 rounded-lg p-3 transition-colors ${
              item.done
                ? "bg-muted/50"
                : "bg-card hover:bg-muted/30 cursor-pointer border border-border/50"
            }`}
            onClick={() => !item.done && navigate(item.path)}
          >
            {item.done ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${item.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                {item.label}
              </p>
              <p className="text-xs text-muted-foreground">{item.description}</p>
            </div>
            {!item.done && (
              <Button size="sm" variant="ghost" className="shrink-0 text-primary">
                Start
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
