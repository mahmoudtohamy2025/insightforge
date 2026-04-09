import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Gift, Copy, CheckCheck, Twitter, MessageCircle, Linkedin, Users, DollarSign, TrendingUp } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ReferralData {
  referral_code: string;
  referrals: Array<{ id: string; status: string; signed_up_at?: string; completed_at?: string }>;
  completed_count: number;
  total_bonus_earned_cents: number;
}

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

const STATUS_COLORS: Record<string, string> = {
  signed_up:  "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  completed:  "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  paid:       "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  pending:    "bg-muted text-muted-foreground",
};

export default function Referrals() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["participant-referral"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("participant-referral", {
        headers: {},
      });
      if (error) throw error;
      return data as ReferralData;
    },
    enabled: !!user,
  });

  const referralCode = data?.referral_code ?? "";
  const referralUrl = `${window.location.origin}/participate/signup?ref=${referralCode}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    toast({ title: "Link copied! 🔗", description: "Share it with friends to earn $2.00 each." });
    setTimeout(() => setCopied(false), 2000);
  };

  const shareText = encodeURIComponent(
    `I'm earning money by participating in research studies on InsightForge. Join me and we both get $2! 🎉`
  );
  const shareUrl = encodeURIComponent(referralUrl);

  const shares = [
    {
      label: "Twitter",
      icon: Twitter,
      href: `https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`,
      color: "text-sky-500",
    },
    {
      label: "WhatsApp",
      icon: MessageCircle,
      href: `https://wa.me/?text=${shareText}%20${shareUrl}`,
      color: "text-green-500",
    },
    {
      label: "LinkedIn",
      icon: Linkedin,
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`,
      color: "text-blue-600",
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Gift className="h-6 w-6 text-primary" />
          Refer & Earn
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Invite friends to InsightForge. When they complete their first study, you both earn $2.00.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Referred</p>
                <p className="text-3xl font-bold mt-1">{data?.referrals?.length ?? 0}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Completed</p>
                <p className="text-3xl font-bold mt-1">{data?.completed_count ?? 0}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Bonus Earned</p>
                <p className="text-3xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                  {formatCents(data?.total_bonus_earned_cents ?? 0)}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Referral link card */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your Referral Link</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* How it works */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
            {[
              { step: "1", label: "Share your link", emoji: "🔗" },
              { step: "2", label: "Friend signs up & completes a study", emoji: "✅" },
              { step: "3", label: "You both earn $2.00", emoji: "💰" },
            ].map((s) => (
              <div key={s.step} className="bg-card rounded-lg p-3 border">
                <div className="text-2xl mb-1">{s.emoji}</div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Link + copy */}
          <div className="flex gap-2">
            <div className="flex-1 truncate bg-muted rounded-md px-3 py-2 text-sm font-mono text-muted-foreground border">
              {referralUrl}
            </div>
            <Button variant="outline" onClick={handleCopy} className="shrink-0">
              {copied ? <CheckCheck className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>

          {/* Share buttons */}
          <div className="flex gap-2">
            {shares.map((s) => (
              <Button
                key={s.label}
                variant="outline"
                size="sm"
                className="flex-1 gap-1"
                onClick={() => window.open(s.href, "_blank", "noopener,noreferrer")}
              >
                <s.icon className={cn("h-3.5 w-3.5", s.color)} />
                {s.label}
              </Button>
            ))}
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Your code: <span className="font-bold tracking-widest text-foreground">{referralCode}</span>
          </p>
        </CardContent>
      </Card>

      {/* Referral history */}
      {data && data.referrals.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Referral History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.referrals.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">Friend #{r.id.slice(0, 6)}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.signed_up_at
                        ? `Joined ${new Date(r.signed_up_at).toLocaleDateString()}`
                        : "Pending sign up"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {(r.status === "completed" || r.status === "paid") && (
                      <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">+$2.00</span>
                    )}
                    <Badge className={cn("text-xs", STATUS_COLORS[r.status] || STATUS_COLORS.pending)}>
                      {r.status.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
