import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditCard, Shield, AlertTriangle, BarChart3, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { TIER_LIMITS, TIER_PRICES, TIER_ORDER, STRIPE_TIER_MAP, getUsagePercent, getUsageStatus } from "@/lib/tierLimits";
import { useSubscription } from "@/hooks/useSubscription";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { UsageMeter } from "@/components/UsageMeter";

function TierRow({ label, values, currentTier }: { label: string; values: string[]; currentTier: string }) {
  return (
    <TableRow>
      <TableCell className="text-sm">{label}</TableCell>
      {TIER_ORDER.map((tier, i) => (
        <TableCell key={tier} className={cn("text-center text-sm", tier === currentTier && "bg-primary/5 font-medium")}>
          {values[i]}
        </TableCell>
      ))}
    </TableRow>
  );
}

function formatLimit(limit: number): string {
  if (limit <= 0) return "Unlimited";
  return limit.toString();
}

export function BillingTab({ currentWorkspace, t, isOwner }: { currentWorkspace: any; t: (k: string) => string; isOwner: boolean }) {
  const workspaceId = currentWorkspace?.id;
  const currentTier = currentWorkspace?.tier || "free";
  const limits = TIER_LIMITS[currentTier] || TIER_LIMITS.free;
  const { subscribed, tier: subTier, subscriptionEnd, isLoading: subLoading, refetch } = useSubscription();
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      refetch();
      window.history.replaceState({}, "", window.location.pathname + "?tab=billing");
    }
  }, [refetch]);

  // The usage data is now handled by the UsageMeter component
  // which internally uses the useUsage hook to fetch and calculate everything,
  // including AI tokens.

  const tierIndex = (TIER_ORDER as readonly string[]).indexOf(currentTier);
  const nextTier = tierIndex < TIER_ORDER.length - 1 ? TIER_ORDER[tierIndex + 1] : null;

  const handleCheckout = async (tier: string) => {
    const mapping = STRIPE_TIER_MAP[tier];
    if (!mapping) return;
    setCheckoutLoading(tier);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { price_id: mapping.price_id, workspace_id: workspaceId },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setPortalLoading(false);
    }
  };

  const activeTier = subTier || currentTier;

  return (
    <>
      {/* Current Plan Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            {t("billing.currentPlan")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div>
              <p className="text-lg font-bold capitalize">{t(`billing.${activeTier}`)}</p>
              <p className="text-sm text-muted-foreground">{TIER_PRICES[activeTier]}</p>
            </div>
            <Badge className={cn("capitalize", currentWorkspace?.subscription_status === 'past_due' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary')}>
              {currentWorkspace?.subscription_status || "Active"}
            </Badge>
            {subLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>

          {subscribed && subscriptionEnd && (
            <div className="text-sm text-muted-foreground mb-4">
              {t("billing.renewsOn")}: {format(new Date(subscriptionEnd), "MMM d, yyyy")}
            </div>
          )}

          {subscribed && (
            <Button variant="outline" size="sm" onClick={handlePortal} disabled={portalLoading} className="mb-4">
              {portalLoading && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
              {t("billing.manageSubscription")}
            </Button>
          )}

          {nextTier && STRIPE_TIER_MAP[nextTier] && !subscribed && (
            <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-4 mt-2">
              <p className="text-sm font-medium">{t("billing.upgradeToNext").replace("{tier}", t(`billing.${nextTier}`))}</p>
              <p className="text-xs text-muted-foreground mt-1">{t("billing.upgradeDescription")}</p>
              <div className="flex gap-2 mt-3">
                <Button size="sm" onClick={() => handleCheckout(nextTier)} disabled={!!checkoutLoading}>
                  {checkoutLoading === nextTier && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                  {t("billing.upgradePlan")} → {t(`billing.${nextTier}`)}
                </Button>
              </div>
            </div>
          )}

          {subscribed && nextTier && STRIPE_TIER_MAP[nextTier] && (
            <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-4 mt-2">
              <p className="text-sm font-medium">{t("billing.upgradeToNext").replace("{tier}", t(`billing.${nextTier}`))}</p>
              <div className="flex gap-2 mt-3">
                <Button size="sm" onClick={() => handleCheckout(nextTier)} disabled={!!checkoutLoading}>
                  {checkoutLoading === nextTier && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                  {t("billing.upgradePlan")} → {t(`billing.${nextTier}`)}
                </Button>
              </div>
            </div>
          )}

          {currentTier !== "enterprise" && (
            <p className="text-xs text-muted-foreground mt-3">
              <a href="mailto:enterprise@insightforge.io" className="text-primary hover:underline">
                {t("billing.contactEnterprise")}
              </a>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Usage Meter Component */}
      <div className="mt-6 mb-6">
        <UsageMeter />
      </div>

      {/* Tier Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            {t("billing.comparePlans")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("billing.feature")}</TableHead>
                {TIER_ORDER.map((tier) => (
                  <TableHead key={tier} className="text-center">
                    <span className={cn("capitalize", tier === activeTier && "text-primary font-bold")}>
                      {t(`billing.${tier}`)}
                    </span>
                    {tier === activeTier && (
                      <Badge variant="outline" className="ms-1 text-[9px] py-0">{t("billing.currentTier")}</Badge>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TierRow label={t("billing.members")} values={TIER_ORDER.map((tier) => formatLimit(TIER_LIMITS[tier].members))} currentTier={activeTier} />
              <TierRow label={t("billing.sessions")} values={TIER_ORDER.map((tier) => formatLimit(TIER_LIMITS[tier].sessions))} currentTier={activeTier} />
              <TierRow label={t("billing.surveys")} values={TIER_ORDER.map((tier) => formatLimit(TIER_LIMITS[tier].surveys))} currentTier={activeTier} />
              <TierRow label={t("billing.projects")} values={TIER_ORDER.map((tier) => formatLimit(TIER_LIMITS[tier].projects))} currentTier={activeTier} />
              <TierRow label={t("billing.aiAnalysis")} values={TIER_ORDER.map((tier) => TIER_LIMITS[tier].aiAnalysis ? "✓" : "—")} currentTier={activeTier} />
              <TierRow label={t("billing.storage")} values={TIER_ORDER.map((tier) => TIER_LIMITS[tier].storage)} currentTier={activeTier} />
              <TierRow label={t("billing.supportLevel")} values={TIER_ORDER.map((tier) => TIER_LIMITS[tier].support)} currentTier={activeTier} />
              <TableRow>
                <TableCell></TableCell>
                {TIER_ORDER.map((tier) => (
                  <TableCell key={tier} className="text-center">
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">{TIER_PRICES[tier]}</span>
                      {STRIPE_TIER_MAP[tier] && tier !== activeTier && (
                        <div>
                          <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleCheckout(tier)} disabled={!!checkoutLoading}>
                            {checkoutLoading === tier && <Loader2 className="h-3 w-3 me-1 animate-spin" />}
                            {t("billing.upgradePlan")}
                          </Button>
                        </div>
                      )}
                    </div>
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
