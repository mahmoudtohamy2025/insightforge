import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Users, Star, TrendingUp, Loader2, Flame } from "lucide-react";

const TIER_COLOR: Record<string, string> = {
  newcomer: "bg-slate-700 text-slate-300",
  regular: "bg-blue-500/20 text-blue-400",
  trusted: "bg-emerald-500/20 text-emerald-400",
  expert: "bg-purple-500/20 text-purple-400",
  elite: "bg-amber-500/20 text-amber-400",
};

export default function AdminParticipants() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"directory" | "earnings" | "referrals">("directory");

  const { data: pProfiles = [], isLoading } = useQuery({
    queryKey: ["admin-p-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_profiles" as any)
        .select("id, display_name, country, status, created_at, verified_at");
      if (error) return [];
      return data ?? [];
    },
  });

  const { data: pReputation = [] } = useQuery({
    queryKey: ["admin-p-reputation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_reputation" as any)
        .select("participant_id, tier, total_studies, completion_rate, avg_rating, total_earned_cents, streak_weeks");
      if (error) return [];
      return data ?? [];
    },
  });

  const { data: pEarnings = [] } = useQuery({
    queryKey: ["admin-p-earnings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_earnings" as any)
        .select("participant_id, amount_cents, status, earning_type, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) return [];
      return data ?? [];
    },
  });

  const { data: pReferrals = [] } = useQuery({
    queryKey: ["admin-p-referrals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_referrals" as any)
        .select("id, referral_code, status, referrer_bonus_cents, referred_bonus_cents, created_at, signed_up_at")
        .order("created_at", { ascending: false });
      if (error) return [];
      return data ?? [];
    },
  });

  const repMap = pReputation.reduce((a: Record<string, any>, r: any) => { a[r.participant_id] = r; return a; }, {});

  const totalEarned = pEarnings
    .filter((e: any) => e.status === "paid")
    .reduce((s: number, e: any) => s + (e.amount_cents || 0), 0);
  const avgRating = pReputation.length
    ? pReputation.reduce((s: number, r: any) => s + (r.avg_rating || 0), 0) / pReputation.length
    : 0;

  const filteredProfiles = pProfiles.filter((p: any) => {
    const q = search.toLowerCase();
    return p.display_name?.toLowerCase().includes(q) || p.id?.includes(q) || p.country?.toLowerCase().includes(q);
  });

  const referralStats = {
    total: pReferrals.length,
    completed: pReferrals.filter((r: any) => r.status === "completed").length,
    pending: pReferrals.filter((r: any) => r.status === "pending").length,
    totalBonusCents: pReferrals.filter((r: any) => r.status === "paid")
      .reduce((s: number, r: any) => s + (r.referrer_bonus_cents || 0) + (r.referred_bonus_cents || 0), 0),
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Participant Marketplace</h1>
        <p className="text-slate-500 text-sm mt-0.5">Global view of all research participants</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Users, label: "Total Participants", value: pProfiles.length, color: "bg-blue-500" },
          { icon: Star, label: "Avg Quality Rating", value: avgRating.toFixed(2), color: "bg-amber-500" },
          { icon: TrendingUp, label: "Total Paid Out", value: `$${(totalEarned / 100).toLocaleString()}`, color: "bg-emerald-500" },
          { icon: Flame, label: "Active Referrals", value: referralStats.total, color: "bg-purple-500" },
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

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-0">
        {(["directory", "earnings", "referrals"] as const).map(t => (
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

      {/* Directory Tab */}
      {tab === "directory" && (
        <div className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search participants…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-600" /></div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="grid grid-cols-[2fr_1fr_80px_80px_80px_100px_80px] gap-3 px-4 py-3 border-b border-slate-800 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                <span>Participant</span>
                <span>Tier</span>
                <span>Studies</span>
                <span>Rating</span>
                <span>Streak</span>
                <span>Earned</span>
                <span>Status</span>
              </div>
              <div className="divide-y divide-slate-800/40">
                {filteredProfiles.map((p: any) => {
                  const rep = repMap[p.id] || {};
                  return (
                    <div key={p.id} className="grid grid-cols-[2fr_1fr_80px_80px_80px_100px_80px] gap-3 px-4 py-3 items-center hover:bg-slate-800/20">
                      <div>
                        <div className="text-sm text-white">{p.display_name}</div>
                        <div className="text-[10px] text-slate-600">{p.country || "—"}</div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize w-fit ${TIER_COLOR[rep.tier || "newcomer"]}`}>
                        {rep.tier || "newcomer"}
                      </span>
                      <div className="text-sm text-slate-300">{rep.total_studies || 0}</div>
                      <div className="text-sm text-slate-300">{rep.avg_rating ? `${rep.avg_rating}★` : "—"}</div>
                      <div className="text-sm text-slate-300">{rep.streak_weeks ? `${rep.streak_weeks}w 🔥` : "—"}</div>
                      <div className="text-sm text-slate-300">${((rep.total_earned_cents || 0) / 100).toFixed(2)}</div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        p.status === "active" ? "bg-emerald-500/20 text-emerald-400" :
                        p.status === "suspended" ? "bg-amber-500/20 text-amber-400" :
                        "bg-red-500/20 text-red-400"
                      }`}>{p.status}</span>
                    </div>
                  );
                })}
              </div>
              {filteredProfiles.length === 0 && (
                <div className="text-center py-16 text-slate-600 text-sm">No participants registered yet</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Earnings Tab */}
      {tab === "earnings" && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="grid grid-cols-[2fr_1fr_1fr_80px_80px] gap-3 px-4 py-3 border-b border-slate-800 text-[11px] font-medium text-slate-500 uppercase tracking-wider">
            <span>Participant ID</span>
            <span>Type</span>
            <span>Status</span>
            <span>Amount</span>
            <span>Date</span>
          </div>
          <div className="divide-y divide-slate-800/40 max-h-[500px] overflow-y-auto">
            {pEarnings.map((e: any) => (
              <div key={e.id} className="grid grid-cols-[2fr_1fr_1fr_80px_80px] gap-3 px-4 py-2.5 items-center hover:bg-slate-800/20">
                <div className="text-xs text-slate-400 font-mono truncate">{e.participant_id}</div>
                <span className="text-xs text-slate-400 capitalize">{e.earning_type}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize w-fit ${
                  e.status === "paid" ? "bg-emerald-500/20 text-emerald-400" :
                  e.status === "pending" ? "bg-amber-500/20 text-amber-400" :
                  "bg-slate-700 text-slate-400"
                }`}>{e.status}</span>
                <div className="text-sm text-slate-200 font-mono">${(e.amount_cents / 100).toFixed(2)}</div>
                <div className="text-xs text-slate-500">{new Date(e.created_at).toLocaleDateString()}</div>
              </div>
            ))}
            {pEarnings.length === 0 && <div className="text-center py-10 text-slate-600 text-sm">No earnings recorded</div>}
          </div>
        </div>
      )}

      {/* Referrals Tab */}
      {tab === "referrals" && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            {[
              ["Total Referrals", referralStats.total],
              ["Completed", referralStats.completed],
              ["Pending", referralStats.pending],
              ["Bonuses Paid", `$${(referralStats.totalBonusCents / 100).toFixed(2)}`],
            ].map(([k, v]) => (
              <div key={k as string} className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-white">{v}</div>
                <div className="text-xs text-slate-500 mt-0.5">{k}</div>
              </div>
            ))}
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="grid grid-cols-[2fr_1fr_80px_80px] gap-3 px-4 py-3 border-b border-slate-800 text-[11px] font-medium text-slate-500 uppercase">
              <span>Referral Code</span>
              <span>Status</span>
              <span>Bonus</span>
              <span>Date</span>
            </div>
            <div className="divide-y divide-slate-800/40 max-h-[400px] overflow-y-auto">
              {pReferrals.map((r: any) => (
                <div key={r.id} className="grid grid-cols-[2fr_1fr_80px_80px] gap-3 px-4 py-2.5 items-center">
                  <div className="text-xs font-mono text-slate-300">{r.referral_code}</div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize w-fit ${
                    r.status === "completed" ? "bg-emerald-500/20 text-emerald-400" :
                    r.status === "signed_up" ? "bg-blue-500/20 text-blue-400" :
                    "bg-slate-700 text-slate-400"
                  }`}>{r.status}</span>
                  <div className="text-xs text-slate-300">${((r.referrer_bonus_cents + r.referred_bonus_cents) / 100).toFixed(2)}</div>
                  <div className="text-xs text-slate-500">{new Date(r.created_at).toLocaleDateString()}</div>
                </div>
              ))}
              {pReferrals.length === 0 && <div className="text-center py-10 text-slate-600 text-sm">No referrals yet</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
