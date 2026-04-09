import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Clock, DollarSign, Users, Loader2, CheckCircle2, Flame, ArrowUpDown, Target, Sparkles, MoveRight, MoveLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { motion, useAnimation, PanInfo } from "framer-motion";

interface StudyListing {
  id: string;
  title: string;
  description: string | null;
  study_type: string;
  estimated_minutes: number;
  reward_amount_cents: number;
  currency: string;
  max_participants: number;
  current_participants: number;
  requirements: Record<string, unknown>;
  status: string;
  closes_at: string | null;
  created_at: string;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  survey: { label: "Survey", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  focus_group: { label: "Focus Group", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
  interview: { label: "Interview", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  usability_test: { label: "Usability Test", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" },
  twin_calibration: { label: "AI Calibration", color: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400" },
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function hourlyRate(cents: number, minutes: number): string {
  if (minutes <= 0) return "N/A";
  return `$${((cents / 100) * (60 / minutes)).toFixed(2)}/hr`;
}

function MatchBadge({ score }: { score: number | undefined }) {
  if (score === undefined) return null;
  if (score >= 85) return (
    <span className="flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
      <Target className="h-2.5 w-2.5" /> {score}% match
    </span>
  );
  if (score >= 70) return (
    <span className="flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
      <Target className="h-2.5 w-2.5" /> {score}% match
    </span>
  );
  return null;
}

type SortOption = "best_match" | "newest" | "reward_high" | "hourly_high" | "shortest";

export default function StudyFeed() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sort, setSort] = useState<SortOption>("best_match");
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const { data: studies = [], isLoading } = useQuery({
    queryKey: ["participant-studies"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("study-listing");
      if (error) throw error;
      return (data?.studies || []) as StudyListing[];
    },
    enabled: !!user,
  });

  // Fetch match scores
  const { data: matchScores } = useQuery({
    queryKey: ["participant-match-scores"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("participant-match-scores");
      if (error) return {} as Record<string, number>;
      return (data?.scores || {}) as Record<string, number>;
    },
    enabled: !!user && studies.length > 0,
    staleTime: 5 * 60 * 1000, // 5 min cache
  });

  const acceptMutation = useMutation({
    mutationFn: async (studyId: string) => {
      setAcceptingId(studyId);
      const { data, error } = await supabase.functions.invoke("study-participate", {
        body: { action: "accept", study_id: studyId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participant-studies"] });
      toast({ title: "Study Accepted! 🎉", description: "You can now begin the study." });
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
    onSettled: () => setAcceptingId(null),
  });

  // Filter
  let filtered = studies.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    (s.description || "").toLowerCase().includes(search.toLowerCase())
  );
  if (typeFilter !== "all") {
    filtered = filtered.filter((s) => s.study_type === typeFilter);
  }

  // Sort
  filtered.sort((a, b) => {
    switch (sort) {
      case "best_match": {
        const sa = matchScores?.[a.id] ?? 0;
        const sb = matchScores?.[b.id] ?? 0;
        return sb - sa;
      }
      case "reward_high": return b.reward_amount_cents - a.reward_amount_cents;
      case "hourly_high": return (b.reward_amount_cents / b.estimated_minutes) - (a.reward_amount_cents / a.estimated_minutes);
      case "shortest": return a.estimated_minutes - b.estimated_minutes;
      default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  const spotsLeft = (s: StudyListing) => s.max_participants - s.current_participants;
  const isHot = (s: StudyListing) => spotsLeft(s) <= 5 && spotsLeft(s) > 0;

  // Recommended section: top-3 matches with score ≥ 70
  const recommended = studies
    .filter((s) => (matchScores?.[s.id] ?? 0) >= 70)
    .sort((a, b) => (matchScores?.[b.id] ?? 0) - (matchScores?.[a.id] ?? 0))
    .slice(0, 3);

  const StudyCard = ({ study, compact = false }: { study: StudyListing; compact?: boolean }) => {
    const typeConfig = TYPE_LABELS[study.study_type] || TYPE_LABELS.survey;
    const spots = spotsLeft(study);
    const hot = isHot(study);
    const score = matchScores?.[study.id];
    const controls = useAnimation();

    const handleDragEnd = async (event: any, info: PanInfo) => {
      const offset = info.offset.x;
      if (offset > 100) {
        // Swipe Right - Accept
        if (spots > 0 && acceptingId !== study.id) {
          acceptMutation.mutate(study.id);
        }
        controls.start({ x: 500, opacity: 0 });
      } else if (offset < -100) {
        // Swipe Left - Ignore (just hide locally for demo)
        controls.start({ x: -500, opacity: 0 });
      } else {
        controls.start({ x: 0, opacity: 1 });
      }
    };

    return (
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.7}
        onDragEnd={handleDragEnd}
        animate={controls}
        whileDrag={{ scale: 1.05, cursor: "grabbing" }}
        className="w-full relative touch-pan-y"
      >
        {/* Indicators that show up while dragging */}
        <div className="absolute inset-y-0 left-4 flex items-center opacity-0 z-0 text-emerald-500 font-bold" style={{ transform: "translateX(-20px)" }}>
           <MoveRight className="mr-2" /> ACCEPT
        </div>
        <div className="absolute inset-y-0 right-4 flex items-center opacity-0 z-0 text-red-500 font-bold" style={{ transform: "translateX(20px)" }}>
           SKIP <MoveLeft className="ml-2" />
        </div>

      <Card className={cn(
        "hover:shadow-md transition-all duration-200 z-10 bg-card relative cursor-grab active:cursor-grabbing",
        hot && "ring-1 ring-orange-300 dark:ring-orange-700",
        score && score >= 85 && "ring-1 ring-emerald-300 dark:ring-emerald-700",
        compact && "min-w-[280px]"
      )}>
        <CardContent className={cn("space-y-3", compact ? "p-4" : "p-5")}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base leading-snug line-clamp-2">{study.title}</h3>
              {study.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{study.description}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <Badge className={cn("text-xs", typeConfig.color)}>{typeConfig.label}</Badge>
              <MatchBadge score={score} />
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5 text-green-500" />
              <span className="font-semibold text-foreground">{formatCents(study.reward_amount_cents)}</span>
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {study.estimated_minutes} min
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-muted font-medium">
              {hourlyRate(study.reward_amount_cents, study.estimated_minutes)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {spots} spot{spots !== 1 ? "s" : ""} left
              </span>
              {hot && (
                <span className="flex items-center gap-0.5 text-xs text-orange-600 dark:text-orange-400 font-medium">
                  <Flame className="h-3 w-3" /> Hot
                </span>
              )}
            </div>

            <Button
              size="sm"
              onClick={() => acceptMutation.mutate(study.id)}
              disabled={acceptingId === study.id || spots <= 0}
            >
              {acceptingId === study.id ? (
                <Loader2 className="h-3 w-3 me-1 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3 w-3 me-1" />
              )}
              {spots <= 0 ? "Full" : "Accept"}
            </Button>
          </div>
        </CardContent>
      </Card>
      </motion.div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Search className="h-6 w-6 text-primary" />
          Available Studies
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {studies.length} {studies.length === 1 ? "study" : "studies"} available. Accept one to start earning.
        </p>
      </div>

      {/* Recommended For You */}
      {recommended.length > 0 && !search && !isLoading && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2 text-primary">
            <Sparkles className="h-4 w-4" /> Recommended For You
            <span className="text-xs text-muted-foreground font-normal ml-auto hidden sm:inline">Swipe card right to accept</span>
          </h2>
          <div className="flex overflow-x-auto gap-4 pb-4 snap-x hide-scrollbar">
            {recommended.map((study) => (
              <div key={study.id} className="snap-center w-[85%] sm:w-auto shrink-0">
                <StudyCard study={study} compact />
              </div>
            ))}
          </div>
          <div className="h-px bg-border" />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search studies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(TYPE_LABELS).map(([key, { label }]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
          <SelectTrigger className="w-[160px]">
            <ArrowUpDown className="h-3 w-3 me-1" />
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="best_match">🎯 Best Match</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="reward_high">Highest Reward</SelectItem>
            <SelectItem value="hourly_high">Best $/hr</SelectItem>
            <SelectItem value="shortest">Shortest</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Study Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-48 rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Search className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <h3 className="font-semibold text-lg">No Studies Found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {studies.length === 0
                ? "No studies are currently available. Check back soon!"
                : "Try adjusting your search or filters."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((study) => <StudyCard key={study.id} study={study} />)}
        </div>
      )}
    </div>
  );
}
