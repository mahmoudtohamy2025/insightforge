import { useUsage } from "@/hooks/useUsage";
import { useI18n } from "@/lib/i18n";
import { TIER_LIMITS, TIER_TOKEN_BUDGETS, getUsagePercent, getUsageStatus } from "@/lib/tierLimits";
import { Zap, Users, FileText, FolderOpen, MessageSquare } from "lucide-react";

/** Color map for usage status */
const statusColors = {
  ok: "bg-primary",
  warning: "bg-amber-500",
  critical: "bg-red-500",
};

const statusBg = {
  ok: "bg-primary/10",
  warning: "bg-amber-500/10",
  critical: "bg-red-500/10",
};

interface UsageMeterProps {
  /** Show compact version (just the bar) */
  compact?: boolean;
  /** Show token usage in addition to resource usage */
  showTokens?: boolean;
}

export function UsageMeter({ compact = false, showTokens = true }: UsageMeterProps) {
  const { usage, tier } = useUsage();
  const { t } = useI18n();

  if (!usage) return null;

  const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
  const tokenBudget = TIER_TOKEN_BUDGETS[tier] || 0;

  const resources = [
    {
      key: "sessions",
      label: t("billing.sessions"),
      icon: MessageSquare,
      current: usage.sessions,
      limit: limits.sessions as number,
    },
    {
      key: "surveys",
      label: t("billing.surveys"),
      icon: FileText,
      current: usage.surveys,
      limit: limits.surveys as number,
    },
    {
      key: "members",
      label: t("billing.members"),
      icon: Users,
      current: usage.members,
      limit: limits.members as number,
    },
    {
      key: "projects",
      label: t("billing.projects"),
      icon: FolderOpen,
      current: usage.projects,
      limit: limits.projects as number,
    },
  ];

  if (compact) {
    return (
      <div className="space-y-2">
        {resources.map((r) => {
          const pct = getUsagePercent(r.current, r.limit);
          const status = getUsageStatus(pct);
          return (
            <div key={r.key} className="flex items-center gap-2">
              <r.icon className="h-3 w-3 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div
                    className={`rounded-full h-1.5 transition-all ${statusColors[status]}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {r.limit === -1 ? `${r.current}` : `${r.current}/${r.limit}`}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">{t("billing.usage")}</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {resources.map((r) => {
          const pct = getUsagePercent(r.current, r.limit);
          const status = getUsageStatus(pct);
          return (
            <div
              key={r.key}
              className={`rounded-lg border p-3 space-y-2 ${
                status === "critical" ? "border-red-500/30" :
                status === "warning" ? "border-amber-500/30" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center ${statusBg[status]}`}>
                    <r.icon className="h-3.5 w-3.5 text-foreground" />
                  </div>
                  <span className="text-xs font-medium">{r.label}</span>
                </div>
                <span className="text-xs font-mono text-muted-foreground">
                  {r.limit === -1 ? (
                    <>{r.current} / {t("billing.unlimited")}</>
                  ) : (
                    `${r.current} / ${r.limit}`
                  )}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className={`rounded-full h-2 transition-all duration-500 ${statusColors[status]}`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Token Usage */}
      {showTokens && tokenBudget > 0 && (
        <div className="rounded-lg border border-border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-purple-500/10 flex items-center justify-center">
                <Zap className="h-3.5 w-3.5 text-purple-500" />
              </div>
              <span className="text-xs font-medium">AI Tokens (Monthly)</span>
            </div>
            <span className="text-xs font-mono text-muted-foreground">
              {(usage.tokensUsed || 0).toLocaleString()} / {tokenBudget.toLocaleString()}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className={`rounded-full h-2 transition-all duration-500 ${
                statusColors[getUsageStatus(getUsagePercent(usage.tokensUsed || 0, tokenBudget))]
              }`}
              style={{ width: `${Math.min(getUsagePercent(usage.tokensUsed || 0, tokenBudget), 100)}%` }}
            />
          </div>
        </div>
      )}

      {tokenBudget === 0 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
          <div className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-xs text-amber-600 dark:text-amber-400">
              AI simulations are not available on your current plan. Upgrade to unlock.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
