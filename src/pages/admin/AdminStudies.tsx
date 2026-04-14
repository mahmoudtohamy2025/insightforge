import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen, Loader2, Users, BarChart3, Zap, ClipboardList } from "lucide-react";

const SIM_TYPE_COLOR: Record<string, string> = {
  solo: "bg-blue-500/20 text-blue-400",
  focus_group: "bg-purple-500/20 text-purple-400",
  ab_test: "bg-amber-500/20 text-amber-400",
  market_sim: "bg-emerald-500/20 text-emerald-400",
  policy: "bg-rose-500/20 text-rose-400",
};

export default function AdminStudies() {
  const [tab, setTab] = useState<"studies" | "simulations" | "surveys" | "participations">("studies");

  const { data: studyListings = [], isLoading: loadingStudies } = useQuery({
    queryKey: ["admin-study-listings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_listings" as any)
        .select("id, title, study_type, status, reward_amount_cents, currency, max_participants, current_participants, workspace_id, created_at")
        .order("created_at", { ascending: false });
      if (error) return [];
      return data ?? [];
    },
  });

  const { data: simulations = [], isLoading: loadingSims } = useQuery({
    queryKey: ["admin-all-simulations"],
    queryFn: async () => {
      const { data } = await supabase
        .from("simulations")
        .select("id, title, type, status, tokens_used, confidence_score, workspace_id, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const { data: surveys = [] } = useQuery({
    queryKey: ["admin-all-surveys"],
    queryFn: async () => {
      const { data } = await supabase
        .from("surveys")
        .select("id, title, status, workspace_id, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const { data: participations = [] } = useQuery({
    queryKey: ["admin-all-participations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_participations" as any)
        .select("id, study_id, status, started_at, completed_at, researcher_rating, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) return [];
      return data ?? [];
    },
  });

  const { data: workspaces = [] } = useQuery({
    queryKey: ["admin-ws-names"],
    queryFn: async () => {
      const { data } = await supabase.from("workspaces").select("id, name");
      return data ?? [];
    },
  });

  const wsMap = workspaces.reduce((a: Record<string, string>, w: any) => { a[w.id] = w.name; return a; }, {});

  const simStats = {
    total: simulations.length,
    completed: simulations.filter((s: any) => s.status === "completed").length,
    failed: simulations.filter((s: any) => s.status === "failed").length,
    totalTokens: simulations.reduce((s: number, sim: any) => s + (sim.tokens_used || 0), 0),
    avgConfidence: simulations.filter((s: any) => s.confidence_score != null).length
      ? simulations.filter((s: any) => s.confidence_score != null)
          .reduce((s: number, sim: any) => s + sim.confidence_score, 0) /
        simulations.filter((s: any) => s.confidence_score != null).length
      : 0,
  };

  const typeBreakdown = simulations.reduce((a: Record<string, number>, s: any) => {
    a[s.type] = (a[s.type] || 0) + 1; return a;
  }, {});

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Research Pipeline</h1>
        <p className="text-slate-500 text-sm mt-0.5">Cross-tenant view of all research activity</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: BookOpen, label: "Study Listings", value: studyListings.length, color: "bg-blue-500" },
          { icon: Zap, label: "Simulations", value: simStats.total, color: "bg-violet-500" },
          { icon: ClipboardList, label: "Surveys", value: surveys.length, color: "bg-teal-500" },
          { icon: Users, label: "Participations", value: participations.length, color: "bg-emerald-500" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className={`h-9 w-9 rounded-lg ${color} flex items-center justify-center mb-3`}>
              <Icon className="h-4 w-4 text-white" />
            </div>
            <div className="text-2xl font-bold text-white">{value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Simulation stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="text-xs font-semibold text-slate-500 uppercase mb-3 flex items-center gap-2">
            <BarChart3 className="h-3.5 w-3.5" /> Simulation Types
          </div>
          <div className="space-y-2">
            {Object.entries(typeBreakdown).sort((a: any, b: any) => b[1] - a[1]).map(([type, count]) => (
              <div key={type} className="flex items-center justify-between">
                <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${SIM_TYPE_COLOR[type] || "bg-slate-700 text-slate-400"}`}>{type}</span>
                <span className="text-sm font-bold text-white">{count as number}</span>
              </div>
            ))}
            {Object.keys(typeBreakdown).length === 0 && <div className="text-xs text-slate-600">No simulations yet</div>}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="text-xs font-semibold text-slate-500 uppercase mb-3">Simulation Health</div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Success Rate</span>
              <span className="text-emerald-400 font-bold">
                {simStats.total ? Math.round((simStats.completed / simStats.total) * 100) : 0}%
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Failed</span>
              <span className={simStats.failed > 10 ? "text-red-400" : "text-slate-300"} >{simStats.failed}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Avg Confidence</span>
              <span className="text-white">{(simStats.avgConfidence * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Total Tokens</span>
              <span className="text-white font-mono">{simStats.totalTokens.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <div className="text-xs font-semibold text-slate-500 uppercase mb-3">Study Status</div>
          <div className="space-y-2">
            {["active", "draft", "paused", "completed", "cancelled"].map(status => {
              const count = studyListings.filter((s: any) => s.status === status).length;
              return (
                <div key={status} className="flex justify-between text-sm">
                  <span className="text-slate-500 capitalize">{status}</span>
                  <span className="text-white">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800">
        {(["studies", "simulations", "surveys", "participations"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm capitalize rounded-t-lg transition-colors ${
              tab === t ? "bg-slate-900 border border-b-0 border-slate-800 text-white" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {tab === "studies" && (
          <>
            <div className="grid grid-cols-[2fr_1fr_1fr_80px_80px_80px] gap-3 px-4 py-3 border-b border-slate-800 text-[11px] font-medium text-slate-500 uppercase">
              <span>Study</span>
              <span>Workspace</span>
              <span>Type</span>
              <span>Reward</span>
              <span>Fill</span>
              <span>Status</span>
            </div>
            <div className="divide-y divide-slate-800/40 max-h-[500px] overflow-y-auto">
              {studyListings.map((s: any) => (
                <div key={s.id} className="grid grid-cols-[2fr_1fr_1fr_80px_80px_80px] gap-3 px-4 py-3 items-center hover:bg-slate-800/20">
                  <div className="text-sm text-white truncate">{s.title}</div>
                  <div className="text-xs text-slate-400 truncate">{wsMap[s.workspace_id] || s.workspace_id?.slice(0, 8)}</div>
                  <span className="text-xs text-slate-400 capitalize">{s.study_type}</span>
                  <div className="text-xs text-slate-300 font-mono">${((s.reward_amount_cents || 0) / 100).toFixed(2)}</div>
                  <div className="text-xs text-slate-400">{s.current_participants}/{s.max_participants}</div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize w-fit ${
                    s.status === "active" ? "bg-emerald-500/20 text-emerald-400" :
                    s.status === "completed" ? "bg-blue-500/20 text-blue-400" :
                    "bg-slate-700 text-slate-400"
                  }`}>{s.status}</span>
                </div>
              ))}
              {studyListings.length === 0 && <div className="text-center py-12 text-slate-600 text-sm">No study listings yet</div>}
            </div>
          </>
        )}

        {tab === "simulations" && (
          <>
            <div className="grid grid-cols-[2fr_1fr_1fr_80px_80px_80px] gap-3 px-4 py-3 border-b border-slate-800 text-[11px] font-medium text-slate-500 uppercase">
              <span>Simulation</span>
              <span>Workspace</span>
              <span>Type</span>
              <span>Tokens</span>
              <span>Confidence</span>
              <span>Status</span>
            </div>
            <div className="divide-y divide-slate-800/40 max-h-[500px] overflow-y-auto">
              {simulations.map((s: any) => (
                <div key={s.id} className="grid grid-cols-[2fr_1fr_1fr_80px_80px_80px] gap-3 px-4 py-3 items-center hover:bg-slate-800/20">
                  <div className="text-sm text-white truncate">{s.title}</div>
                  <div className="text-xs text-slate-400 truncate">{wsMap[s.workspace_id] || s.workspace_id?.slice(0, 8)}</div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize w-fit ${SIM_TYPE_COLOR[s.type] || "bg-slate-700 text-slate-400"}`}>{s.type}</span>
                  <div className="text-xs font-mono text-slate-400">{(s.tokens_used || 0).toLocaleString()}</div>
                  <div className="text-xs text-slate-400">{s.confidence_score != null ? `${(s.confidence_score * 100).toFixed(0)}%` : "—"}</div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize w-fit ${
                    s.status === "completed" ? "bg-emerald-500/20 text-emerald-400" :
                    s.status === "failed" ? "bg-red-500/20 text-red-400" :
                    s.status === "running" ? "bg-amber-500/20 text-amber-400" :
                    "bg-slate-700 text-slate-400"
                  }`}>{s.status}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "surveys" && (
          <>
            <div className="grid grid-cols-[2fr_1fr_1fr_100px] gap-3 px-4 py-3 border-b border-slate-800 text-[11px] font-medium text-slate-500 uppercase">
              <span>Survey</span>
              <span>Workspace</span>
              <span>Status</span>
              <span>Created</span>
            </div>
            <div className="divide-y divide-slate-800/40 max-h-[500px] overflow-y-auto">
              {surveys.map((s: any) => (
                <div key={s.id} className="grid grid-cols-[2fr_1fr_1fr_100px] gap-3 px-4 py-3 items-center hover:bg-slate-800/20">
                  <div className="text-sm text-white truncate">{s.title}</div>
                  <div className="text-xs text-slate-400 truncate">{wsMap[s.workspace_id] || s.workspace_id?.slice(0, 8)}</div>
                  <span className="text-xs text-slate-400 capitalize">{s.status || "active"}</span>
                  <span className="text-xs text-slate-500">{new Date(s.created_at).toLocaleDateString()}</span>
                </div>
              ))}
              {surveys.length === 0 && <div className="text-center py-12 text-slate-600 text-sm">No surveys yet</div>}
            </div>
          </>
        )}

        {tab === "participations" && (
          <>
            <div className="grid grid-cols-[2fr_1fr_80px_80px_80px] gap-3 px-4 py-3 border-b border-slate-800 text-[11px] font-medium text-slate-500 uppercase">
              <span>Study ID</span>
              <span>Status</span>
              <span>Rating</span>
              <span>Completed</span>
              <span>Date</span>
            </div>
            <div className="divide-y divide-slate-800/40 max-h-[500px] overflow-y-auto">
              {participations.map((p: any) => (
                <div key={p.id} className="grid grid-cols-[2fr_1fr_80px_80px_80px] gap-3 px-4 py-2.5 items-center hover:bg-slate-800/20">
                  <div className="text-xs font-mono text-slate-400 truncate">{p.study_id}</div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize w-fit ${
                    p.status === "paid" ? "bg-emerald-500/20 text-emerald-400" :
                    p.status === "approved" ? "bg-blue-500/20 text-blue-400" :
                    p.status === "rejected" ? "bg-red-500/20 text-red-400" :
                    "bg-slate-700 text-slate-400"
                  }`}>{p.status}</span>
                  <div className="text-xs text-slate-300">{p.researcher_rating ? `${p.researcher_rating}★` : "—"}</div>
                  <div className="text-xs text-slate-400">{p.completed_at ? new Date(p.completed_at).toLocaleDateString() : "—"}</div>
                  <div className="text-xs text-slate-500">{new Date(p.created_at).toLocaleDateString()}</div>
                </div>
              ))}
              {participations.length === 0 && <div className="text-center py-12 text-slate-600 text-sm">No participations yet</div>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
