import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Twitter, Share2, Zap, BarChart2, Brain } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

interface TwinData {
  archetype: { id: string; label: string; emoji: string; description: string };
  traits: Array<{ label: string; score: number; description: string }>;
  calibration_accuracy: number;
  studies_contributed_to: number;
  display_name: string;
  interests: string[];
  reputation_tier: string;
}

const TIER_COLORS: Record<string, string> = {
  newcomer: "text-muted-foreground",
  regular:  "text-blue-500",
  trusted:  "text-purple-500",
  expert:   "text-orange-500",
  elite:    "text-yellow-500",
};

function CalibrationRing({ accuracy }: { accuracy: number }) {
  const size = 100;
  const sw = 9;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - accuracy / 100);
  const color = accuracy >= 80 ? "#22c55e" : accuracy >= 50 ? "#f59e0b" : "#6366f1";

  return (
    <div className="relative flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={sw} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={color}
          strokeWidth={sw}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold">{accuracy}%</span>
      </div>
      <p className="text-xs text-muted-foreground">Calibration</p>
    </div>
  );
}

function TraitBar({ trait }: { trait: { label: string; score: number; description: string } }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{trait.label}</span>
        <span className="text-xs font-bold text-primary">{trait.score}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-1000"
          style={{ width: `${trait.score}%` }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground">{trait.description}</p>
    </div>
  );
}

export default function MyTwin() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["participant-twin", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("participant-twin-preview");
      if (error) throw error;
      return data as TwinData;
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });

  const handleShare = () => {
    if (!data) return;
    const text = encodeURIComponent(
      `My AI consumer profile says I'm "${data.archetype.label}" ${data.archetype.emoji} — ${data.archetype.description.slice(0, 80)}... I'm helping shape future products by sharing my opinion on InsightForge!`
    );
    window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank", "noopener,noreferrer");
    toast({ title: "Shared! 🎉", description: "Thanks for spreading the word." });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!data) return null;

  const incompleteProfile = data.calibration_accuracy < 60;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" />
          My AI Twin
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          This is how InsightForge's AI models your consumer behavior based on your profile and study history.
        </p>
      </div>

      {/* Archetype card */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
        <CardContent className="pt-6 relative">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Emoji + archetype */}
            <div className="flex flex-col items-center gap-2 shrink-0">
              <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center text-5xl shadow-lg">
                {data.archetype.emoji}
              </div>
              <CalibrationRing accuracy={data.calibration_accuracy} />
            </div>

            <div className="flex-1 text-center sm:text-left space-y-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Your Archetype</p>
                <h2 className="text-3xl font-bold mt-1">{data.archetype.label}</h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{data.archetype.description}</p>

              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                <Badge variant="outline" className="text-xs">
                  <Sparkles className="h-3 w-3 mr-1" />
                  {data.reputation_tier.charAt(0).toUpperCase() + data.reputation_tier.slice(1)} researcher
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <Zap className="h-3 w-3 mr-1" />
                  {data.studies_contributed_to} studies contributed
                </Badge>
              </div>

              <div className="flex gap-2 justify-center sm:justify-start pt-1">
                <Button size="sm" variant="outline" onClick={handleShare} className="gap-1.5">
                  <Twitter className="h-3.5 w-3.5 text-sky-500" />
                  Share My Twin
                </Button>
                <Button size="sm" variant="ghost" className="gap-1.5">
                  <Share2 className="h-3.5 w-3.5" />
                  Copy
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Traits + interests row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Behavioral traits — spans 2 cols */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-primary" />
              Behavioral Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {data.traits.map((trait) => (
              <TraitBar key={trait.label} trait={trait} />
            ))}
          </CardContent>
        </Card>

        {/* Interests + calibration hint */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Your Interests</CardTitle>
            </CardHeader>
            <CardContent>
              {data.interests.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {data.interests.map((i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{i}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No interests added yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Calibration nudge */}
          {incompleteProfile && (
            <Card className="border-amber-200 dark:border-amber-800/30 bg-amber-50/50 dark:bg-amber-900/10">
              <CardContent className="pt-4 space-y-2">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                  Improve Your Twin
                </p>
                <p className="text-xs text-amber-600/80 dark:text-amber-400/70">
                  Your AI Twin is only {data.calibration_accuracy}% calibrated. A fuller profile means better study matches and more accurate simulations.
                </p>
                <Link to="/participate/profile">
                  <Button size="sm" variant="outline" className="w-full text-xs border-amber-300 dark:border-amber-700">
                    Complete My Profile →
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
