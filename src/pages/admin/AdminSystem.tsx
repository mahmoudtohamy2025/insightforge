import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Settings, Shield, Zap, Globe, Database, Bell, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

const TIER_LIMITS = {
  free:         { members: 3,  simulations: 5,   twins: 3,  participants: 10,  retention: 90  },
  starter:      { members: 10, simulations: 25,  twins: 10, participants: 50,  retention: 365 },
  professional: { members: 25, simulations: 100, twins: 50, participants: 250, retention: 730 },
  enterprise:   { members: 999, simulations: 999, twins: 999, participants: 999, retention: 2555 },
};

type FeatureFlag = {
  key: string;
  label: string;
  description: string;
  icon: React.ElementType;
  enabled: boolean;
};

const DEFAULT_FLAGS: FeatureFlag[] = [
  { key: "ai_simulations", label: "AI Simulations", description: "Enable AI-powered digital twin simulations across the platform", icon: Zap, enabled: true },
  { key: "participant_portal", label: "Participant Portal", description: "Allow participants to sign up and join studies via /participate routes", icon: Globe, enabled: true },
  { key: "incentive_payouts", label: "Incentive Payouts", description: "Enable workspace admins to create incentive programs and disburse rewards", icon: Database, enabled: true },
  { key: "transactional_emails", label: "Transactional Emails", description: "Send transactional emails for study invitations, payout confirmations", icon: Bell, enabled: true },
  { key: "segment_marketplace", label: "Segment Marketplace", description: "Allow workspaces to share and trade consumer segments", icon: Globe, enabled: true },
  { key: "data_export", label: "Data Export", description: "Allow workspace admins to export all workspace data as JSON", icon: Database, enabled: true },
  { key: "white_label", label: "White Labeling", description: "Allow enterprise workspaces to use custom branding and domains", icon: Settings, enabled: true },
  { key: "api_access", label: "API Access", description: "Enable programmatic API key creation and external access", icon: Zap, enabled: true },
];

export default function AdminSystem() {
  const queryClient = useQueryClient();
  const [flags, setFlags] = useState<FeatureFlag[]>(DEFAULT_FLAGS);
  const [activeTab, setTab] = useState<"flags" | "tiers" | "admins">("flags");

  const { data: superAdmins = [], isLoading: loadingAdmins } = useQuery({
    queryKey: ["admin-super-admins-list"],
    queryFn: async () => {
      const { data } = await supabase.from("super_admins").select("user_id, created_at");
      return data ?? [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-profiles-system"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name");
      return data ?? [];
    },
  });

  const { data: wsStats } = useQuery({
    queryKey: ["admin-system-stats"],
    queryFn: async () => {
      const [ws, sims, parts, segs] = await Promise.all([
        supabase.from("workspaces").select("id", { count: "exact", head: true }),
        supabase.from("simulations").select("id", { count: "exact", head: true }),
        supabase.from("participants").select("id", { count: "exact", head: true }),
        supabase.from("segment_profiles").select("id", { count: "exact", head: true }),
      ]);
      return {
        workspaces: ws.count || 0,
        simulations: sims.count || 0,
        participants: parts.count || 0,
        segments: segs.count || 0,
      };
    },
  });

  const [newAdminId, setNewAdminId] = useState("");

  const addSuperAdmin = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("super_admins").insert({ user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-super-admins-list"] });
      setNewAdminId("");
      toast.success("Super admin added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeSuperAdmin = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("super_admins").delete().eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-super-admins-list"] });
      toast.success("Super admin removed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const profileMap = profiles.reduce((a: Record<string, string>, p: any) => { a[p.id] = p.full_name || "—"; return a; }, {});

  const toggleFlag = (key: string) => {
    setFlags(prev => prev.map(f => f.key === key ? { ...f, enabled: !f.enabled } : f));
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Settings className="h-6 w-6 text-indigo-400" />
          System Configuration
        </h1>
        <p className="text-slate-500 text-sm mt-0.5">Global platform settings, feature flags &amp; access control</p>
      </div>

      {/* DB Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Workspaces", value: wsStats?.workspaces ?? "—" },
          { label: "Simulations", value: wsStats?.simulations ?? "—" },
          { label: "Participants", value: wsStats?.participants ?? "—" },
          { label: "Segment Profiles", value: wsStats?.segments ?? "—" },
        ].map(({ label, value }) => (
          <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">{value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800">
        {(["flags", "tiers", "admins"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm capitalize rounded-t-lg transition-colors ${
              activeTab === t ? "bg-slate-900 border border-b-0 border-slate-800 text-white" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {t === "flags" ? "Feature Flags" : t === "tiers" ? "Tier Limits" : "Super Admins"}
          </button>
        ))}
      </div>

      {/* Feature Flags */}
      {activeTab === "flags" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-600">Changes are local UI state — connect to a platform_config table to persist.</p>
            <button
              onClick={() => toast.success("Feature flags saved (UI only)")}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 rounded-lg text-sm transition-colors"
            >
              <Save className="h-3.5 w-3.5" /> Save Flags
            </button>
          </div>
          {flags.map(flag => (
            <div
              key={flag.key}
              className={`bg-slate-900 border rounded-xl p-4 flex items-center justify-between transition-all ${
                flag.enabled ? "border-indigo-500/30" : "border-slate-800 opacity-70"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${flag.enabled ? "bg-indigo-500/20" : "bg-slate-800"}`}>
                  <flag.icon className={`h-4 w-4 ${flag.enabled ? "text-indigo-400" : "text-slate-600"}`} />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{flag.label}</div>
                  <div className="text-xs text-slate-500">{flag.description}</div>
                </div>
              </div>
              <button
                onClick={() => toggleFlag(flag.key)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  flag.enabled ? "bg-indigo-600" : "bg-slate-700"
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  flag.enabled ? "translate-x-6" : "translate-x-1"
                }`} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Tier Limits */}
      {activeTab === "tiers" && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-3 px-4 py-3 border-b border-slate-800 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
            <span>Tier</span>
            <span>Members</span>
            <span>Simulations</span>
            <span>Digital Twins</span>
            <span>Participants</span>
            <span>Retention (days)</span>
          </div>
          <div className="divide-y divide-slate-800/40">
            {(Object.entries(TIER_LIMITS) as [string, typeof TIER_LIMITS.free][]).map(([tier, limits]) => (
              <div key={tier} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-3 px-4 py-4 items-center">
                <div>
                  <span className={`text-sm font-semibold capitalize px-2 py-1 rounded-lg ${
                    tier === "enterprise" ? "bg-amber-500/20 text-amber-400" :
                    tier === "professional" ? "bg-purple-500/20 text-purple-400" :
                    tier === "starter" ? "bg-blue-500/20 text-blue-400" :
                    "bg-slate-700 text-slate-300"
                  }`}>{tier}</span>
                </div>
                {[limits.members, limits.simulations, limits.twins, limits.participants, limits.retention].map((val, i) => (
                  <div key={i} className="text-sm text-slate-300 font-mono">
                    {val >= 999 ? "∞" : val}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Super Admins */}
      {activeTab === "admins" && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
              <Shield className="h-4 w-4 text-indigo-400" />
              Super Admins ({superAdmins.length})
            </div>
            {loadingAdmins ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-600" /></div>
            ) : (
              <div className="space-y-2">
                {superAdmins.map((sa: any) => (
                  <div key={sa.user_id} className="flex items-center justify-between bg-slate-800/40 rounded-lg px-4 py-3">
                    <div>
                      <div className="text-sm font-medium text-white">{profileMap[sa.user_id] || "—"}</div>
                      <div className="text-xs text-slate-500 font-mono">{sa.user_id}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500">Added {new Date(sa.created_at).toLocaleDateString()}</span>
                      <button
                        onClick={() => removeSuperAdmin.mutate(sa.user_id)}
                        className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-slate-900 border border-indigo-500/30 rounded-xl p-5">
            <div className="text-sm font-semibold text-slate-300 mb-3">Add Super Admin by User ID</div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="User UUID (e.g. d7466901-d2d8-...)"
                value={newAdminId}
                onChange={e => setNewAdminId(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
              <button
                onClick={() => addSuperAdmin.mutate(newAdminId.trim())}
                disabled={!newAdminId.trim()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
