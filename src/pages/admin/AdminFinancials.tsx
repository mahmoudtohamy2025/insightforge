import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, CheckCircle2, XCircle, Clock, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-slate-700 text-slate-300",
  awaiting_approval: "bg-amber-500/20 text-amber-400",
  processing: "bg-blue-500/20 text-blue-400",
  sent: "bg-emerald-500/20 text-emerald-400",
  claimed: "bg-teal-500/20 text-teal-400",
  failed: "bg-red-500/20 text-red-400",
  cancelled: "bg-rose-500/20 text-rose-400",
  expired: "bg-slate-600/40 text-slate-500",
};

export default function AdminFinancials() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"payouts" | "programs" | "marketplace-earnings">("payouts");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: disbursements = [], isLoading } = useQuery({
    queryKey: ["admin-fin-disbursements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incentive_disbursements" as any)
        .select("id, amount_cents, currency, status, reason, recipient_email, delivery_method, workspace_id, participant_id, created_at, sent_at, provider")
        .order("created_at", { ascending: false });
      if (error) return [];
      return data ?? [];
    },
  });

  const { data: programs = [] } = useQuery({
    queryKey: ["admin-fin-programs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incentive_programs" as any)
        .select("id, name, total_budget_cents, spent_cents, currency, status, incentive_type, workspace_id, provider, created_at")
        .order("created_at", { ascending: false });
      if (error) return [];
      return data ?? [];
    },
  });

  const { data: workspaces = [] } = useQuery({
    queryKey: ["admin-ws-names-fin"],
    queryFn: async () => {
      const { data } = await supabase.from("workspaces").select("id, name, stripe_customer_id, subscription_status, tier");
      return data ?? [];
    },
  });

  const wsMap = workspaces.reduce((a: Record<string, any>, w: any) => { a[w.id] = w; return a; }, {});

  const approveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await (supabase as any)
        .from("incentive_disbursements")
        .update({ status: "processing", approved_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-fin-disbursements"] });
      setSelectedIds(new Set());
      toast.success("Payouts approved and queued for processing");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await (supabase as any)
        .from("incentive_disbursements")
        .update({ status: "cancelled" })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-fin-disbursements"] });
      setSelectedIds(new Set());
      toast.success("Payouts rejected");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const pendingApprovals = disbursements.filter((d: any) => d.status === "awaiting_approval");
  const totalPendingCents = pendingApprovals.reduce((s: number, d: any) => s + (d.amount_cents || 0), 0);
  const totalSentCents = disbursements.filter((d: any) => d.status === "sent" || d.status === "claimed")
    .reduce((s: number, d: any) => s + (d.amount_cents || 0), 0);
  const totalBudget = programs.reduce((s: number, p: any) => s + (p.total_budget_cents || 0), 0);
  const totalSpent = programs.reduce((s: number, p: any) => s + (p.spent_cents || 0), 0);

  const toggleSelect = (id: string) => {
    const ns = new Set(selectedIds);
    ns.has(id) ? ns.delete(id) : ns.add(id);
    setSelectedIds(ns);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === pendingApprovals.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingApprovals.map((d: any) => d.id)));
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Financial Governance</h1>
        <p className="text-slate-500 text-sm mt-0.5">Platform-wide incentive budgets, payout approvals, and billing</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: AlertCircle, label: "Awaiting Approval", value: pendingApprovals.length, sub: `$${(totalPendingCents / 100).toLocaleString()} pending`, color: pendingApprovals.length > 0 ? "bg-amber-500" : "bg-slate-600" },
          { icon: CheckCircle2, label: "Total Disbursed", value: `$${(totalSentCents / 100).toLocaleString()}`, sub: "sent or claimed", color: "bg-emerald-500" },
          { icon: DollarSign, label: "Total Budget", value: `$${(totalBudget / 100).toLocaleString()}`, sub: `$${(totalSpent / 100).toLocaleString()} spent`, color: "bg-blue-500" },
          { icon: Clock, label: "Incentive Programs", value: programs.length, sub: `${programs.filter((p: any) => p.status === "active").length} active`, color: "bg-indigo-500" },
        ].map(({ icon: Icon, label, value, sub, color }) => (
          <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className={`h-9 w-9 rounded-lg ${color} flex items-center justify-center mb-3`}>
              <Icon className="h-4 w-4 text-white" />
            </div>
            <div className="text-2xl font-bold text-white">{value}</div>
            <div className="text-xs text-slate-400 mt-0.5">{label}</div>
            <div className="text-[11px] text-slate-600 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* Pending alert */}
      {pendingApprovals.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-400 shrink-0" />
              <div>
                <div className="text-sm font-semibold text-amber-300">
                  {pendingApprovals.length} payout{pendingApprovals.length > 1 ? "s" : ""} awaiting your approval
                </div>
                <div className="text-xs text-amber-600">Total value: ${(totalPendingCents / 100).toLocaleString()}</div>
              </div>
            </div>
            <div className="flex gap-2">
              {selectedIds.size > 0 && (
                <>
                  <button
                    onClick={() => approveMutation.mutate(Array.from(selectedIds))}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-sm transition-colors"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Approve ({selectedIds.size})
                  </button>
                  <button
                    onClick={() => rejectMutation.mutate(Array.from(selectedIds))}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm transition-colors"
                  >
                    <XCircle className="h-4 w-4" /> Reject ({selectedIds.size})
                  </button>
                </>
              )}
              <button
                onClick={() => approveMutation.mutate(pendingApprovals.map((d: any) => d.id))}
                className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg text-sm transition-colors"
              >
                Approve All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800">
        {(["payouts", "programs", "marketplace-earnings"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm capitalize rounded-t-lg transition-colors ${
              tab === t ? "bg-slate-900 border border-b-0 border-slate-800 text-white" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {t.replace(/-/g, " ")}
          </button>
        ))}
      </div>

      {tab === "payouts" && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[32px_2fr_1fr_1fr_80px_80px_80px] gap-3 px-4 py-3 border-b border-slate-800 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
            <input
              type="checkbox"
              checked={selectedIds.size > 0 && selectedIds.size === pendingApprovals.length}
              onChange={toggleSelectAll}
              className="rounded border-slate-700"
            />
            <span>Disbursement</span>
            <span>Workspace</span>
            <span>Method</span>
            <span>Amount</span>
            <span>Status</span>
            <span>Date</span>
          </div>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-slate-600" /></div>
          ) : (
            <div className="divide-y divide-slate-800/40 max-h-[500px] overflow-y-auto">
              {disbursements.map((d: any) => {
                const isSelectable = d.status === "awaiting_approval";
                return (
                  <div key={d.id} className="grid grid-cols-[32px_2fr_1fr_1fr_80px_80px_80px] gap-3 px-4 py-3 items-center hover:bg-slate-800/20">
                    <input
                      type="checkbox"
                      disabled={!isSelectable}
                      checked={selectedIds.has(d.id)}
                      onChange={() => toggleSelect(d.id)}
                      className="rounded border-slate-700 disabled:opacity-30"
                    />
                    <div className="min-w-0">
                      <div className="text-xs text-slate-400 font-mono truncate">{d.id.slice(0, 16)}…</div>
                      <div className="text-[10px] text-slate-600">{d.recipient_email || d.reason}</div>
                    </div>
                    <div className="text-xs text-slate-400 truncate">{wsMap[d.workspace_id]?.name || d.workspace_id?.slice(0, 8)}</div>
                    <div className="text-xs text-slate-400 capitalize">{d.delivery_method}</div>
                    <div className="text-sm text-white font-mono">${(d.amount_cents / 100).toFixed(2)}</div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize w-fit ${STATUS_COLOR[d.status] || "bg-slate-700 text-slate-400"}`}>
                      {d.status?.replace("_", " ")}
                    </span>
                    <div className="text-xs text-slate-500">{new Date(d.created_at).toLocaleDateString()}</div>
                  </div>
                );
              })}
              {disbursements.length === 0 && <div className="text-center py-14 text-slate-600 text-sm">No disbursements yet</div>}
            </div>
          )}
        </div>
      )}

      {tab === "programs" && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[2fr_1fr_1fr_100px_80px_80px] gap-3 px-4 py-3 border-b border-slate-800 text-[11px] font-medium text-slate-500 uppercase">
            <span>Program</span>
            <span>Workspace</span>
            <span>Type</span>
            <span>Budget</span>
            <span>Spent</span>
            <span>Status</span>
          </div>
          <div className="divide-y divide-slate-800/40 max-h-[500px] overflow-y-auto">
            {programs.map((p: any) => {
              const spentPct = p.total_budget_cents > 0 ? Math.round((p.spent_cents / p.total_budget_cents) * 100) : 0;
              return (
                <div key={p.id} className="grid grid-cols-[2fr_1fr_1fr_100px_80px_80px] gap-3 px-4 py-3 items-center hover:bg-slate-800/20">
                  <div>
                    <div className="text-sm text-white">{p.name}</div>
                    <div className="text-[11px] text-slate-600">{p.provider || "manual"}</div>
                  </div>
                  <div className="text-xs text-slate-400 truncate">{wsMap[p.workspace_id]?.name || p.workspace_id?.slice(0, 8)}</div>
                  <div className="text-xs text-slate-400 capitalize">{p.incentive_type}</div>
                  <div>
                    <div className="text-xs text-white font-mono">${(p.total_budget_cents / 100).toLocaleString()}</div>
                    <div className="mt-1 h-1 bg-slate-800 rounded-full">
                      <div
                        className={`h-full rounded-full ${spentPct >= 90 ? "bg-red-500" : spentPct >= 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                        style={{ width: `${spentPct}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-slate-600 mt-0.5">{spentPct}% used</div>
                  </div>
                  <div className="text-xs text-slate-400 font-mono">${(p.spent_cents / 100).toLocaleString()}</div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize w-fit ${
                    p.status === "active" ? "bg-emerald-500/20 text-emerald-400" :
                    p.status === "exhausted" ? "bg-red-500/20 text-red-400" :
                    "bg-slate-700 text-slate-400"
                  }`}>{p.status}</span>
                </div>
              );
            })}
            {programs.length === 0 && <div className="text-center py-14 text-slate-600 text-sm">No incentive programs</div>}
          </div>
        </div>
      )}

      {tab === "marketplace-earnings" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {workspaces.map((w: any) => {
              const wsPrograms = programs.filter((p: any) => p.workspace_id === w.id);
              const wsBudget = wsPrograms.reduce((s: number, p: any) => s + (p.total_budget_cents || 0), 0);
              const wsSpent = wsPrograms.reduce((s: number, p: any) => s + (p.spent_cents || 0), 0);
              const health = wsBudget > 0 ? Math.round((wsSpent / wsBudget) * 100) : 0;
              return (
                <div key={w.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-medium text-white truncate">{w.name}</div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full capitalize ${
                      w.tier === "enterprise" ? "bg-amber-500/20 text-amber-400" :
                      w.tier === "professional" ? "bg-purple-500/20 text-purple-400" :
                      "bg-slate-700 text-slate-400"
                    }`}>{w.tier || "free"}</span>
                  </div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500">Budget Used</span>
                    <span className={health >= 90 ? "text-red-400" : health >= 70 ? "text-amber-400" : "text-emerald-400"}>{health}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full mb-2">
                    <div
                      className={`h-full rounded-full ${health >= 90 ? "bg-red-500" : health >= 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{ width: `${health}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-600">${(wsSpent / 100).toLocaleString()} spent</span>
                    <span className="text-slate-600">of ${(wsBudget / 100).toLocaleString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
