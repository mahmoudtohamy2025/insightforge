import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { DollarSign, Star, Award, TrendingUp, ArrowRight, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ProfileCompletionBanner } from "@/components/participant/ProfileCompletionBanner";
import { SocialShareCard } from "@/components/participant/SocialShareCard";

const TIER_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  newcomer: { label: "Newcomer", color: "bg-muted text-muted-foreground", icon: "🌱" },
  regular: { label: "Regular", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", icon: "⭐" },
  trusted: { label: "Trusted", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400", icon: "💎" },
  expert: { label: "Expert", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400", icon: "🏆" },
  elite: { label: "Elite", color: "bg-gradient-to-r from-yellow-200 to-amber-200 text-amber-900", icon: "👑" },
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function ParticipantDashboard() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["participant-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("participant-profile");
      if (error) throw error;
      return data as {
        profile: Record<string, unknown>;
        reputation: Record<string, unknown> | null;
        earnings: { total_earned_cents: number; pending_cents: number; available_cents: number };
      };
    },
    enabled: !!user,
  });

  const { data: activeStudies, isLoading: studiesLoading } = useQuery({
    queryKey: ["active-studies-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("study_listings")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");
      return count || 0;
    },
  });

  const profile = data?.profile;
  const reputation = data?.reputation;
  const earnings = data?.earnings;
  const tier = (reputation?.tier as string) || "newcomer";
  const tierConfig = TIER_CONFIG[tier] || TIER_CONFIG.newcomer;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Welcome back, {(profile?.display_name as string) || "Participant"} 👋
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Here's your research participation overview.
          </p>
        </div>
        <Badge className={cn("text-sm px-3 py-1", tierConfig.color)}>
          {tierConfig.icon} {tierConfig.label}
        </Badge>
      </div>

      {/* Profile completion nudge */}
      <ProfileCompletionBanner />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-green-200/50 dark:border-green-800/30">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Available</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                  {formatCents(earnings?.available_cents || 0)}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-200/50 dark:border-yellow-800/30">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Pending</p>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">
                  {formatCents(earnings?.pending_cents || 0)}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Studies Done</p>
                <p className="text-2xl font-bold mt-1">{(reputation?.total_studies as number) || 0}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Award className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Avg. Rating</p>
                <p className="text-2xl font-bold mt-1">
                  {((reputation?.avg_rating as number) || 5.0).toFixed(1)}
                  <Star className="h-4 w-4 text-yellow-500 inline ml-1 -mt-1" />
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                <Star className="h-5 w-5 text-yellow-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Available Studies CTA */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/[0.03] to-transparent">
        <CardContent className="py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Search className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">
                  {studiesLoading ? "..." : activeStudies} Studies Available
                </h3>
                <p className="text-sm text-muted-foreground">
                  Browse and accept studies matched to your profile.
                </p>
              </div>
            </div>
            <Link to="/participate/studies">
              <Button>
                Browse Studies <ArrowRight className="h-4 w-4 ms-2" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Total Earned */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lifetime Earnings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2">
            <span className="text-4xl font-bold">{formatCents(earnings?.total_earned_cents || 0)}</span>
            <span className="text-sm text-muted-foreground mb-1">total earned</span>
          </div>
          <div className="mt-4">
            <Link to="/participate/earnings">
              <Button variant="outline" size="sm">
                View Earnings History <ArrowRight className="h-3 w-3 ms-1" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Social Share Call-to-action */}
      <SocialShareCard />
    </div>
  );
}
