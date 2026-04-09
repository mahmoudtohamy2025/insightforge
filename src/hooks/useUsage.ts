import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useSubscription } from "@/hooks/useSubscription";
import {
  TIER_LIMITS,
  TIER_TOKEN_BUDGETS,
  getUsagePercent,
  getUsageStatus,
  canPerformAction,
  type TierResource,
} from "@/lib/tierLimits";

export interface UsageData {
  sessions: number;
  surveys: number;
  members: number;
  simulations: number;
  projects: number;
  tokensUsed: number;
  tokenBudget: number;
}

export function useUsage() {
  const { currentWorkspace } = useWorkspace();
  const { tier } = useSubscription();
  const workspaceId = currentWorkspace?.id;

  const { data: usage, isLoading } = useQuery({
    queryKey: ["workspace-usage", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null;

      const [sessions, surveys, members, simulations, projects, tokenUsage] = await Promise.all([
        supabase.from("sessions").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
        supabase.from("surveys").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
        supabase.from("workspace_members").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
        supabase.from("simulations").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
        supabase.from("projects").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId),
        // Token usage for current month
        supabase
          .from("workspace_token_usage")
          .select("tokens_used")
          .eq("workspace_id", workspaceId)
          .gte("period_start", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
          .maybeSingle(),
      ]);

      return {
        sessions: sessions.count || 0,
        surveys: surveys.count || 0,
        members: members.count || 0,
        simulations: simulations.count || 0,
        projects: projects.count || 0,
        tokensUsed: (tokenUsage.data as any)?.tokens_used || 0,
        tokenBudget: TIER_TOKEN_BUDGETS[tier] || 0,
      } as UsageData;
    },
    enabled: !!workspaceId,
    staleTime: 30_000, // Cache for 30s
  });

  const checkAction = (resource: TierResource, currentCount?: number) => {
    const count = currentCount ?? (usage ? (usage as any)[resource === "aiAnalysis" ? "simulations" : resource] || 0 : 0);
    return canPerformAction(tier, resource, count);
  };

  const getPercent = (resource: string) => {
    if (!usage) return 0;
    const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
    const limit = (limits as any)[resource];
    const current = (usage as any)[resource] || 0;
    return getUsagePercent(current, limit);
  };

  const getStatus = (resource: string) => {
    return getUsageStatus(getPercent(resource));
  };

  return {
    usage,
    isLoading,
    tier,
    checkAction,
    getPercent,
    getStatus,
  };
}
