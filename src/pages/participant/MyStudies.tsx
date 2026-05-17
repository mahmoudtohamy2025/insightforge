import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Clock, DollarSign, CheckCircle2, PlayCircle, AlertCircle,
  Loader2, BookOpen, XCircle, ArrowRight, Inbox, Sparkles,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { StudyParticipationModal } from "@/components/participant/StudyParticipationModal";

interface Participation {
  id: string;
  study_id: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  study_listings: {
    id: string;
    title: string;
    study_type: string;
    estimated_minutes: number;
    reward_amount_cents: number;
    description: string | null;
  } | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  accepted:     { label: "Ready to Start",  color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",       icon: <PlayCircle className="h-3 w-3" /> },
  in_progress:  { label: "In Progress",     color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",   icon: <Clock className="h-3 w-3" /> },
  submitted:    { label: "Under Review",    color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400", icon: <BookOpen className="h-3 w-3" /> },
  under_review: { label: "Under Review",    color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400", icon: <BookOpen className="h-3 w-3" /> },
  approved:     { label: "Approved ✓",      color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400", icon: <CheckCircle2 className="h-3 w-3" /> },
  paid:         { label: "Paid ✓",          color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400", icon: <DollarSign className="h-3 w-3" /> },
  rejected:     { label: "Not Approved",    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",           icon: <XCircle className="h-3 w-3" /> },
  expired:      { label: "Expired",         color: "bg-muted text-muted-foreground",                                          icon: <AlertCircle className="h-3 w-3" /> },
};

const TYPE_LABELS: Record<string, string> = {
  survey:          "Survey",
  focus_group:     "Focus Group",
  interview:       "Interview",
  usability_test:  "Usability Test",
  twin_calibration:"AI Calibration",
};

function formatCents(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function ParticipationCard({ p, onStart }: { p: Participation; onStart: (p: Participation) => void }) {
  const study = p.study_listings;
  if (!study) return null;
  const statusCfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.accepted;
  const isActionable = p.status === "accepted" || p.status === "in_progress";

  return (
    <Card className={cn("transition-all hover:shadow-md", isActionable && "border-primary/30")}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm leading-snug line-clamp-2">{study.title}</h3>
            {study.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{study.description}</p>
            )}
          </div>
          <Badge className={cn("text-xs shrink-0 flex items-center gap-1", statusCfg.color)}>
            {statusCfg.icon} {statusCfg.label}
          </Badge>
        </div>

        <div className="flex items-center flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <DollarSign className="h-3 w-3 text-emerald-500" />
            <strong className="text-foreground">{formatCents(study.reward_amount_cents)}</strong>
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {study.estimated_minutes} min
          </span>
          <span className="text-muted-foreground">
            {TYPE_LABELS[study.study_type] || study.study_type}
          </span>
        </div>

        {isActionable && (
          <Button
            size="sm"
            className="w-full"
            onClick={() => onStart(p)}
          >
            {p.status === "in_progress" ? (
              <><PlayCircle className="h-3.5 w-3.5 me-1.5" /> Continue Study</>
            ) : (
              <><PlayCircle className="h-3.5 w-3.5 me-1.5" /> Start Study</>
            )}
          </Button>
        )}

        {p.status === "submitted" || p.status === "under_review" ? (
          <p className="text-xs text-center text-muted-foreground pt-1">
            Awaiting researcher review • Usually within 5 business days
          </p>
        ) : null}

        {(p.status === "approved" || p.status === "paid") && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              + {formatCents(study.reward_amount_cents)} earned
            </span>
            <Link to="/participate/earnings" className="text-primary hover:underline flex items-center gap-0.5">
              View earnings <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState({ tab }: { tab: string }) {
  const messages: Record<string, { icon: React.ReactNode; title: string; desc: string; cta?: React.ReactNode }> = {
    active: {
      icon: <Inbox className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />,
      title: "No active studies",
      desc: "Browse available studies to get started and start earning.",
      cta: <Link to="/participate/studies"><Button size="sm" className="mt-3"><Sparkles className="h-3.5 w-3.5 me-1" /> Browse Studies</Button></Link>,
    },
    completed: {
      icon: <CheckCircle2 className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />,
      title: "No completed studies yet",
      desc: "Once you complete a study, it will appear here.",
    },
    expired: {
      icon: <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />,
      title: "No expired studies",
      desc: "Studies you didn't complete in time will appear here.",
    },
  };

  const msg = messages[tab] || messages.active;
  return (
    <Card>
      <CardContent className="py-16 text-center">
        {msg.icon}
        <h3 className="font-semibold text-base">{msg.title}</h3>
        <p className="text-sm text-muted-foreground mt-1">{msg.desc}</p>
        {msg.cta}
      </CardContent>
    </Card>
  );
}

export default function MyStudies() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeStudy, setActiveStudy] = useState<Participation | null>(null);

  const { data: participations = [], isLoading } = useQuery({
    queryKey: ["my-studies", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("study_participations")
        .select(`
          id,
          study_id,
          status,
          created_at,
          completed_at,
          study_listings (
            id, title, study_type, estimated_minutes,
            reward_amount_cents, description
          )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Participation[];
    },
    enabled: !!user,
  });

  const active    = participations.filter(p => ["accepted","in_progress"].includes(p.status));
  const completed = participations.filter(p => ["submitted","under_review","approved","paid","rejected"].includes(p.status));
  const expired   = participations.filter(p => p.status === "expired");

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-12 w-full" />
        <div className="space-y-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          My Studies
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track your accepted, completed, and expired research studies.
        </p>
      </div>

      <Tabs defaultValue="active">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="active" className="gap-1.5">
            Active
            {active.length > 0 && (
              <span className="ml-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
                {active.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed
            {completed.length > 0 && (
              <span className="ml-1 text-xs text-muted-foreground">({completed.length})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="expired">Expired</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-3 mt-4">
          {active.length === 0
            ? <EmptyState tab="active" />
            : active.map(p => <ParticipationCard key={p.id} p={p} onStart={setActiveStudy} />)
          }
        </TabsContent>

        <TabsContent value="completed" className="space-y-3 mt-4">
          {completed.length === 0
            ? <EmptyState tab="completed" />
            : completed.map(p => <ParticipationCard key={p.id} p={p} onStart={setActiveStudy} />)
          }
        </TabsContent>

        <TabsContent value="expired" className="space-y-3 mt-4">
          {expired.length === 0
            ? <EmptyState tab="expired" />
            : expired.map(p => <ParticipationCard key={p.id} p={p} onStart={setActiveStudy} />)
          }
        </TabsContent>
      </Tabs>

      {/* Participation modal */}
      {activeStudy && (
        <StudyParticipationModal
          participation={activeStudy}
          onClose={() => setActiveStudy(null)}
          onComplete={() => {
            setActiveStudy(null);
            queryClient.invalidateQueries({ queryKey: ["my-studies"] });
            queryClient.invalidateQueries({ queryKey: ["participant-earnings"] });
            queryClient.invalidateQueries({ queryKey: ["participant-profile"] });
            toast({ title: "Study Submitted! 🎉", description: "Earnings will be added after researcher review." });
          }}
        />
      )}
    </div>
  );
}
