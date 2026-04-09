import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useUsage } from "@/hooks/useUsage";
import { useI18n } from "@/lib/i18n";
import type { TierResource } from "@/lib/tierLimits";
import { AlertTriangle, Crown } from "lucide-react";

interface TierGateProps {
  resource: TierResource;
  children: ReactNode;
  /** Optional custom message override */
  message?: string;
  /** If true, only shows a warning instead of fully blocking */
  softBlock?: boolean;
}

/**
 * TierGate wraps a button or action component.
 * If the workspace's tier doesn't allow the action, it shows an upgrade prompt
 * instead of the children.
 */
export function TierGate({ resource, children, message, softBlock }: TierGateProps) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { checkAction, tier } = useUsage();
  const result = checkAction(resource);

  if (result.allowed) {
    return <>{children}</>;
  }

  if (softBlock) {
    return (
      <div className="space-y-2">
        {children}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <p className="text-xs">
            {message || result.message || t("billing.tierLimitTitle")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Disabled overlay */}
      <div className="opacity-40 pointer-events-none select-none">
        {children}
      </div>

      {/* Upgrade prompt */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-card border border-primary/30 rounded-xl px-5 py-4 text-center shadow-lg max-w-xs space-y-3">
          <div className="mx-auto w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Crown className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm font-medium">
            {message || result.message || t("billing.tierLimitTitle")}
          </p>
          <button
            onClick={() => navigate("/settings?tab=billing")}
            className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            {t("billing.upgradePlan")}
          </button>
        </div>
      </div>
    </div>
  );
}
