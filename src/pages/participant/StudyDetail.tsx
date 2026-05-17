import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Clock, DollarSign, Users, ChevronLeft, CheckCircle2,
  Target, Loader2, Shield, FileText, User, CalendarClock,
  Info, Flame, Star, AlertCircle,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  survey:          { label: "Survey",        color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  focus_group:     { label: "Focus Group",   color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
  interview:       { label: "Interview",     color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  usability_test:  { label: "Usability Test",color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" },
  twin_calibration:{ label: "AI Calibration",color: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400" },
};

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}
function hourlyRate(cents: number, minutes: number) {
  if (minutes <= 0) return "N/A";
  return `$${((cents / 100) * (60 / minutes)).toFixed(2)}/hr`;
}

// Tier benefits for display
const TIER_BENEFITS: Record<string, string[]> = {
  newcomer: ["Access to standard studies", "Email support"],
  regular:  ["All newcomer benefits", "+5% earnings bonus", "Priority matching"],
  trusted:  ["All regular benefits", "Early access to new studies", "2× referral bonus"],
  expert:   ["All trusted benefits", "Premium high-paying studies", "Dedicated account manager"],
  elite:    ["All expert benefits", "Exclusive research partnerships", "Revenue sharing opportunities"],
};

export default function StudyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [consentChecked, setConsentChecked] = useState(false);
  const [dataUseChecked, setDataUseChecked] = useState(false);

  const { data: study, isLoading } = useQuery({
    queryKey: ["study-detail", id],
    queryFn: async () => {
      if (!id) throw new Error("No study ID");
      const { data, error } = await supabase
        .from("study_listings")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: matchData } = useQuery({
    queryKey: ["study-match-score", id],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("participant-match-scores");
      return (data?.scores || {}) as Record<string, number>;
    },
    enabled: !!user && !!id,
    staleTime: 5 * 60 * 1000,
  });

  // Check if already accepted
  const { data: participation } = useQuery({
    queryKey: ["study-participation", id, user?.id],
    queryFn: async () => {
      if (!id || !user) return null;
      const { data } = await supabase
        .from("study_participations")
        .select("*")
        .eq("study_id", id)
        .maybeSingle();
      return data;
    },
    enabled: !!id && !!user,
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("study-participate", {
        body: { action: "accept", study_id: id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participant-studies"] });
      queryClient.invalidateQueries({ queryKey: ["study-participation", id] });
      queryClient.invalidateQueries({ queryKey: ["my-studies"] });
      toast({ title: "Study Accepted! 🎉", description: "Head to My Studies to begin." });
      navigate("/participate/my-studies");
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  if (!study) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
        <h2 className="font-semibold text-lg">Study not found</h2>
        <p className="text-muted-foreground text-sm mt-1">This study may have expired or been removed.</p>
        <Link to="/participate/studies" className="mt-4 inline-block">
          <Button variant="outline">Back to Studies</Button>
        </Link>
      </div>
    );
  }

  const typeConfig = TYPE_LABELS[study.study_type as string] || TYPE_LABELS.survey;
  const spots = (study.max_participants as number) - (study.current_participants as number);
  const isHot = spots <= 5 && spots > 0;
  const matchScore = matchData?.[study.id as string];
  const isFull = spots <= 0;
  const isAccepted = !!participation;
  const canAccept = !isFull && !isAccepted && consentChecked && dataUseChecked;

  const requirements = (study.requirements as Record<string, unknown>) || {};

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back nav */}
      <Link
        to="/participate/studies"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Studies
      </Link>

      {/* Header card */}
      <Card className={cn(
        "border-primary/20",
        isHot && "ring-1 ring-orange-300 dark:ring-orange-700",
        matchScore && matchScore >= 85 && "ring-1 ring-emerald-300 dark:ring-emerald-700",
      )}>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h1 className="text-xl font-bold leading-snug">{study.title as string}</h1>
              {study.description && (
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  {study.description as string}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <Badge className={cn("text-xs", typeConfig.color)}>{typeConfig.label}</Badge>
              {matchScore && matchScore >= 70 && (
                <span className="flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-full border border-emerald-200">
                  <Target className="h-2.5 w-2.5" /> {matchScore}% match
                </span>
              )}
            </div>
          </div>

          {/* Key metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/50 dark:border-emerald-800/30 p-3 text-center">
              <DollarSign className="h-4 w-4 mx-auto text-emerald-600 dark:text-emerald-400 mb-1" />
              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                {formatCents(study.reward_amount_cents as number)}
              </p>
              <p className="text-[10px] text-muted-foreground">Reward</p>
            </div>
            <div className="rounded-lg bg-muted/50 border border-border p-3 text-center">
              <Clock className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
              <p className="text-lg font-bold">{study.estimated_minutes as number} min</p>
              <p className="text-[10px] text-muted-foreground">Duration</p>
            </div>
            <div className="rounded-lg bg-muted/50 border border-border p-3 text-center">
              <Star className="h-4 w-4 mx-auto text-yellow-500 mb-1" />
              <p className="text-lg font-bold">{hourlyRate(study.reward_amount_cents as number, study.estimated_minutes as number)}</p>
              <p className="text-[10px] text-muted-foreground">Hourly rate</p>
            </div>
            <div className="rounded-lg bg-muted/50 border border-border p-3 text-center">
              <Users className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
              <p className={cn("text-lg font-bold", isHot && "text-orange-500")}>
                {isFull ? "Full" : `${spots} left`}
              </p>
              <p className="text-[10px] text-muted-foreground">Spots</p>
            </div>
          </div>

          {isHot && !isFull && (
            <div className="flex items-center gap-1.5 text-sm text-orange-600 dark:text-orange-400 font-medium">
              <Flame className="h-4 w-4" />
              Filling fast — only {spots} {spots === 1 ? "spot" : "spots"} remaining!
            </div>
          )}
        </CardContent>
      </Card>

      {/* Requirements */}
      {Object.keys(requirements).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Eligibility Requirements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {Object.entries(requirements).map(([key, val]) => (
                <li key={key} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span className="capitalize">{key.replace(/_/g, " ")}: <strong>{String(val)}</strong></span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* What to expect */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            What to Expect
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-3">
            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs font-bold text-primary">1</span>
            </div>
            <p>Accept the study and read any instructions provided by the researcher.</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs font-bold text-primary">2</span>
            </div>
            <p>Complete all tasks within the estimated {study.estimated_minutes as number} minutes.</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs font-bold text-primary">3</span>
            </div>
            <p>Submit your responses. The researcher will review within 5 business days.</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs font-bold text-primary">4</span>
            </div>
            <p>Upon approval, {formatCents(study.reward_amount_cents as number)} will be added to your available balance.</p>
          </div>
        </CardContent>
      </Card>

      {/* Payment info */}
      <Card className="border-amber-200/50 dark:border-amber-800/30 bg-amber-50/30 dark:bg-amber-900/10">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <CalendarClock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Payment Timeline</p>
              <p className="text-xs text-amber-700/80 dark:text-amber-400/70 mt-0.5">
                Rewards are released within 5 business days after researcher approval (or 22 days automatic release).
                Minimum cashout is $5.00.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Consent checkboxes */}
      {!isAccepted && !isFull && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Consent & Agreement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="consent"
                checked={consentChecked}
                onCheckedChange={(v) => setConsentChecked(!!v)}
                className="mt-0.5"
              />
              <Label htmlFor="consent" className="text-sm leading-relaxed cursor-pointer">
                I understand this is a legitimate research study. My responses will be used for research purposes
                and I may withdraw at any time without penalty.
              </Label>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox
                id="data-use"
                checked={dataUseChecked}
                onCheckedChange={(v) => setDataUseChecked(!!v)}
                className="mt-0.5"
              />
              <Label htmlFor="data-use" className="text-sm leading-relaxed cursor-pointer">
                I consent to my anonymized data being used to improve AI models and research outcomes,
                in accordance with InsightForge's{" "}
                <Link to="/trust-center" className="text-primary hover:underline">Privacy Policy</Link>.
              </Label>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
              <Info className="h-3.5 w-3.5 shrink-0" />
              <span>Your personal identity is never shared with researchers. All data is anonymized.</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CTA */}
      <div className="pb-6">
        {isAccepted ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              You've already accepted this study.
            </div>
            <Link to="/participate/my-studies">
              <Button className="w-full">Go to My Studies →</Button>
            </Link>
          </div>
        ) : isFull ? (
          <Button className="w-full" disabled>Study is Full</Button>
        ) : (
          <Button
            className="w-full h-12 text-base"
            onClick={() => acceptMutation.mutate()}
            disabled={!canAccept || acceptMutation.isPending}
          >
            {acceptMutation.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
            {!consentChecked || !dataUseChecked
              ? "Please agree to the terms above"
              : `Accept Study — Earn ${formatCents(study.reward_amount_cents as number)}`}
          </Button>
        )}
      </div>
    </div>
  );
}
