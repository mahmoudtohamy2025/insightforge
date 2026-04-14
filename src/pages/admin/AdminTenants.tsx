import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import {
  Building2, Search, Users, ChevronDown, ChevronUp,
  Loader2, ArrowUpRight, Filter, Download,
} from "lucide-react";
import { toast } from "sonner";

const TIER_OPTIONS = ["free", "starter", "professional", "enterprise"];
const TIER_COLOR: Record<string, string> = {
  free: "bg-slate-700/60 text-slate-300",
  starter: "bg-blue-500/20 text-blue-400",
  professional: "bg-purple-500/20 text-purple-400",
  enterprise: "bg-amber-500/20 text-amber-400",
};

function cn(...c: (string | false | undefined)[]) { return c.filter(Boolean).join(" "); }

export default function AdminTenants() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: workspaces = [], isLoading } = useQuery({
    queryKey: ["admin-tenants-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("workspaces")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: memberships = [] } = useQuery({
    queryKey: ["admin-tenants-memberships"],
    queryFn: async () => {
      const { data } = await supabase
        .from("workspace_memberships")
        .select("workspace_id, user_id, role");
      return data ?? [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-tenants-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name");
      return data ?? [];
    },
  });

  const { data: simCounts = [] } = useQuery({
    queryKey: ["admin-tenants-simcounts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("simulations")
        .select("workspace_id");
      return data ?? [];
    },
  });

  const { data: tokenUsage = [] } = useQuery({
    queryKey: ["admin-tenants-tokens"],
    queryFn: async () => {
      const { data } = await supabase
        .from("workspace_token_usage")
        .select("workspace_id, tokens_used");
      return data ?? [];
    },
  });

  const updateTierMutation = useMutation({
    mutationFn: async ({ wsId, tier }: { wsId: string; tier: string }) => {
      const { error } = await supabase.from("workspaces").update({ tier }).eq("id", wsId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tenants-list"] });
      toast.success("Tier updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const profileMap = profiles.reduce((a: Record<string, string>, p: any) => {
    a[p.id] = p.full_name || "—"; return a;
  }, {});

  const memberMap = memberships.reduce((a: Record<string, number>, m: any) => {
    a[m.workspace_id] = (a[m.workspace_id] || 0) + 1; return a;
  }, {});

  const simMap = simCounts.reduce((a: Record<string, number>, s: any) => {
    a[s.workspace_id] = (a[s.workspace_id] || 0) + 1; return a;
  }, {});

  const tokenMap = tokenUsage.reduce((a: Record<string, number>, t: any) => {
    a[t.workspace_id] = (a[t.workspace_id] || 0) + (t.tokens_used || 0); return a;
  }, {});

  const filtered = workspaces.filter((ws: any) => {
    const q = search.toLowerCase();
    return (
      (ws.name?.toLowerCase().includes(q) || ws.slug?.toLowerCase().includes(q) || ws.id?.includes(q)) &&
      (tierFilter === "all" || (ws.tier || "free") === tierFilter)
    );
  });

  const exportCSV = () => {
    const rows = [
      ["ID", "Name", "Slug", "Tier", "Status", "Members", "Simulations", "Tokens", "Created"],
      ...filtered.map((w: any) => [
        w.id, w.name, w.slug, w.tier || "free", w.status || "active",
        memberMap[w.id] || 0, simMap[w.id] || 0, tokenMap[w.id] || 0,
        new Date(w.created_at).toLocaleDateString(),
      ]),
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "tenants.csv";
    a.click();
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tenants</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {workspaces.length} workspaces across all tiers
          </p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-sm transition-colors"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search name, slug, or ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-500" />
          <select
            value={tierFilter}
            onChange={e => setTierFilter(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none"
          >
            <option value="all">All Tiers</option>
            {TIER_OPTIONS.map(t => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="text-xs text-slate-600 flex items-center">{filtered.length} results</div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-slate-600" /></div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          {/* Header */}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                <th className="text-left px-4 py-3">Workspace</th>
                <th className="text-left px-3 py-3 w-32">Tier</th>
                <th className="text-left px-3 py-3 w-20">Members</th>
                <th className="text-left px-3 py-3 w-16">Sims</th>
                <th className="text-left px-3 py-3 w-20">Tokens</th>
                <th className="text-left px-3 py-3 w-20">Status</th>
                <th className="text-left px-3 py-3 w-28">Created</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {filtered.map((ws: any) => {
                const isExpanded = expandedId === ws.id;
                const wsMembers = memberships.filter((m: any) => m.workspace_id === ws.id);
                const tokens = tokenMap[ws.id] || 0;

                return (
                  <>
                    <tr
                      key={ws.id}
                      className="hover:bg-slate-800/30 transition-colors cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : ws.id)}
                    >
                      {/* Name */}
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-white truncate max-w-[180px]">{ws.name}</div>
                        <div className="text-[11px] text-slate-600 font-mono truncate">{ws.slug}</div>
                      </td>
                      {/* Tier */}
                      <td className="px-3 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${TIER_COLOR[ws.tier || "free"]}`}>
                          {ws.tier || "free"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-sm text-slate-300">{memberMap[ws.id] || 0}</td>
                      <td className="px-3 py-3 text-sm text-slate-300">{simMap[ws.id] || 0}</td>
                      <td className="px-3 py-3 text-xs text-slate-400 font-mono">
                        {tokens > 0 ? `${(tokens / 1000).toFixed(1)}k` : "—"}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          ws.status === "active" || !ws.status
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-red-500/20 text-red-400"
                        }`}>
                          {ws.status || "active"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500">
                        {new Date(ws.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {isExpanded
                          ? <ChevronUp className="h-4 w-4 text-slate-500 mx-auto" />
                          : <ChevronDown className="h-4 w-4 text-slate-500 mx-auto" />}
                      </td>
                    </tr>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <tr key={`${ws.id}-expanded`}>
                        <td colSpan={8} className="px-4 pb-4 pt-2 bg-slate-800/20 border-t border-slate-800/40">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Info */}
                            <div className="space-y-2">
                              <div className="text-[10px] text-slate-600 uppercase font-semibold mb-2">Workspace Info</div>
                              {[
                                ["ID", ws.id],
                                ["Stripe Customer", ws.stripe_customer_id || "—"],
                                ["Subscription", ws.subscription_status || "—"],
                                ["Data Residency", ws.data_residency || "mena"],
                                ["GDPR", ws.gdpr_enabled ? "Enabled" : "Disabled"],
                                ["Retention", `${ws.data_retention_days || 730} days`],
                              ].map(([k, v]) => (
                                <div key={k} className="flex justify-between text-xs gap-2">
                                  <span className="text-slate-500">{k}</span>
                                  <span className="text-slate-300 font-mono truncate max-w-[180px] text-right">{v}</span>
                                </div>
                              ))}
                            </div>

                            {/* Members */}
                            <div>
                              <div className="text-[10px] text-slate-600 uppercase font-semibold mb-2">
                                Members ({wsMembers.length})
                              </div>
                              <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                                {wsMembers.map((m: any) => (
                                  <div key={m.user_id} className="flex items-center justify-between bg-slate-800/50 rounded px-2 py-1.5">
                                    <span className="text-xs text-slate-300 truncate">
                                      {profileMap[m.user_id] || m.user_id.slice(0, 8)}
                                    </span>
                                    <span className="text-[10px] text-slate-500 capitalize ml-2 shrink-0">{m.role}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="space-y-3">
                              <div className="text-[10px] text-slate-600 uppercase font-semibold mb-2">Actions</div>
                              <div>
                                <label className="text-xs text-slate-500 block mb-1">Change Tier</label>
                                <select
                                  value={ws.tier || "free"}
                                  onChange={e => updateTierMutation.mutate({ wsId: ws.id, tier: e.target.value })}
                                  className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-white focus:outline-none"
                                >
                                  {TIER_OPTIONS.map(t => (
                                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                                  ))}
                                </select>
                              </div>
                              <button
                                onClick={() => navigate(`/admin/tenants/${ws.id}`)}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 rounded-lg text-sm transition-colors"
                              >
                                <ArrowUpRight className="h-4 w-4" />
                                Full Deep-Dive
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && !isLoading && (
            <div className="text-center py-16 text-slate-600 text-sm">No workspaces match your search</div>
          )}
        </div>
      )}
    </div>
  );
}
