import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DollarSign, Star, Award, TrendingUp, ArrowRight, Search,
  BookOpen, Sparkles, Trophy, Zap, CheckCircle2, Clock,
  Target, Users, Gift, PlayCircle, MessageCircle, Heart,
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ProfileCompletionBanner } from "@/components/participant/ProfileCompletionBanner";
import { SocialShareCard } from "@/components/participant/SocialShareCard";

const TIER_CONFIG: Record<string, { label: string; color: string; icon: string; nextBenefit: string }> = {
  newcomer: { label: "Newcomer", color: "bg-muted text-muted-foreground",                                                           icon: "🌱", nextBenefit: "Complete 3 studies to unlock Regular" },
  regular:  { label: "Regular",  color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",                        icon: "⭐", nextBenefit: "+5% earnings bonus active" },
  trusted:  { label: "Trusted",  color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",                icon: "💎", nextBenefit: "Early access to new studies" },
  expert:   { label: "Expert",   color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",                icon: "🏆", nextBenefit: "Premium high-paying studies unlocked" },
  elite:    { label: "Elite",    color: "bg-gradient-to-r from-yellow-200 to-amber-200 text-amber-900",                            icon: "👑", nextBenefit: "Exclusive research partnerships active" },
};

// State-based content for different user stages
type UserState = "new" | "active" | "dormant";

function getUserState(totalStudies: number, lastActivity?: string): UserState {
  if (totalStudies === 0) return "new";
  if (lastActivity) {
    const days = (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24);
    if (days > 14) return "dormant";
  }
  return "active";
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function OnboardingChecklist({ totalStudies, profilePct, hasEarnings }: {
  totalStudies: number; profilePct: number; hasEarnings: boolean;
}) {
  const steps = [
    { label: "Create your account", done: true },
    { label: "Complete your profile (80%+)", done: profilePct >= 80 },
    { label: "Accept your first study", done: totalStudies > 0 },
    { label: "Earn your first reward", done: hasEarnings },
    { label: "Invite a friend", done: false },
  ];
  const completed = steps.filter(s => s.done).length;
  const pct = Math.round((completed / steps.length) * 100);

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/[0.03] to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          Getting Started
          <span className="text-xs font-normal text-muted-foreground ml-auto">{completed}/{steps.length} done</span>
        </CardTitle>
        <Progress value={pct} className="h-1.5 mt-1" />
      </CardHeader>
      <CardContent className="space-y-2">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-2.5 text-sm">
            <div className={cn(
              "h-5 w-5 rounded-full flex items-center justify-center shrink-0",
              step.done ? "bg-emerald-500" : "bg-muted border-2 border-border"
            )}>
              {step.done && <CheckCircle2 className="h-3 w-3 text-white" />}
            </div>
            <span className={cn(step.done && "line-through text-muted-foreground")}>{step.label}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function DormantUserBanner() {
  return (
    <Card className="border-amber-200/50 dark:border-amber-800/30 bg-amber-50/30 dark:bg-amber-900/10">
      <CardContent className="py-5">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
            <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-amber-800 dark:text-amber-300">Welcome back! You've been missed 👋</h3>
            <p className="text-sm text-amber-700/80 dark:text-amber-400/70 mt-1">
              New studies are waiting for you. Jump back in and keep your earning streak alive.
            </p>
            <Link to="/participate/studies" className="inline-flex mt-3">
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white">
                Browse New Studies <ArrowRight className="h-3.5 w-3.5 ms-1.5" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CommunityFeed() {
  const feedItems = [
    { id: 1, name: "Sarah J.", action: "completed a focus group", time: "2h ago", likes: 4, type: "study" },
    { id: 2, name: "Michael T.", action: "reached Trusted Tier", time: "5h ago", likes: 12, type: "tier" },
    { id: 3, name: "Elena R.", action: "earned $50 in rewards", time: "1d ago", likes: 8, type: "reward" },
    { id: 4, name: "David K.", action: "unlocked the 'First Earner' badge", time: "1d ago", likes: 3, type: "badge" },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Community Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {feedItems.map((item) => (
            <div key={item.id} className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                {item.type === "study" && <BookOpen className="h-4 w-4 text-primary" />}
                {item.type === "tier" && <Trophy className="h-4 w-4 text-yellow-500" />}
                {item.type === "reward" && <DollarSign className="h-4 w-4 text-green-500" />}
                {item.type === "badge" && <Award className="h-4 w-4 text-purple-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium">{item.name}</span> {item.action}
                </p>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>{item.time}</span>
                  <span className="flex items-center gap-1 hover:text-primary cursor-pointer transition-colors">
                    <Heart className="h-3 w-3" /> {item.likes}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
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

  const { data: activeStudiesCount, isLoading: studiesLoading } = useQuery({
    queryKey: ["active-studies-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("study_listings")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");
      return count || 0;
    },
  });

  // Fetch my active studies for "continue" card
  const { data: myActiveStudies = [] } = useQuery({
    queryKey: ["my-active-studies", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("study_participations")
        .select("id, status, study_listings(title, reward_amount_cents, estimated_minutes)")
        .eq("participant_id", user.id)
        .in("status", ["accepted", "in_progress"])
        .limit(1);
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch top recommended study
  const { data: topStudy } = useQuery({
    queryKey: ["top-recommended-study"],
    queryFn: async () => {
      const { data } = await supabase
        .from("study_listings")
        .select("id, title, reward_amount_cents, estimated_minutes, study_type")
        .eq("status", "active")
        .gt("current_participants", -1)
        .limit(1)
        .single();
      return data;
    },
  });

  // Profile completion
  const { data: profileData } = useQuery({
    queryKey: ["participant-completion-pct", user?.id],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("participant-profile");
      const p = data?.profile as Record<string, unknown> | null;
      if (!p) return 0;
      const fields = ["display_name","gender","date_of_birth","country","education","employment_status","industry","interests"];
      const filled = fields.filter(f => p[f] !== null && p[f] !== undefined && p[f] !== "" && !(Array.isArray(p[f]) && (p[f] as unknown[]).length === 0)).length;
      return Math.round((filled / fields.length) * 100);
    },
    enabled: !!user,
  });

  const profile = data?.profile;
  const reputation = data?.reputation;
  const earnings = data?.earnings;
  const tier = (reputation?.tier as string) || "newcomer";
  const tierConfig = TIER_CONFIG[tier] || TIER_CONFIG.newcomer;
  const totalStudies = (reputation?.total_studies as number) || 0;
  const profilePct = profileData || 0;
  const userState: UserState = getUserState(totalStudies);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-40" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {userState === "new"
              ? `Welcome, ${(profile?.display_name as string) || "Participant"} 👋`
              : userState === "dormant"
              ? `Welcome back, ${(profile?.display_name as string) || "Participant"} 🎉`
              : `Good to see you, ${(profile?.display_name as string) || "Participant"} 👋`}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {userState === "new"
              ? "Let's get you set up and earning!"
              : userState === "dormant"
              ? "New studies are available. Jump back in!"
              : "Here's your research participation overview."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={cn("text-sm px-3 py-1", tierConfig.color)}>
            {tierConfig.icon} {tierConfig.label}
          </Badge>
        </div>
      </div>

      {/* Dormant user banner */}
      {userState === "dormant" && <DormantUserBanner />}

      {/* Profile completion nudge */}
      <ProfileCompletionBanner />

      {/* Onboarding checklist for new users */}
      {userState === "new" && (
        <OnboardingChecklist
          totalStudies={totalStudies}
          profilePct={profilePct}
          hasEarnings={(earnings?.total_earned_cents || 0) > 0}
        />
      )}

      {/* Continue study card */}
      {myActiveStudies.length > 0 && (
        <Card className="border-blue-300/50 dark:border-blue-700/30 bg-blue-50/30 dark:bg-blue-900/10">
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <PlayCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Study in progress</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {(myActiveStudies[0] as any)?.study_listings?.title}
                  </p>
                </div>
              </div>
              <Link to="/participate/my-studies">
                <Button size="sm">
                  Continue <ArrowRight className="h-3.5 w-3.5 ms-1.5" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-green-200/50 dark:border-green-800/30">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Available</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                  {userState === "new" ? "—" : formatCents(earnings?.available_cents || 0)}
                </p>
                {userState === "new" && (
                  <p className="text-xs text-muted-foreground mt-0.5">Complete a study to earn</p>
                )}
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
                <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Studies Done</p>
                <p className="text-2xl font-bold mt-1">{totalStudies}</p>
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

      {/* Recommended study card */}
      {topStudy && userState !== "new" && (
        <Card className="border-primary/20 bg-gradient-to-r from-primary/[0.04] to-transparent">
          <CardContent className="py-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-primary font-semibold uppercase tracking-wider mb-0.5">
                    <Sparkles className="h-3 w-3 inline me-1" />Recommended For You
                  </p>
                  <p className="font-semibold text-sm line-clamp-1">{topStudy.title}</p>
                  <p className="text-xs text-muted-foreground">
                    ${(topStudy.reward_amount_cents / 100).toFixed(2)} · {topStudy.estimated_minutes} min
                  </p>
                </div>
              </div>
              <Link to={`/participate/studies/${topStudy.id}`} className="shrink-0">
                <Button size="sm">
                  View Study <ArrowRight className="h-3.5 w-3.5 ms-1.5" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

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
                  {studiesLoading ? "..." : activeStudiesCount} Studies Available
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

      {/* Tier progress */}
      {tier !== "elite" && (
        <Card className="border-primary/10">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3 mb-3">
              <Trophy className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Reputation Progress</span>
              <Badge className={cn("text-xs ml-auto", tierConfig.color)}>
                {tierConfig.icon} {tierConfig.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-2">{tierConfig.nextBenefit}</p>
            {reputation && (
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{totalStudies} studies completed</span>
                  <Link to="/participate/impact" className="text-primary hover:underline">View Details →</Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { to: "/participate/my-studies",  icon: <BookOpen className="h-4 w-4" />, label: "My Studies" },
          { to: "/participate/earnings",    icon: <DollarSign className="h-4 w-4" />, label: "Earnings" },
          { to: "/participate/impact",      icon: <TrendingUp className="h-4 w-4" />, label: "My Impact" },
          { to: "/participate/referrals",   icon: <Gift className="h-4 w-4" />, label: "Refer & Earn" },
        ].map(({ to, icon, label }) => (
          <Link key={to} to={to}>
            <Card className="hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer h-full">
              <CardContent className="p-3 flex flex-col items-center gap-2 text-center">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  {icon}
                </div>
                <p className="text-xs font-medium">{label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Bottom Grid: Total Earned & Community */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

        {/* Community Feed */}
        {userState !== "new" && <CommunityFeed />}
      </div>

      {/* Social Share */}
      {userState === "active" && <SocialShareCard />}
    </div>
  );
}
