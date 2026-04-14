import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Cpu, TrendingDown, Zap, Building2, AlertTriangle } from "lucide-react";

// Tier token limits (monthly)
const TIER_LIMITS: Record<string, number> = {
  free: 50_000,
  starter: 250_000,
  professional: 1_000_000,
  enterprise: 10_000_000,
};

// Estimated cost per token (blended Gemini price)
const COST_PER_TOKEN = 0.0000004; // $0.40 / 1M

export default function AdminAIUsage() {
  const { data: usagePeriods = [] } = useQuery({
    queryKey: ["admin-ai-periods"],
    queryFn: async () => {
      const { data } = await supabase
        .from("workspace_token_usage")
        .select("workspace_id, period_start, tokens_used, request_count")
        .order("period_start", { ascending: false });
      return data ?? [];
    },
  });

  const { data: usageLogs = [] } = useQuery({
    queryKey: ["admin-ai-logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("workspace_token_usage_log")
        .select("workspace_id, tokens_used, created_at")
        .order("created_at", { ascending: false })
        .limit(1000);
      return data ?? [];
    },
  });

  const { data: workspaces = [] } = useQuery({
    queryKey: ["admin-ws-tiers"],
    queryFn: async () => {
      const { data } = await supabase.from("workspaces").select("id, name, slug, tier");
      return data ?? [];
    },
  });

  const { data: simulations = [] } = useQuery({
    queryKey: ["admin-ai-sims"],
    queryFn: async () => {
      const { data } = await supabase
        .from("simulations")
        .select("type, tokens_used, duration_ms, created_at")
        .not("tokens_used", "is", null)
        .order("created_at", { ascending: false })
        .limit(500);
      return data ?? [];
    },
  });

  const wsMap = workspaces.reduce((a: Record<string, any>, w: any) => { a[w.id] = w; return a; }, {});

  // This month
  const thisMonth = new Date();
  const periodStart = `${thisMonth.getFullYear()}-${String(thisMonth.getMonth() + 1).padStart(2, "0")}-01`;

  const thisMonthUsage = usagePeriods.filter((u: any) => u.period_start >= periodStart);
  const totalTokensThisMonth = thisMonthUsage.reduce((s: number, u: any) => s + (u.tokens_used || 0), 0);
  const totalRequestsThisMonth = thisMonthUsage.reduce((s: number, u: any) => s + (u.request_count || 0), 0);
  const estimatedCost = totalTokensThisMonth * COST_PER_TOKEN;

  // Per-workspace usage this month
  const wsUsageMap: Record<string, number> = {};
  const wsRequestMap: Record<string, number> = {};
  thisMonthUsage.forEach((u: any) => {
    wsUsageMap[u.workspace_id] = (wsUsageMap[u.workspace_id] || 0) + (u.tokens_used || 0);
    wsRequestMap[u.workspace_id] = (wsRequestMap[u.workspace_id] || 0) + (u.request_count || 0);
  });

  // All-time per-workspace
  const allTimeMap: Record<string, number> = {};
  usagePeriods.forEach((u: any) => {
    allTimeMap[u.workspace_id] = (allTimeMap[u.workspace_id] || 0) + (u.tokens_used || 0);
  });

  const wsUsageRows = Object.entries(wsUsageMap)
    .map(([wsId, tokens]) => {
      const ws = wsMap[wsId] || {};
      const limit = TIER_LIMITS[ws.tier || "free"];
      const pct = Math.min(Math.round((tokens / limit) * 100), 100);
      return { wsId, name: ws.name || ws.slug || wsId.slice(0, 8), tier: ws.tier || "free", tokens, limit, pct, requests: wsRequestMap[wsId] || 0 };
    })
    .sort((a, b) => b.tokens - a.tokens);

  // Hourly distribution from logs
  const hourMap: Record<number, number> = {};
  usageLogs.forEach((l: any) => {
    const h = new Date(l.created_at).getHours();
    hourMap[h] = (hourMap[h] || 0) + 1;
  });
  const maxHourCount = Math.max(...Object.values(hourMap), 1);

  // By simulation type
  const typeMap: Record<string, { count: number; tokens: number }> = {};
  simulations.forEach((s: any) => {
    if (!typeMap[s.type]) typeMap[s.type] = { count: 0, tokens: 0 };
    typeMap[s.type].count++;
    typeMap[s.type].tokens += s.tokens_used || 0;
  });

  // Workspaces over 80% limit
  const atRisk = wsUsageRows.filter(w => w.pct >= 80);

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">AI & Token Usage</h1>
        <p className="text-slate-500 text-sm mt-0.5">Monitor AI consumption and cost across all workspaces</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Tokens This Month", value: totalTokensThisMonth.toLocaleString(), sub: "", icon: Cpu, color: "bg-violet-500" },
          { label: "Estimated Cost", value: `$${estimatedCost.toFixed(4)}`, sub: "@$0.40/1M tokens", icon: TrendingDown, color: "bg-blue-500" },
          { label: "API Requests", value: totalRequestsThisMonth.toLocaleString(), sub: "this month", icon: Zap, color: "bg-teal-500" },
          { label: "At Risk Tenants", value: atRisk.length, sub: "over 80% quota", icon: AlertTriangle, color: atRisk.length > 0 ? "bg-amber-500" : "bg-slate-600" },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className={`h-9 w-9 rounded-lg ${color} flex items-center justify-center mb-3`}>
              <Icon className="h-4 w-4 text-white" />
            </div>
            <div className="text-2xl font-bold text-white tabular-nums">{value}</div>
            <div className="text-xs text-slate-400 mt-0.5">{label}</div>
            {sub && <div className="text-[11px] text-slate-600 mt-0.5">{sub}</div>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Hourly heatmap */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Request Heatmap (Hour of Day)</h2>
          <div className="flex items-end gap-1 h-20">
            {Array.from({ length: 24 }, (_, h) => {
              const count = hourMap[h] || 0;
              const heightPct = maxHourCount > 0 ? (count / maxHourCount) * 100 : 0;
              return (
                <div key={h} className="flex-1 flex flex-col items-center gap-1 group">
                  <div
                    className="w-full bg-indigo-500/40 hover:bg-indigo-500/70 rounded-sm transition-colors relative"
                    style={{ height: `${Math.max(heightPct, 4)}%` }}
                    title={`${h}:00 — ${count} requests`}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-slate-600 mt-1 px-0.5">
            <span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span>
          </div>
        </div>

        {/* By sim type */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Token Usage by Sim Type</h2>
          <div className="space-y-3">
            {Object.entries(typeMap).sort((a, b) => b[1].tokens - a[1].tokens).map(([type, { count, tokens }]) => {
              const totalTypeTokens = Object.values(typeMap).reduce((s, t) => s + t.tokens, 0);
              const pct = totalTypeTokens > 0 ? Math.round((tokens / totalTypeTokens) * 100) : 0;
              return (
                <div key={type}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400 capitalize">{type} ({count} runs)</span>
                    <span className="text-slate-300 font-mono">{tokens.toLocaleString()} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full">
                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {Object.keys(typeMap).length === 0 && <div className="text-xs text-slate-600">No simulation data</div>}
          </div>
        </div>
      </div>

      {/* At Risk Alert */}
      {atRisk.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <div className="text-sm font-semibold text-amber-300">{atRisk.length} workspace{atRisk.length > 1 ? "s" : ""} near token quota</div>
          </div>
          <div className="text-xs text-amber-600">
            {atRisk.map(w => w.name).join(", ")} — Consider upgrading their tier or adjusting limits.
          </div>
        </div>
      )}

      {/* Per-workspace table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-slate-500" />
            Per-Workspace Usage This Month
          </h2>
        </div>
        <div className="grid grid-cols-[2fr_1fr_100px_100px_120px_60px] gap-3 px-4 py-2.5 border-b border-slate-800/50 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
          <span>Workspace</span>
          <span>Tier</span>
          <span>Tokens Used</span>
          <span>Requests</span>
          <span>Quota Used</span>
          <span>Cost</span>
        </div>
        <div className="divide-y divide-slate-800/40 max-h-[400px] overflow-y-auto">
          {wsUsageRows.map(w => (
            <div key={w.wsId} className="grid grid-cols-[2fr_1fr_100px_100px_120px_60px] gap-3 px-4 py-3 items-center hover:bg-slate-800/20">
              <div className="text-sm text-white truncate">{w.name}</div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize w-fit ${
                w.tier === "enterprise" ? "bg-amber-500/20 text-amber-400" :
                w.tier === "professional" ? "bg-purple-500/20 text-purple-400" :
                w.tier === "starter" ? "bg-blue-500/20 text-blue-400" :
                "bg-slate-700 text-slate-400"
              }`}>{w.tier}</span>
              <div className="text-xs font-mono text-slate-300">{w.tokens.toLocaleString()}</div>
              <div className="text-xs text-slate-400">{w.requests}</div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 bg-slate-800 rounded-full">
                  <div
                    className={`h-full rounded-full ${w.pct >= 90 ? "bg-red-500" : w.pct >= 70 ? "bg-amber-500" : "bg-indigo-500"}`}
                    style={{ width: `${w.pct}%` }}
                  />
                </div>
                <span className={`text-[10px] tabular-nums ${w.pct >= 90 ? "text-red-400" : w.pct >= 70 ? "text-amber-400" : "text-slate-400"}`}>{w.pct}%</span>
              </div>
              <div className="text-xs text-slate-400 font-mono">${(w.tokens * COST_PER_TOKEN).toFixed(4)}</div>
            </div>
          ))}
          {wsUsageRows.length === 0 && (
            <div className="text-center py-12 text-slate-600 text-sm">No token usage this month</div>
          )}
        </div>
      </div>
    </div>
  );
}
