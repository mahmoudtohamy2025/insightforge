import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, TrendingUp, Clock, Loader2, Wallet } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { CashoutProgressRing } from "@/components/participant/CashoutProgressRing";
import { EarningsStreakBadge } from "@/components/participant/EarningsStreakBadge";
import { EarningsSparkline } from "@/components/participant/EarningsSparkline";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  available: { label: "Available", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" },
  pending:   { label: "Pending",   color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  paid:      { label: "Paid",      color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  processing:{ label: "Processing",color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
};

// Trigger confetti — zero-dependency DOM implementation
async function fireConfetti() {
  const emojis = ["💰", "🎉", "✨", "🌟", "💵"];
  const container = document.body;
  const count = 40;
  for (let i = 0; i < count; i++) {
    const el = document.createElement("span");
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    el.style.cssText = `
      position:fixed;
      top:-2rem;
      left:${Math.random() * 100}vw;
      font-size:${1.2 + Math.random() * 1}rem;
      pointer-events:none;
      z-index:9999;
      animation: confettiFall ${1.5 + Math.random() * 1.5}s ease-in forwards;
      animation-delay: ${Math.random() * 0.8}s;
    `;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }
  // inject keyframe once
  if (!document.getElementById("confetti-style")) {
    const style = document.createElement("style");
    style.id = "confetti-style";
    style.textContent = `@keyframes confettiFall { to { transform: translateY(110vh) rotate(720deg); opacity:0; } }`;
    document.head.appendChild(style);
  }
}

export default function Earnings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [cashoutLoading, setCashoutLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["participant-earnings", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("participant-profile");
      if (error) throw error;
      return data as {
        earnings: {
          total_earned_cents: number;
          pending_cents: number;
          available_cents: number;
          history: Array<{ id: string; amount_cents: number; status: string; description: string; created_at: string }>;
        };
        reputation: { streak_weeks?: number; total_studies: number } | null;
      };
    },
    enabled: !!user,
  });

  const CASHOUT_THRESHOLD = 500; // $5.00 in cents
  const available = data?.earnings?.available_cents ?? 0;
  const pending = data?.earnings?.pending_cents ?? 0;
  const total = data?.earnings?.total_earned_cents ?? 0;
  const history = data?.earnings?.history ?? [];
  const streakWeeks = data?.reputation?.streak_weeks ?? 0;
  const canCashout = available >= CASHOUT_THRESHOLD;

  // Build sparkline data from history (last 30 days grouped by date)
  const sparklineData = (() => {
    const byDate: Record<string, number> = {};
    history
      .filter((e) => e.status === "available" || e.status === "paid")
      .forEach((e) => {
        const date = e.created_at.slice(0, 10);
        byDate[date] = (byDate[date] || 0) + e.amount_cents;
      });
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([date, amount_cents]) => ({ date, amount_cents }));
  })();

  const cashoutMutation = useMutation({
    mutationFn: async () => {
      setCashoutLoading(true);
      const { data, error } = await supabase.functions.invoke("participant-cashout");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: async (data) => {
      await fireConfetti();
      queryClient.invalidateQueries({ queryKey: ["participant-earnings"] });
      toast({
        title: `💰 ${formatCents(available)} is on its way!`,
        description: data?.method === "tremendous"
          ? "Your payout has been initiated. Check your email for details."
          : "Your payout is being processed manually.",
      });
    },
    onError: (err) => {
      toast({ title: "Cashout Failed", description: err.message, variant: "destructive" });
    },
    onSettled: () => setCashoutLoading(false),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wallet className="h-6 w-6 text-primary" />
          Earnings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track your research rewards. Cash out instantly at ${(CASHOUT_THRESHOLD / 100).toFixed(2)}+.
        </p>
      </div>

      {/* Streak */}
      {streakWeeks > 0 && <EarningsStreakBadge streakWeeks={streakWeeks} />}

      {/* Top metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Cashout progress ring */}
        <Card className="border-primary/20">
          <CardContent className="pt-6 flex flex-col items-center gap-4">
            <CashoutProgressRing available={available} threshold={CASHOUT_THRESHOLD} />
            <Button
              className="w-full"
              onClick={() => cashoutMutation.mutate()}
              disabled={!canCashout || cashoutLoading}
            >
              {cashoutLoading && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
              {canCashout ? `Cash Out ${formatCents(available)}` : `Earn ${formatCents(CASHOUT_THRESHOLD - available)} more`}
            </Button>
          </CardContent>
        </Card>

        {/* Pending */}
        <Card className="border-yellow-200/50 dark:border-yellow-800/30">
          <CardContent className="pt-6 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Pending</p>
              <div className="h-8 w-8 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{formatCents(pending)}</p>
            <p className="text-xs text-muted-foreground">Awaiting researcher approval</p>
          </CardContent>
        </Card>

        {/* Total earned with sparkline */}
        <Card>
          <CardContent className="pt-6 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Lifetime Total</p>
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
            </div>
            <p className="text-3xl font-bold">{formatCents(total)}</p>
            <EarningsSparkline data={sparklineData} />
          </CardContent>
        </Card>
      </div>

      {/* Transaction history */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <DollarSign className="h-10 w-10 mx-auto text-muted-foreground/30" />
              <p className="text-sm font-medium">No transactions yet</p>
              <p className="text-xs text-muted-foreground">Complete a study to earn your first reward.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((entry) => {
                const statusCfg = STATUS_CONFIG[entry.status] || STATUS_CONFIG.pending;
                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between py-3 border-b last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{entry.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(entry.created_at).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", year: "numeric"
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={cn(
                        "text-sm font-semibold",
                        entry.amount_cents > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                      )}>
                        {entry.amount_cents > 0 ? "+" : ""}{formatCents(entry.amount_cents)}
                      </span>
                      <Badge className={cn("text-xs shrink-0", statusCfg.color)}>
                        {statusCfg.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
