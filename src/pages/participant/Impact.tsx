import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Award, TrendingUp, Star, Zap, Brain } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface BadgeItem {
  id: string;
  name: string;
  icon: string;
  earned: boolean;
  description: string;
}

interface ImpactFeedItem {
  type: string;
  message: string;
  timestamp: string;
}

const TIER_STYLES: Record<string, { color: string; bg: string }> = {
  newcomer: { color: "text-muted-foreground", bg: "bg-muted" },
  regular: { color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/30" },
  trusted: { color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-900/30" },
  expert: { color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-100 dark:bg-orange-900/30" },
  elite: { color: "text-yellow-600 dark:text-yellow-400", bg: "bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30" },
};

export default function Impact() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["participant-impact", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("participant-impact");
      if (error) throw error;
      return data as {
        reputation: Record<string, unknown> | null;
        badges: BadgeItem[];
        impactFeed: ImpactFeedItem[];
        stats: { total_studies: number; twin_contributions: number; completion_rate: number; avg_rating: number };
        tierProgress: { current: string; next: string; progress: number; studiesNeeded: number; studiesCompleted: number };
      };
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const stats = data?.stats || { total_studies: 0, twin_contributions: 0, completion_rate: 100, avg_rating: 5.0 };
  const badges = data?.badges || [];
  const impactFeed = data?.impactFeed || [];
  const tierProgress = data?.tierProgress || { current: "newcomer", next: "regular", progress: 0, studiesNeeded: 3, studiesCompleted: 0 };
  const tierStyle = TIER_STYLES[tierProgress.current] || TIER_STYLES.newcomer;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          Your Impact
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          See how your contributions power AI research and shape real products.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 text-center">
            <Award className="h-6 w-6 mx-auto text-primary mb-2" />
            <p className="text-2xl font-bold">{stats.total_studies}</p>
            <p className="text-xs text-muted-foreground">Studies Done</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-center">
            <Zap className="h-6 w-6 mx-auto text-yellow-500 mb-2" />
            <p className="text-2xl font-bold">{stats.twin_contributions}</p>
            <p className="text-xs text-muted-foreground">AI Twins Powered</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-center">
            <TrendingUp className="h-6 w-6 mx-auto text-green-500 mb-2" />
            <p className="text-2xl font-bold">{stats.completion_rate}%</p>
            <p className="text-xs text-muted-foreground">Completion Rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-center">
            <Star className="h-6 w-6 mx-auto text-yellow-500 mb-2" />
            <p className="text-2xl font-bold">{Number(stats.avg_rating).toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Avg Rating</p>
          </CardContent>
        </Card>
      </div>

      {/* Tier Progress */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Reputation Tier
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Badge className={cn("text-sm px-4 py-1.5 capitalize", tierStyle.bg, tierStyle.color)}>
              {tierProgress.current}
            </Badge>
            {tierProgress.current !== "elite" && (
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-muted-foreground">
                    {tierProgress.studiesCompleted} / {tierProgress.studiesNeeded} studies to <span className="font-medium capitalize">{tierProgress.next}</span>
                  </span>
                  <span className="text-xs font-medium">{tierProgress.progress}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${tierProgress.progress}%` }}
                  />
                </div>
              </div>
            )}
            {tierProgress.current === "elite" && (
              <span className="text-sm text-muted-foreground">👑 You've reached the highest tier!</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Badges */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Badges</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {badges.map((badge) => (
              <div
                key={badge.id}
                className={cn(
                  "rounded-lg border p-4 text-center transition-all",
                  badge.earned
                    ? "bg-primary/5 border-primary/20"
                    : "opacity-40 grayscale"
                )}
              >
                <span className="text-3xl">{badge.icon}</span>
                <p className="text-sm font-medium mt-2">{badge.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{badge.description}</p>
                {badge.earned && (
                  <Badge variant="secondary" className="mt-2 text-xs">Earned ✓</Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Impact Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Impact Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {impactFeed.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Sparkles className="h-8 w-8 mx-auto opacity-30 mb-2" />
              <p className="text-sm">
                Complete studies to see how your data impacts real products and AI models.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {impactFeed.map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg border">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    {item.type === "twin" ? (
                      <Zap className="h-4 w-4 text-primary" />
                    ) : (
                      <Award className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm">{item.message}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(item.timestamp).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {/* My Twin CTA */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-purple-500/5">
        <CardContent className="py-6 flex flex-col sm:flex-row items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center shrink-0">
            <Brain className="h-7 w-7 text-primary" />
          </div>
          <div className="flex-1 text-center sm:text-left">
            <p className="font-semibold">Curious how our AI models you?</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              See your AI Twin — your personality archetype, behavioral traits, and calibration score.
            </p>
          </div>
          <Link to="/participate/my-twin" className="shrink-0">
            <Button variant="outline" className="gap-2">
              <Brain className="h-4 w-4" />
              View My Twin
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
