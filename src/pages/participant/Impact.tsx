import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Award, TrendingUp, Star, Zap, Brain, CheckCircle2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

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
  newcomer: { color: "text-muted-foreground",                bg: "bg-muted" },
  regular:  { color: "text-blue-600 dark:text-blue-400",     bg: "bg-blue-100 dark:bg-blue-900/30" },
  trusted:  { color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-900/30" },
  expert:   { color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-100 dark:bg-orange-900/30" },
  elite:    { color: "text-yellow-600 dark:text-yellow-400", bg: "bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30" },
};

const TIER_BENEFITS: Record<string, { icon: string; benefit: string; locked?: boolean }[]> = {
  newcomer: [
    { icon: "✅", benefit: "Access to standard studies" },
    { icon: "📧", benefit: "Email support" },
    { icon: "🔒", benefit: "Regular: +5% earnings bonus", locked: true },
    { icon: "🔒", benefit: "Trusted: Early access to studies", locked: true },
    { icon: "🔒", benefit: "Expert: Premium high-paying studies", locked: true },
  ],
  regular: [
    { icon: "✅", benefit: "Access to standard studies" },
    { icon: "✅", benefit: "+5% earnings bonus on all studies" },
    { icon: "✅", benefit: "Priority matching" },
    { icon: "🔒", benefit: "Trusted: Early access to studies", locked: true },
    { icon: "🔒", benefit: "Expert: Premium high-paying studies", locked: true },
  ],
  trusted: [
    { icon: "✅", benefit: "All Regular benefits" },
    { icon: "✅", benefit: "Early access to new studies" },
    { icon: "✅", benefit: "2× referral bonus" },
    { icon: "🔒", benefit: "Expert: Premium high-paying studies", locked: true },
    { icon: "🔒", benefit: "Elite: Exclusive research partnerships", locked: true },
  ],
  expert: [
    { icon: "✅", benefit: "All Trusted benefits" },
    { icon: "✅", benefit: "Premium high-paying studies (2× reward)" },
    { icon: "✅", benefit: "Dedicated account manager" },
    { icon: "🔒", benefit: "Elite: Exclusive research partnerships", locked: true },
    { icon: "🔒", benefit: "Elite: Revenue sharing opportunities", locked: true },
  ],
  elite: [
    { icon: "✅", benefit: "All Expert benefits" },
    { icon: "✅", benefit: "Exclusive research partnerships" },
    { icon: "✅", benefit: "Revenue sharing opportunities" },
    { icon: "✅", benefit: "3× referral bonus" },
    { icon: "✅", benefit: "Monthly bonus payments" },
  ],
};

// Achievement definitions
const ACHIEVEMENTS = [
  { id: "first_study",    icon: "🎯", name: "First Step",      desc: "Complete your first study",        threshold: 1,   metric: "total_studies" },
  { id: "ten_studies",    icon: "🏅", name: "Dedicated",       desc: "Complete 10 studies",               threshold: 10,  metric: "total_studies" },
  { id: "fifty_studies",  icon: "🏆", name: "Veteran",         desc: "Complete 50 studies",               threshold: 50,  metric: "total_studies" },
  { id: "first_dollar",   icon: "💵", name: "First Earner",    desc: "Earn your first dollar",            threshold: 100, metric: "total_earned_cents" },
  { id: "hundred_bucks",  icon: "💰", name: "Centurion",       desc: "Earn $100 total",                   threshold: 10000,metric: "total_earned_cents" },
  { id: "perfect_rating", icon: "⭐", name: "5-Star Panelist", desc: "Maintain a 5.0 average rating",    threshold: 5.0, metric: "avg_rating" },
];

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
        stats: { total_studies: number; twin_contributions: number; completion_rate: number; avg_rating: number; total_earned_cents?: number };
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
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const stats = data?.stats || { total_studies: 0, twin_contributions: 0, completion_rate: 100, avg_rating: 5.0, total_earned_cents: 0 };
  const badges = data?.badges || [];
  const impactFeed = data?.impactFeed || [];
  const tierProgress = data?.tierProgress || { current: "newcomer", next: "regular", progress: 0, studiesNeeded: 3, studiesCompleted: 0 };
  const tierStyle = TIER_STYLES[tierProgress.current] || TIER_STYLES.newcomer;
  const currentTierBenefits = TIER_BENEFITS[tierProgress.current] || TIER_BENEFITS.newcomer;

  // Calculate achievements
  const earnedAchievements = ACHIEVEMENTS.filter(a => {
    const val = stats[a.metric as keyof typeof stats] as number || 0;
    return val >= a.threshold;
  });

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
            <Badge className={cn("text-sm px-3 py-1 capitalize ml-auto", tierStyle.bg, tierStyle.color)}>
              {tierProgress.current}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {tierProgress.current !== "elite" && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-muted-foreground">
                  {tierProgress.studiesCompleted} / {tierProgress.studiesNeeded} studies to{" "}
                  <span className="font-medium capitalize">{tierProgress.next}</span>
                </span>
                <span className="text-xs font-medium">{tierProgress.progress}%</span>
              </div>
              <Progress value={tierProgress.progress} className="h-2" />
            </div>
          )}
          {tierProgress.current === "elite" && (
            <p className="text-sm text-muted-foreground">👑 You've reached the highest tier!</p>
          )}

          {/* Tier Benefits */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Your Benefits</p>
            <div className="space-y-2">
              {currentTierBenefits.map((b, i) => (
                <div key={i} className={cn("flex items-center gap-2 text-sm", b.locked && "opacity-40")}>
                  {b.locked ? <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                  <span>{b.benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Achievements */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Achievements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {ACHIEVEMENTS.map(a => {
              const earned = earnedAchievements.some(e => e.id === a.id);
              return (
                <div
                  key={a.id}
                  className={cn(
                    "rounded-lg border p-4 text-center transition-all",
                    earned ? "bg-primary/5 border-primary/20" : "opacity-40 grayscale"
                  )}
                >
                  <span className="text-3xl">{a.icon}</span>
                  <p className="text-sm font-medium mt-2">{a.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{a.desc}</p>
                  {earned && <Badge variant="secondary" className="mt-2 text-xs">Earned ✓</Badge>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Badges from API */}
      {badges.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Special Badges</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {badges.map(badge => (
                <div
                  key={badge.id}
                  className={cn(
                    "rounded-lg border p-4 text-center transition-all",
                    badge.earned ? "bg-primary/5 border-primary/20" : "opacity-40 grayscale"
                  )}
                >
                  <span className="text-3xl">{badge.icon}</span>
                  <p className="text-sm font-medium mt-2">{badge.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{badge.description}</p>
                  {badge.earned && <Badge variant="secondary" className="mt-2 text-xs">Earned ✓</Badge>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Impact Feed */}
      <Card>
        <CardHeader><CardTitle className="text-base">Impact Timeline</CardTitle></CardHeader>
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
                    {item.type === "twin" ? <Zap className="h-4 w-4 text-primary" /> : <Award className="h-4 w-4 text-primary" />}
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
