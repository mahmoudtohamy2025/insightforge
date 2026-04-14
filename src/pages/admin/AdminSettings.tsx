import { useState } from "react";
import { Settings, Shield, Globe, Bell, Zap, Database } from "lucide-react";

interface FeatureFlag {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  icon: React.ElementType;
}

const DEFAULT_FLAGS: FeatureFlag[] = [
  {
    key: "ai_simulations",
    label: "AI Simulations",
    description: "Enable AI-powered digital twin simulations across the platform",
    enabled: true,
    icon: Zap,
  },
  {
    key: "participant_portal",
    label: "Participant Portal",
    description: "Allow participants to sign up and join studies via the /participate routes",
    enabled: true,
    icon: Globe,
  },
  {
    key: "incentive_payouts",
    label: "Incentive Payouts",
    description: "Enable workspace admins to create incentive programs and disburse rewards",
    enabled: true,
    icon: Database,
  },
  {
    key: "email_notifications",
    label: "Email Notifications",
    description: "Send transactional emails for study invitations, payout confirmations, etc.",
    enabled: false,
    icon: Bell,
  },
  {
    key: "marketplace",
    label: "Segment Marketplace",
    description: "Allow workspaces to share and trade consumer segments across the platform",
    enabled: true,
    icon: Globe,
  },
  {
    key: "data_export",
    label: "Workspace Data Export",
    description: "Allow workspace admins to export all workspace data as JSON",
    enabled: true,
    icon: Database,
  },
];

export default function AdminSettings() {
  const [flags, setFlags] = useState<FeatureFlag[]>(DEFAULT_FLAGS);

  const toggleFlag = (key: string) => {
    setFlags((prev) =>
      prev.map((f) => (f.key === key ? { ...f, enabled: !f.enabled } : f))
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Platform Settings</h1>
        <p className="text-slate-400 mt-1">Global configuration for the InsightForge platform</p>
      </div>

      {/* Feature Flags */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Settings className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Feature Flags</h2>
            <p className="text-sm text-slate-500">Toggle platform features globally</p>
          </div>
        </div>

        <div className="space-y-3">
          {flags.map((flag) => (
            <div
              key={flag.key}
              className="flex items-center justify-between bg-slate-800/30 rounded-lg px-5 py-4 hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <flag.icon className="h-5 w-5 text-slate-400 shrink-0" />
                <div>
                  <div className="text-sm font-medium text-white">{flag.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{flag.description}</div>
                </div>
              </div>
              <button
                onClick={() => toggleFlag(flag.key)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  flag.enabled ? "bg-indigo-500" : "bg-slate-700"
                }`}
              >
                <div
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    flag.enabled ? "translate-x-6" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Tier Limits */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Default Tier Limits</h2>
            <p className="text-sm text-slate-500">Configure default limits per workspace tier</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                  Limit
                </th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                  Free
                </th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                  Starter
                </th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                  Professional
                </th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                  Enterprise
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {[
                { label: "Team Members", free: "1", starter: "5", pro: "20", ent: "Unlimited" },
                { label: "AI Simulations / mo", free: "5", starter: "50", pro: "500", ent: "Unlimited" },
                { label: "Digital Twins", free: "2", starter: "10", pro: "50", ent: "Unlimited" },
                { label: "Participants", free: "20", starter: "200", pro: "2,000", ent: "Unlimited" },
                { label: "Data Retention", free: "90 days", starter: "1 year", pro: "2 years", ent: "Custom" },
                { label: "API Access", free: "—", starter: "Read", pro: "Full", ent: "Full" },
                { label: "White-Label", free: "—", starter: "—", pro: "—", ent: "✓" },
              ].map((row) => (
                <tr key={row.label}>
                  <td className="px-4 py-3 text-sm text-slate-300 font-medium">{row.label}</td>
                  <td className="px-4 py-3 text-sm text-slate-400 text-center">{row.free}</td>
                  <td className="px-4 py-3 text-sm text-blue-400 text-center">{row.starter}</td>
                  <td className="px-4 py-3 text-sm text-purple-400 text-center">{row.pro}</td>
                  <td className="px-4 py-3 text-sm text-amber-400 text-center">{row.ent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Platform Info */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Platform Info</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="flex justify-between bg-slate-800/30 rounded-lg px-4 py-3">
            <span className="text-slate-400">Version</span>
            <span className="text-white font-mono">1.0.0</span>
          </div>
          <div className="flex justify-between bg-slate-800/30 rounded-lg px-4 py-3">
            <span className="text-slate-400">Environment</span>
            <span className="text-emerald-400 font-mono">production</span>
          </div>
          <div className="flex justify-between bg-slate-800/30 rounded-lg px-4 py-3">
            <span className="text-slate-400">Supabase Region</span>
            <span className="text-white">US East</span>
          </div>
          <div className="flex justify-between bg-slate-800/30 rounded-lg px-4 py-3">
            <span className="text-slate-400">Last Deployment</span>
            <span className="text-white">{new Date().toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
