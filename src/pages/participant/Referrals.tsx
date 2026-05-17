import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Gift, Copy, CheckCircle2, Twitter, Linkedin, Share2,
  Users, DollarSign, TrendingUp, Trophy, Award, Medal,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ReferralData {
  referral_code: string;
  referral_url: string;
  stats: {
    total_referrals: number;
    successful_referrals: number;
    total_earned_cents: number;
  };
  referrals: {
    id: string;
    status: string;
    joined_at: string;
    bonus_paid: boolean;
    bonus_amount_cents: number;
    referred_display_name: string | null;
  }[];
}

// Tiered reward thresholds
const REFERRAL_TIERS = [
  { count: 1,  reward: 200,  label: "$2 each",  description: "First 3 friends" },
  { count: 4,  reward: 500,  label: "$5 each",  description: "Friends 4–9" },
  { count: 10, reward: 1000, label: "$10 each", description: "Friend 10+" },
];

function getTierForCount(count: number): typeof REFERRAL_TIERS[0] {
  if (count >= 10) return REFERRAL_TIERS[2];
  if (count >= 4) return REFERRAL_TIERS[1];
  return REFERRAL_TIERS[0];
}

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function ReferralLeaderboard() {
  const leaders = [
    { rank: 1, name: "Alex M.", count: 42, earned: 42000 },
    { rank: 2, name: "Sarah J.", count: 38, earned: 38000 },
    { rank: 3, name: "Michael T.", count: 25, earned: 25000 },
    { rank: 4, name: "Elena R.", count: 18, earned: 18000 },
    { rank: 5, name: "David K.", count: 12, earned: 12000 },
  ];

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-4 w-4 text-yellow-500" />
          Top Referrers This Month
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {leaders.map((leader) => (
            <div key={leader.rank} className="flex items-center gap-3">
              <div className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center shrink-0 font-bold text-sm",
                leader.rank === 1 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" :
                leader.rank === 2 ? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" :
                leader.rank === 3 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-500" :
                "bg-muted text-muted-foreground"
              )}>
                {leader.rank === 1 ? <Trophy className="h-4 w-4" /> :
                 leader.rank === 2 ? <Medal className="h-4 w-4" /> :
                 leader.rank === 3 ? <Award className="h-4 w-4" /> :
                 leader.rank}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{leader.name}</p>
                <p className="text-xs text-muted-foreground">{leader.count} friends invited</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCents(leader.earned)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Referrals() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["participant-referral", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("participant-referral");
      if (error) throw error;
      return data as ReferralData;
    },
    enabled: !!user,
  });

  const copyLink = () => {
    const url = data?.referral_url || `https://insightforge.app/participate/signup?ref=${data?.referral_code}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Referral link copied! 🔗" });
  };

  const shareText = `I'm earning money with InsightForge by sharing my opinions and shaping AI. Join me and earn too! Use my link:`;
  const referralUrl = data?.referral_url || `https://insightforge.app/participate/signup?ref=${data?.referral_code}`;

  const openTwitter = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(referralUrl)}`, "_blank");
  };
  const openLinkedIn = () => {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralUrl)}`, "_blank");
  };
  const handleNativeShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: "Join InsightForge", text: shareText, url: referralUrl });
    } else {
      copyLink();
    }
  };

  const successfulReferrals = data?.stats.successful_referrals || 0;
  const currentTier = getTierForCount(successfulReferrals);
  const nextTier = REFERRAL_TIERS.find(t => t.count > successfulReferrals);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Gift className="h-6 w-6 text-primary" />
          Refer & Earn
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Invite friends and earn cash for every successful referral. More friends = bigger rewards.
        </p>
      </div>

      {/* Tiered Rewards Banner */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-purple-500/5 overflow-hidden">
        <CardContent className="pt-5 pb-4">
          <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">
            🏆 Tiered Reward System
          </p>
          <div className="grid grid-cols-3 gap-3">
            {REFERRAL_TIERS.map((tier, i) => {
              const isActive = currentTier.count === tier.count;
              return (
                <div
                  key={i}
                  className={cn(
                    "rounded-lg border p-3 text-center transition-all",
                    isActive ? "border-primary bg-primary/10 ring-2 ring-primary" : "border-border bg-background"
                  )}
                >
                  <p className={cn("text-lg font-bold", isActive ? "text-primary" : "")}>
                    {tier.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{tier.description}</p>
                  {isActive && <Badge className="mt-1.5 text-[10px] bg-primary">Current</Badge>}
                </div>
              );
            })}
          </div>
          {nextTier && (
            <p className="text-xs text-muted-foreground mt-3 text-center">
              Refer {nextTier.count - successfulReferrals} more friend{nextTier.count - successfulReferrals !== 1 ? "s" : ""} to unlock{" "}
              <strong>{formatCents(nextTier.reward)}</strong> per referral!
            </p>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 text-center">
            <Users className="h-5 w-5 mx-auto text-primary mb-2" />
            <p className="text-2xl font-bold">{data?.stats.total_referrals || 0}</p>
            <p className="text-xs text-muted-foreground">Total Invited</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-center">
            <CheckCircle2 className="h-5 w-5 mx-auto text-emerald-500 mb-2" />
            <p className="text-2xl font-bold">{successfulReferrals}</p>
            <p className="text-xs text-muted-foreground">Successful</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 text-center">
            <DollarSign className="h-5 w-5 mx-auto text-green-500 mb-2" />
            <p className="text-2xl font-bold">{formatCents(data?.stats.total_earned_cents || 0)}</p>
            <p className="text-xs text-muted-foreground">Earned</p>
          </CardContent>
        </Card>
      </div>

      {/* Your Link */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your Referral Link</CardTitle>
          <CardDescription>Share this link. When your friend signs up and completes their first study, you earn!</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Code */}
          <div className="flex items-center gap-3">
            <div className="flex-1 rounded-lg border bg-muted/50 px-4 py-2.5">
              <p className="text-xs text-muted-foreground mb-0.5">Your Code</p>
              <p className="font-mono font-bold text-lg tracking-widest text-primary">
                {data?.referral_code || "---"}
              </p>
            </div>
          </div>

          {/* URL */}
          <div className="flex gap-2">
            <Input
              readOnly
              value={referralUrl}
              className="text-xs"
            />
            <Button
              variant="outline"
              onClick={copyLink}
              className={cn(copied && "border-emerald-500 text-emerald-600")}
            >
              {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>

          {/* Share buttons */}
          <div className="flex flex-wrap gap-2">
            {navigator.share !== undefined && (
              <Button variant="default" size="sm" onClick={handleNativeShare}>
                <Share2 className="h-3.5 w-3.5 me-1.5" /> Share
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={openTwitter} className="hover:text-blue-400">
              <Twitter className="h-3.5 w-3.5 me-1.5" /> Twitter / X
            </Button>
            <Button variant="outline" size="sm" onClick={openLinkedIn} className="hover:text-blue-700">
              <Linkedin className="h-3.5 w-3.5 me-1.5" /> LinkedIn
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* How it works */}
      <Card>
        <CardHeader><CardTitle className="text-base">How It Works</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[
            { step: "1", title: "Share Your Link",    desc: "Send your unique referral link to friends and family." },
            { step: "2", title: "They Sign Up",       desc: "Your friend creates a participant account using your link." },
            { step: "3", title: "They Complete a Study", desc: "Once they complete their first study, the reward is triggered." },
            { step: "4", title: "You Get Paid",       desc: `You earn ${formatCents(currentTier.reward)} per successful referral (at your current tier).` },
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex items-start gap-3">
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary">{step}</span>
              </div>
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Referral History */}
        {(data?.referrals || []).length > 0 ? (
          <Card className="h-full">
            <CardHeader><CardTitle className="text-base">Your History</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(data?.referrals || []).map((ref) => (
                  <div key={ref.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">
                        {ref.referred_display_name || "New Participant"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Joined {new Date(ref.joined_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      {ref.bonus_paid ? (
                        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                          {formatCents(ref.bonus_amount_cents)} earned ✓
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          {ref.status === "signed_up" ? "Awaiting first study" : "Pending"}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="h-full">
            <CardHeader><CardTitle className="text-base">Your History</CardTitle></CardHeader>
            <CardContent className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground space-y-3">
              <Users className="h-8 w-8 opacity-20" />
              <p className="text-sm">You haven't referred anyone yet.<br/>Share your link to get started!</p>
            </CardContent>
          </Card>
        )}

        {/* Leaderboard */}
        <ReferralLeaderboard />
      </div>
    </div>
  );
}
