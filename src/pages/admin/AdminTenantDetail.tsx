import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowLeft, Building2, Users, Cpu, Zap, Key, Palette,
  ShieldCheck, AlertTriangle, Loader2, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

function cn(...c: (string | false | undefined)[]) { return c.filter(Boolean).join(" "); }

const TABS = [
  { id: "overview", label: "Overview", icon: Building2 },
  { id: "members", label: "Members", icon: Users },
  { id: "simulations", label: "Simulations", icon: Cpu },
  { id: "api-keys", label: "API Keys", icon: Key },
  { id: "branding", label: "Branding", icon: Palette },
  { id: "audit", label: "Audit Log", icon: ShieldCheck },
  { id: "danger", label: "Danger Zone", icon: AlertTriangle },
];

export default function AdminTenantDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("overview");
  const [confirmDelete, setConfirmDelete] = useState("");

  const { data: ws, isLoading } = useQuery({
    queryKey: ["admin-tenant-detail", id],
    queryFn: async () => {
      const { data } = await supabase.from("workspaces").select("*").eq("id", id!).single();
      return data;
    },
    enabled: !!id,
  });

  const { data: members = [] } = useQuery({
    queryKey: ["admin-tenant-members", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("workspace_memberships")
        .select("user_id, role, created_at")
        .eq("workspace_id", id!);
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name");
      return data ?? [];
    },
  });

  const { data: simulations = [] } = useQuery({
    queryKey: ["admin-tenant-sims", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("simulations")
        .select("id, title, type, status, tokens_used, confidence_score, created_at")
        .eq("workspace_id", id!)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: apiKeys = [] } = useQuery({
    queryKey: ["admin-tenant-apikeys", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("workspace_api_keys")
        .select("id, name, key_prefix, scopes, is_active, requests_count, last_used_at, created_at")
        .eq("workspace_id", id!);
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: branding } = useQuery({
    queryKey: ["admin-tenant-branding", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("workspace_branding")
        .select("*")
        .eq("workspace_id", id!)
        .single();
      return data;
    },
    enabled: !!id,
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ["admin-tenant-auditlogs", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("id, action, resource_type, user_id, created_at, details, ip_address")
        .eq("workspace_id", id!)
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
    enabled: !!id,
  });

  const { data: tokenUsage = [] } = useQuery({
    queryKey: ["admin-tenant-tokens", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("workspace_token_usage")
        .select("period_start, tokens_used, request_count")
        .eq("workspace_id", id!)
        .order("period_start", { ascending: false })
        .limit(6);
      return data ?? [];
    },
    enabled: !!id,
  });

  const updateTierMutation = useMutation({
    mutationFn: async (tier: string) => {
      const { error } = await supabase.from("workspaces").update({ tier }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tenant-detail", id] });
      toast.success("Tier updated");
    },
  });

  const suspendMutation = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("workspaces").update({ status }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: (_, status) => {
      queryClient.invalidateQueries({ queryKey: ["admin-tenant-detail", id] });
      toast.success(`Workspace ${status === "active" ? "activated" : "suspended"}`);
    },
  });

  const profileMap = profiles.reduce((a: Record<string, string>, p: any) => { a[p.id] = p.full_name || "—"; return a; }, {});

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-slate-600" /></div>;
  if (!ws) return <div className="p-8 text-slate-500">Workspace not found</div>;

  const totalTokens = tokenUsage.reduce((s: number, t: any) => s + (t.tokens_used || 0), 0);

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate("/admin/tenants")} className="p-2 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-white truncate">{ws.name}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-slate-500 text-sm font-mono">{ws.slug}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize ${
              ws.tier === "enterprise" ? "bg-amber-500/20 text-amber-400" :
              ws.tier === "professional" ? "bg-purple-500/20 text-purple-400" :
              ws.tier === "starter" ? "bg-blue-500/20 text-blue-400" :
              "bg-slate-700 text-slate-400"
            }`}>{ws.tier || "free"}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
              ws.status === "active" || !ws.status ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
            }`}>{ws.status || "active"}</span>
          </div>
        </div>
      </div>

      {/* Quick KPIs */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {[
          { label: "Members", value: members.length },
          { label: "Simulations", value: simulations.length },
          { label: "API Keys", value: apiKeys.length },
          { label: "Tokens Used", value: `${(totalTokens / 1000).toFixed(1)}k` },
          { label: "Audit Events", value: auditLogs.length },
          { label: "Stripe", value: ws.stripe_customer_id ? "Connected" : "None" },
        ].map(({ label, value }) => (
          <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-center">
            <div className="text-xl font-bold text-white">{value}</div>
            <div className="text-[11px] text-slate-500">{label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800">
        <div className="flex gap-1 overflow-x-auto pb-1">
          {TABS.map(({ id: tid, label, icon: Icon }) => (
            <button
              key={tid}
              onClick={() => setTab(tid)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-sm rounded-t-lg transition-colors whitespace-nowrap",
                tab === tid
                  ? "bg-slate-900 border border-b-0 border-slate-800 text-white"
                  : "text-slate-500 hover:text-slate-300"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        {/* Overview */}
        {tab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="text-xs font-semibold text-slate-500 uppercase">Workspace Details</div>
              {[
                ["ID", ws.id],
                ["Name", ws.name],
                ["Slug", ws.slug],
                ["Deployment Type", ws.deployment_type || "shared"],
                ["Data Residency", ws.data_residency || "mena"],
                ["Retention Days", ws.data_retention_days || 730],
                ["GDPR Enabled", ws.gdpr_enabled ? "Yes" : "No"],
                ["PDPL Enabled", ws.pdpl_enabled ? "Yes" : "No"],
                ["Created", new Date(ws.created_at).toLocaleString()],
                ["Updated", new Date(ws.updated_at).toLocaleString()],
              ].map(([k, v]) => (
                <div key={k as string} className="flex items-center justify-between py-1.5 border-b border-slate-800/50">
                  <span className="text-sm text-slate-500">{k}</span>
                  <span className="text-sm text-slate-200 font-mono text-right max-w-[260px] truncate">{String(v)}</span>
                </div>
              ))}
            </div>
            <div className="space-y-4">
              <div className="text-xs font-semibold text-slate-500 uppercase">Billing & Tier</div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Current Tier</label>
                <select
                  value={ws.tier || "free"}
                  onChange={e => updateTierMutation.mutate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
                >
                  {["free", "starter", "professional", "enterprise"].map(t => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                {[
                  ["Stripe Customer", ws.stripe_customer_id || "Not connected"],
                  ["Subscription Status", ws.subscription_status || "—"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm">
                    <span className="text-slate-500">{k}</span>
                    <span className="text-slate-300 font-mono">{v}</span>
                  </div>
                ))}
              </div>
              <div className="text-xs font-semibold text-slate-500 uppercase mt-4">Token Usage (Last 6 Months)</div>
              <div className="space-y-1">
                {tokenUsage.map((t: any) => (
                  <div key={t.period_start} className="flex justify-between text-xs">
                    <span className="text-slate-500">{t.period_start?.slice(0, 7)}</span>
                    <span className="text-slate-300 font-mono">{(t.tokens_used || 0).toLocaleString()} tokens</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Members */}
        {tab === "members" && (
          <div className="space-y-3">
            <div className="text-xs font-semibold text-slate-500 uppercase">{members.length} Members</div>
            {members.map((m: any) => (
              <div key={m.user_id} className="flex items-center justify-between bg-slate-800/40 rounded-lg px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-white">{profileMap[m.user_id] || "—"}</div>
                  <div className="text-xs text-slate-500 font-mono">{m.user_id}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 capitalize">{m.role}</span>
                  <span className="text-xs text-slate-600">{new Date(m.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Simulations */}
        {tab === "simulations" && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-500 uppercase">{simulations.length} Simulations</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] text-slate-500 border-b border-slate-800">
                    <th className="text-left py-2 pr-4">Title</th>
                    <th className="text-left py-2 pr-4">Type</th>
                    <th className="text-left py-2 pr-4">Status</th>
                    <th className="text-right py-2 pr-4">Tokens</th>
                    <th className="text-right py-2 pr-4">Confidence</th>
                    <th className="text-right py-2">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {simulations.map((s: any) => (
                    <tr key={s.id} className="hover:bg-slate-800/30">
                      <td className="py-2 pr-4 text-slate-200 max-w-[200px] truncate">{s.title}</td>
                      <td className="py-2 pr-4 text-slate-400 capitalize">{s.type}</td>
                      <td className="py-2 pr-4">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                          s.status === "completed" ? "bg-emerald-500/20 text-emerald-400" :
                          s.status === "failed" ? "bg-red-500/20 text-red-400" :
                          "bg-slate-700 text-slate-400"
                        }`}>{s.status}</span>
                      </td>
                      <td className="py-2 pr-4 text-right font-mono text-xs text-slate-400">{s.tokens_used?.toLocaleString() || "—"}</td>
                      <td className="py-2 pr-4 text-right text-xs text-slate-400">{s.confidence_score != null ? `${(s.confidence_score * 100).toFixed(0)}%` : "—"}</td>
                      <td className="py-2 text-right text-xs text-slate-500">{new Date(s.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* API Keys */}
        {tab === "api-keys" && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-500 uppercase">{apiKeys.length} API Keys</div>
            {apiKeys.map((k: any) => (
              <div key={k.id} className="flex items-center justify-between bg-slate-800/40 rounded-lg px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-white">{k.name}</div>
                  <div className="text-xs text-slate-500 font-mono">{k.key_prefix}…</div>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span>{k.requests_count} requests</span>
                  <span>{k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : "Never"}</span>
                  <span className={k.is_active ? "text-emerald-400" : "text-red-400"}>{k.is_active ? "Active" : "Revoked"}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Branding */}
        {tab === "branding" && (
          <div className="space-y-4">
            {branding ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  {[
                    ["Brand Name", branding.brand_name],
                    ["Primary Color", branding.primary_color],
                    ["Accent Color", branding.accent_color],
                    ["Font", branding.font_family],
                    ["Custom Domain", branding.custom_domain || "—"],
                    ["Hide IF Branding", branding.hide_insightforge_branding ? "Yes" : "No"],
                    ["Footer Text", branding.footer_text],
                  ].map(([k, v]) => (
                    <div key={k as string} className="flex justify-between text-sm border-b border-slate-800/50 pb-2">
                      <span className="text-slate-500">{k}</span>
                      <span className="text-slate-200">{v as string}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-3">Color Preview</div>
                  <div className="h-24 rounded-xl border border-slate-700 flex items-center justify-center" style={{ background: branding.primary_color }}>
                    <span className="text-white font-semibold">{branding.brand_name}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-slate-500 text-sm text-center py-8">No branding configured for this workspace.</div>
            )}
          </div>
        )}

        {/* Audit Log */}
        {tab === "audit" && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-500 uppercase">{auditLogs.length} Events</div>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-900">
                  <tr className="text-[11px] text-slate-500 border-b border-slate-800">
                    <th className="text-left py-2 pr-4">Timestamp</th>
                    <th className="text-left py-2 pr-4">Action</th>
                    <th className="text-left py-2 pr-4">Resource</th>
                    <th className="text-left py-2">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {auditLogs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-slate-800/20">
                      <td className="py-2 pr-4 text-xs text-slate-500">{new Date(log.created_at).toLocaleString()}</td>
                      <td className="py-2 pr-4 text-slate-300">{log.action}</td>
                      <td className="py-2 pr-4 text-slate-400">{log.resource_type}</td>
                      <td className="py-2 text-xs text-slate-600 font-mono">{log.ip_address || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Danger Zone */}
        {tab === "danger" && (
          <div className="space-y-6">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
              <div className="text-sm font-semibold text-amber-400 mb-1">Suspend Workspace</div>
              <div className="text-xs text-amber-600 mb-3">Members will lose access immediately. No data is deleted.</div>
              <div className="flex gap-2">
                <button
                  onClick={() => suspendMutation.mutate("suspended")}
                  className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg text-sm transition-colors"
                >Suspend</button>
                <button
                  onClick={() => suspendMutation.mutate("active")}
                  className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-sm transition-colors"
                >Reactivate</button>
              </div>
            </div>

            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <div className="text-sm font-semibold text-red-400 mb-1">Delete Workspace</div>
              <div className="text-xs text-red-600 mb-3">
                This is irreversible. Type the workspace name to confirm.
              </div>
              <input
                type="text"
                placeholder={`Type "${ws.name}" to confirm`}
                value={confirmDelete}
                onChange={e => setConfirmDelete(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-red-800/50 rounded-lg text-sm text-white mb-3 focus:outline-none"
              />
              <button
                disabled={confirmDelete !== ws.name}
                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 disabled:opacity-40 disabled:cursor-not-allowed text-red-400 rounded-lg text-sm transition-colors"
              >
                Delete Workspace Permanently
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
