import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import {
  Building2, Users, Cpu, DollarSign, TrendingUp,
  Activity, AlertCircle, Clock, ArrowUpRight, Zap,
  CheckCircle2, XCircle, RefreshCw,
} from "lucide-react";
import { useEffect, useState } from "react";

// ── shared tiny components ────────────────────────────────────────
function KpiCard({
  icon: Icon, label, value, sub, color, onClick,
}: {
  icon: React.ElementType; label: string; value: string | number;
  sub?: string; color: string; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "bg-slate-900 border border-slate-800 rounded-xl p-5 text-left w-full transition-all duration-150 group",
        onClick && "hover:border-slate-700 hover:shadow-lg hover:shadow-black/20 cursor-pointer"
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        {onClick && (
          <ArrowUpRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 transition-colors" />
        )}
      </div>
      <div className="text-2xl font-bold text-white tabular-nums">{value}</div>
      <div className="text-xs text-slate-400 mt-0.5">{label}</div>
      {sub && <div className="text-[11px] text-slate-600 mt-1">{sub}</div>}
    </button>
  );
}

function Pulse({ healthy }: { healthy: boolean }) {
  return (
    <span className="relative flex h-2 w-2">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${healthy ? "bg-emerald-400" : "bg-red-400"}`} />
      <span className={`relative inline-flex rounded-full h-2 w-2 ${healthy ? "bg-emerald-500" : "bg-red-500"}`} />
    </span>
  );
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ");
}

const ACTION_LABELS: Record<string, string> = {
  membership_added: "Member joined",
  membership_removed: "Member removed",
  api_key_created: "API key created",
  simulation_run: "Simulation ran",
  data_exported: "Data exported",
};

// ── main component ────────────────────────────────────────────────
export default function AdminOverview() {
  const navigate = useNavigate();
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const { data: workspaces = [] } = useQuery({
    queryKey: ["admin-cc-workspaces"],
    queryFn: async () => {
      const { data } = await supabase.from("workspaces").select("id, tier, status, created_at");
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  const { data: memberships = [] } = useQuery({
    queryKey: ["admin-cc-memberships"],
    queryFn: async () => {
      const { data } = await supabase.from("workspace_memberships").select("user_id, workspace_id");
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  const { data: simulations = [] } = useQuery({
    queryKey: ["admin-cc-sims"],
    queryFn: async () => {
      const { data } = await supabase
        .from("simulations")
        .select("id, status, tokens_used, created_at, workspace_id")
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  const { data: tokenUsage = [] } = useQuery({
    queryKey: ["admin-cc-tokens"],
    queryFn: async () => {
      const { data } = await supabase
        .from("workspace_token_usage")
        .select("workspace_id, tokens_used, period_start");
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  const { data: disbursements = [] } = useQuery({
    queryKey: ["admin-cc-disbursements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incentive_disbursements")
        .select("id, status, amount_cents, created_at");
      if (error) return [];
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ["admin-cc-audit"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("id, action, workspace_id, created_at, details")
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
    refetchInterval: 15_000,
  });

  const { data: participants = [] } = useQuery({
    queryKey: ["admin-cc-participants"],
    queryFn: async () => {
      const { data } = await supabase.from("participants").select("id, workspace_id");
      return data ?? [];
    },
  });

  // Derived metrics
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 86400_000).toISOString();
  const oneDayAgo = new Date(now.getTime() - 86400_000).toISOString();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const uniqueUsers = new Set(memberships.map((m: any) => m.user_id)).size;
  const newWorkspaces7d = workspaces.filter((w: any) => w.created_at > oneWeekAgo).length;
  const simsToday = simulations.filter((s: any) => s.created_at > oneDayAgo).length;
  const failedSims = simulations.filter((s: any) => s.status === "failed").length;
  const tokensThisMonth = tokenUsage
    .filter((t: any) => t.period_start >= thisMonth)
    .reduce((s: number, t: any) => s + (t.tokens_used || 0), 0);
  const estimatedCost = ((tokensThisMonth / 1_000_000) * 0.40).toFixed(2);
  const pendingPayouts = disbursements.filter((d: any) => d.status === "awaiting_approval");
  const pendingPayoutTotal = pendingPayouts.reduce((s: number, d: any) => s + (d.amount_cents || 0), 0);

  const tierBreakdown = workspaces.reduce((acc: Record<string, number>, w: any) => {
    const t = w.tier || "free";
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});

  const paidTiers = (tierBreakdown.starter || 0) + (tierBreakdown.professional || 0) + (tierBreakdown.enterprise || 0);

  const systemHealth = failedSims < 5 && workspaces.length > 0;

  return (
    <div className="p-8 space-y-8 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Command Center</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Real-time platform health &amp; operations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Pulse healthy={systemHealth} />
            <span>{systemHealth ? "All systems operational" : "Issues detected"}</span>
          </div>
          <button
            onClick={() => setLastRefresh(new Date())}
            className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <span className="text-[11px] text-slate-600">
            Updated {lastRefresh.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={Building2}
          label="Total Workspaces"
          value={workspaces.length}
          sub={`${newWorkspaces7d} new this week · ${paidTiers} paid`}
          color="bg-gradient-to-br from-blue-500 to-blue-600"
          onClick={() => navigate("/admin/tenants")}
        />
        <KpiCard
          icon={Users}
          label="Registered Users"
          value={uniqueUsers}
          sub={`${participants.length} participants`}
          color="bg-gradient-to-br from-emerald-500 to-emerald-600"
          onClick={() => navigate("/admin/users")}
        />
        <KpiCard
          icon={Cpu}
          label="Tokens This Month"
          value={tokensThisMonth.toLocaleString()}
          sub={`~$${estimatedCost} est. cost`}
          color="bg-gradient-to-br from-violet-500 to-violet-600"
          onClick={() => navigate("/admin/ai-usage")}
        />
        <KpiCard
          icon={DollarSign}
          label="Pending Payouts"
          value={pendingPayouts.length}
          sub={`$${(pendingPayoutTotal / 100).toLocaleString()} awaiting approval`}
          color={pendingPayouts.length > 0 ? "bg-gradient-to-br from-amber-500 to-orange-500" : "bg-gradient-to-br from-slate-600 to-slate-700"}
          onClick={() => navigate("/admin/financials")}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={Zap}
          label="Simulations Today"
          value={simsToday}
          sub={`${simulations.length} total`}
          color="bg-gradient-to-br from-cyan-500 to-cyan-600"
          onClick={() => navigate("/admin/studies")}
        />
        <KpiCard
          icon={XCircle}
          label="Failed Simulations"
          value={failedSims}
          sub="Last 200 runs"
          color={failedSims > 10 ? "bg-gradient-to-br from-red-500 to-red-600" : "bg-gradient-to-br from-slate-600 to-slate-700"}
          onClick={() => navigate("/admin/studies")}
        />
        <KpiCard
          icon={TrendingUp}
          label="Paid Tier Tenants"
          value={paidTiers}
          sub={`${workspaces.length - paidTiers} on free`}
          color="bg-gradient-to-br from-indigo-500 to-indigo-600"
          onClick={() => navigate("/admin/tenants")}
        />
        <KpiCard
          icon={CheckCircle2}
          label="Active Workspaces"
          value={workspaces.filter((w: any) => w.status === "active").length}
          sub={`${workspaces.filter((w: any) => w.status !== "active").length} suspended`}
          color="bg-gradient-to-br from-teal-500 to-teal-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tier Distribution */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-slate-500" />
            Tier Distribution
          </h2>
          <div className="space-y-3">
            {[
              { tier: "enterprise", color: "bg-amber-500", label: "Enterprise" },
              { tier: "professional", color: "bg-purple-500", label: "Professional" },
              { tier: "starter", color: "bg-blue-500", label: "Starter" },
              { tier: "free", color: "bg-slate-600", label: "Free" },
            ].map(({ tier, color, label }) => {
              const count = tierBreakdown[tier] || 0;
              const pct = workspaces.length ? Math.round((count / workspaces.length) * 100) : 0;
              return (
                <div key={tier}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">{label}</span>
                    <span className="text-slate-300 font-mono">{count} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full">
                    <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Activity Feed */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-slate-500" />
            Live Activity Feed
            <Pulse healthy />
          </h2>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {auditLogs.length === 0 && (
              <div className="text-xs text-slate-600 text-center py-6">No recent activity</div>
            )}
            {auditLogs.map((log: any) => (
              <div
                key={log.id}
                className="flex items-center gap-3 text-xs py-2 border-b border-slate-800/50 last:border-0"
              >
                <div className="h-6 w-6 rounded-md bg-slate-800 flex items-center justify-center shrink-0">
                  <Activity className="h-3 w-3 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-slate-300">
                    {ACTION_LABELS[log.action] || log.action}
                  </span>
                  {log.workspace_id && (
                    <span className="text-slate-600 ml-1">
                      · ws/{log.workspace_id.slice(0, 6)}
                    </span>
                  )}
                </div>
                <span className="text-slate-600 shrink-0">
                  {new Date(log.created_at).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pending Approvals Alert */}
      {pendingPayouts.length > 0 && (
        <div
          className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center gap-4 cursor-pointer hover:bg-amber-500/15 transition-colors"
          onClick={() => navigate("/admin/financials")}
        >
          <AlertCircle className="h-5 w-5 text-amber-400 shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-medium text-amber-300">
              {pendingPayouts.length} payout{pendingPayouts.length > 1 ? "s" : ""} awaiting approval
            </div>
            <div className="text-xs text-amber-500 mt-0.5">
              Total value: ${(pendingPayoutTotal / 100).toLocaleString()} · Click to review
            </div>
          </div>
          <ArrowUpRight className="h-4 w-4 text-amber-400" />
        </div>
      )}

      {/* Recent Workspaces */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-500" />
            Recently Created Workspaces
          </h2>
          <button
            onClick={() => navigate("/admin/tenants")}
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
          >
            View all <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
        <div className="space-y-1">
          {workspaces
            .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 8)
            .map((ws: any) => {
              const count = memberships.filter((m: any) => m.workspace_id === ws.id).length;
              return (
                <div
                  key={ws.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-800/40 transition-colors cursor-pointer"
                  onClick={() => navigate(`/admin/tenants/${ws.id}`)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                    <span className="text-sm text-slate-300 truncate">{ws.id.slice(0, 8)}…</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      ws.tier === "enterprise" ? "bg-amber-500/20 text-amber-400" :
                      ws.tier === "professional" ? "bg-purple-500/20 text-purple-400" :
                      ws.tier === "starter" ? "bg-blue-500/20 text-blue-400" :
                      "bg-slate-700 text-slate-400"
                    }`}>
                      {ws.tier || "free"}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-xs text-slate-600">{count} member{count !== 1 ? "s" : ""}</span>
                    <span className="text-xs text-slate-600">
                      {new Date(ws.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
