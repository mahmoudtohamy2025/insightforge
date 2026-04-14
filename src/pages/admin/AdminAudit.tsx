import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, Download, Search, Filter, Loader2 } from "lucide-react";

const ACTION_LABELS: Record<string, string> = {
  membership_added: "Member Added",
  membership_removed: "Member Removed",
  api_key_created: "API Key Created",
  simulation_run: "Simulation Ran",
  data_exported: "Data Exported",
};

export default function AdminAudit() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [wsFilter, setWsFilter] = useState("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const { data: auditLogs = [], isLoading } = useQuery({
    queryKey: ["admin-audit-all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("id, workspace_id, user_id, action, resource_type, resource_id, ip_address, user_agent, created_at, details")
        .order("created_at", { ascending: false })
        .limit(2000);
      return data ?? [];
    },
  });

  const { data: workspaces = [] } = useQuery({
    queryKey: ["admin-ws-audit"],
    queryFn: async () => {
      const { data } = await supabase.from("workspaces").select("id, name");
      return data ?? [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-profiles-audit"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name");
      return data ?? [];
    },
  });

  const wsMap = workspaces.reduce((a: Record<string, string>, w: any) => { a[w.id] = w.name; return a; }, {});
  const profileMap = profiles.reduce((a: Record<string, string>, p: any) => { a[p.id] = p.full_name || "—"; return a; }, {});

  const allActions = Array.from(new Set(auditLogs.map((l: any) => l.action)));

  const filtered = auditLogs.filter((log: any) => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      log.action?.includes(q) ||
      log.resource_type?.includes(q) ||
      log.ip_address?.includes(q) ||
      wsMap[log.workspace_id]?.toLowerCase().includes(q) ||
      profileMap[log.user_id]?.toLowerCase().includes(q);
    const matchAction = actionFilter === "all" || log.action === actionFilter;
    const matchWs = wsFilter === "all" || log.workspace_id === wsFilter;
    return matchSearch && matchAction && matchWs;
  });

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const exportCSV = () => {
    const rows = [
      ["Timestamp", "Workspace", "User", "Action", "Resource Type", "Resource ID", "IP Address"],
      ...filtered.map((l: any) => [
        new Date(l.created_at).toISOString(),
        wsMap[l.workspace_id] || l.workspace_id || "—",
        profileMap[l.user_id] || l.user_id || "system",
        l.action,
        l.resource_type,
        l.resource_id || "—",
        l.ip_address || "—",
      ]),
    ];
    const csv = rows.map(r => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  // Anomaly detection: multiple actions from same IP in last hour
  const ipCounts = auditLogs
    .filter((l: any) => new Date(l.created_at) > new Date(Date.now() - 3600_000))
    .reduce((a: Record<string, number>, l: any) => {
      if (l.ip_address) a[l.ip_address] = (a[l.ip_address] || 0) + 1;
      return a;
    }, {});
  const suspiciousIPs = Object.entries(ipCounts).filter(([, c]) => (c as number) > 10);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-indigo-400" />
            Audit Trail
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">SOC 2 compliant activity log — {auditLogs.length.toLocaleString()} total events</p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-sm transition-colors"
        >
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      {/* Anomaly alerts */}
      {suspiciousIPs.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="text-sm font-semibold text-red-400 mb-1">⚠️ Unusual Activity Detected</div>
          <div className="text-xs text-red-500">
            High request volume from: {suspiciousIPs.map(([ip, c]) => `${ip} (${c} events/hr)`).join(", ")}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search action, workspace, user, IP…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-500" />
          <select
            value={actionFilter}
            onChange={e => { setActionFilter(e.target.value); setPage(0); }}
            className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none"
          >
            <option value="all">All Actions</option>
            {allActions.map(a => <option key={a as string} value={a as string}>{ACTION_LABELS[a as string] || a as string}</option>)}
          </select>
          <select
            value={wsFilter}
            onChange={e => { setWsFilter(e.target.value); setPage(0); }}
            className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none"
          >
            <option value="all">All Workspaces</option>
            {workspaces.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div className="text-xs text-slate-600 flex items-center">{filtered.length} events</div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-600" /></div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[160px_2fr_1fr_1fr_1fr_120px] gap-3 px-4 py-3 border-b border-slate-800 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
            <span>Timestamp</span>
            <span>Workspace</span>
            <span>User</span>
            <span>Action</span>
            <span>Resource</span>
            <span>IP</span>
          </div>
          <div className="divide-y divide-slate-800/40 max-h-[600px] overflow-y-auto">
            {paginated.map((log: any) => (
              <div key={log.id} className="grid grid-cols-[160px_2fr_1fr_1fr_1fr_120px] gap-3 px-4 py-2.5 items-center hover:bg-slate-800/20 group">
                <div className="text-[11px] text-slate-500 font-mono">
                  {new Date(log.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </div>
                <div className="text-sm text-slate-300 truncate">{wsMap[log.workspace_id] || log.workspace_id?.slice(0, 12) || "—"}</div>
                <div className="text-xs text-slate-400 truncate">{profileMap[log.user_id] || log.user_id?.slice(0, 8) || "system"}</div>
                <div>
                  <span className="text-xs bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                    {ACTION_LABELS[log.action] || log.action}
                  </span>
                </div>
                <div className="text-xs text-slate-500 truncate">{log.resource_type}</div>
                <div className="text-[11px] font-mono text-slate-600">{log.ip_address || "—"}</div>
              </div>
            ))}
            {paginated.length === 0 && (
              <div className="text-center py-16 text-slate-600 text-sm">No audit events match your filter</div>
            )}
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-sm disabled:opacity-40 hover:bg-slate-700 transition-colors"
          >Previous</button>
          <span className="text-sm text-slate-500">{page + 1} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-sm disabled:opacity-40 hover:bg-slate-700 transition-colors"
          >Next</button>
        </div>
      )}
    </div>
  );
}
