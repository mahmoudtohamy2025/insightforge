import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { logActivity } from "@/lib/activityLogger";
import { parseTierLimitError } from "@/lib/tierLimitError";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Video, Users, Monitor, Calendar, Clock, Play, Loader2, FileText, Search, X, TrendingUp, TrendingDown, Minus, Shuffle } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { ProductTour } from "@/components/onboarding/ProductTour";
import { TOUR_SESSIONS } from "@/lib/tourDefinitions";
import { useNavigate } from "react-router-dom";
import { TranscriptUploadDialog } from "@/components/sessions/TranscriptUploadDialog";

const typeConfig = {
  focus_group: { label: "sessions.focusGroup", icon: Users, color: "bg-primary/10 text-primary" },
  idi: { label: "sessions.idi", icon: Video, color: "bg-accent/10 text-accent-foreground" },
  ux_test: { label: "sessions.uxTest", icon: Monitor, color: "bg-success/10 text-success" },
};

const statusVariant = {
  draft: "secondary" as const,
  scheduled: "outline" as const,
  live: "default" as const,
  completed: "secondary" as const,
  cancelled: "destructive" as const,
};

const Sessions = () => {
  const { t } = useI18n();
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { canCreate } = useWorkspaceRole();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("idi");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("60");
  const [projectId, setProjectId] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", currentWorkspace?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name")
        .eq("workspace_id", currentWorkspace!.id)
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!currentWorkspace?.id,
  });

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["sessions", currentWorkspace?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("workspace_id", currentWorkspace!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!currentWorkspace?.id,
  });

  const { data: transcriptMap = {} } = useQuery({
    queryKey: ["session-transcripts", currentWorkspace?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_transcripts")
        .select("session_id")
        .eq("workspace_id", currentWorkspace!.id);
      if (error) throw error;
      const map: Record<string, boolean> = {};
      data.forEach((t) => (map[t.session_id] = true));
      return map;
    },
    enabled: !!currentWorkspace?.id,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("sessions").insert({
        workspace_id: currentWorkspace!.id,
        title,
        type,
        status: date ? "scheduled" : "draft",
        scheduled_date: date || null,
        scheduled_time: time || null,
        duration_minutes: parseInt(duration) || 60,
        project_id: projectId || null,
        meeting_url: meetingUrl.trim() || null,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      setOpen(false);
      setTitle("");
      setType("idi");
      setDate("");
      setTime("");
      setDuration("60");
      setMeetingUrl("");
      toast({ title: "Session created" });
      if (currentWorkspace && user) {
        logActivity(currentWorkspace.id, user.id, "created", "session", undefined, { title });
      }
    },
    onError: (e) => {
      const tierErr = parseTierLimitError(e);
      if (tierErr) {
        toast({ title: t("billing.tierLimitTitle"), description: t("billing.tierLimitReached").replace("{resource}", t("sessions.title").toLowerCase()).replace("{tier}", t(`billing.${tierErr.currentTier}`)), variant: "destructive" });
      } else {
        toast({ title: "Error", description: e.message, variant: "destructive" });
      }
    },
  });

  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q || !currentWorkspace?.id) {
      setSearchResults(null);
      return;
    }
    setIsSearching(true);
    try {
      const { data, error } = await supabase.rpc("search_transcripts", {
        ws_id: currentWorkspace.id,
        search_query: q,
      });
      if (error) throw error;
      setSearchResults(data || []);
    } catch (e: any) {
      toast({ title: "Search error", description: e.message, variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  };

  const counts = {
    all: sessions.length,
    live: sessions.filter((s) => s.status === "live").length,
    scheduled: sessions.filter((s) => s.status === "scheduled").length,
    completed: sessions.filter((s) => s.status === "completed").length,
  };

  const renderSnippet = (snippet: string) => {
    const parts = snippet.split(/\*\*/);
    return parts.map((part, i) =>
      i % 2 === 1 ? (
        <mark key={i} className="bg-primary/20 text-foreground rounded px-0.5">{part}</mark>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  return (
    <div className="space-y-6">
      <ProductTour tourId="sessions" steps={TOUR_SESSIONS} />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 id="sessions-header" className="text-2xl font-bold">{t("sessions.title")}</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <DialogTrigger asChild>
                  <Button id="create-session-btn" disabled={!canCreate}>
                    <Plus className="h-4 w-4 me-2" />{t("sessions.create")}
                  </Button>
                </DialogTrigger>
              </span>
            </TooltipTrigger>
            {!canCreate && <TooltipContent>{t("observer.noPermission")}</TooltipContent>}
          </Tooltip>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("sessions.create")}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Session title" />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="idi">{t("sessions.idi")}</SelectItem>
                    <SelectItem value="focus_group">{t("sessions.focusGroup")}</SelectItem>
                    <SelectItem value="ux_test">{t("sessions.uxTest")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Time</Label>
                  <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Duration (min)</Label>
                <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("sessions.meetingUrl")} <span className="text-muted-foreground text-xs">({t("projects.optional")})</span></Label>
                <Input value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} placeholder="https://zoom.us/j/... or https://meet.google.com/..." />
              </div>
              {projects.length > 0 && (
                <div className="space-y-2">
                  <Label>{t("projects.project")} <span className="text-muted-foreground text-xs">({t("projects.optional")})</span></Label>
                  <Select value={projectId} onValueChange={setProjectId}>
                    <SelectTrigger><SelectValue placeholder={t("projects.project")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button onClick={() => createMutation.mutate()} disabled={!title.trim() || createMutation.isPending} className="w-full">
                {createMutation.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                {t("common.create")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Transcript Search */}
      <Card>
        <CardContent className="p-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                placeholder={t("sessions.searchTranscripts")}
                className="ps-9"
              />
            </div>
            {searchQuery && (
              <Button variant="ghost" size="icon" onClick={() => { setSearchQuery(""); setSearchResults(null); }}>
                <X className="h-4 w-4" />
              </Button>
            )}
            <Button onClick={handleSearch} disabled={!searchQuery.trim() || isSearching}>
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          {searchResults !== null && (
            <div className="mt-3 space-y-2">
              {searchResults.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">{t("sessions.searchNoResults")}</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">{searchResults.length} {t("sessions.searchResultsFound")}</p>
                  {searchResults.map((r: any) => (
                    <Card
                      key={r.transcript_id}
                      className="cursor-pointer hover:shadow-card-hover transition-shadow"
                      onClick={() => navigate(`/sessions/${r.session_id}`)}
                    >
                      <CardContent className="p-3">
                        <p className="text-sm font-medium">{r.session_title}</p>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          {renderSnippet(r.snippet)}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
          <TabsTrigger value="live">{t("sessions.live")} ({counts.live})</TabsTrigger>
          <TabsTrigger value="scheduled">{t("sessions.scheduled")} ({counts.scheduled})</TabsTrigger>
          <TabsTrigger value="completed">{t("sessions.completed")} ({counts.completed})</TabsTrigger>
        </TabsList>

        {["all", "live", "scheduled", "completed", "draft"].map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-4">
            {isLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sessions
                  .filter((s) => tab === "all" || s.status === tab)
                  .map((session) => {
                    const tc = typeConfig[session.type as keyof typeof typeConfig] || typeConfig.idi;
                    const TypeIcon = tc.icon;
                    return (
                      <Card key={session.id} className="hover:shadow-card-hover transition-shadow cursor-pointer" onClick={() => navigate(`/sessions/${session.id}`)}>
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle className="text-sm font-medium leading-snug">{session.title}</CardTitle>
                            <Badge variant={statusVariant[session.status as keyof typeof statusVariant] || "secondary"} className="shrink-0">
                              {session.status === "live" && <span className="h-1.5 w-1.5 rounded-full bg-destructive me-1 animate-pulse" />}
                              {t(`sessions.${session.status}`)}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <div className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${tc.color}`}>
                              <TypeIcon className="h-3 w-3" />
                              {t(tc.label)}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              {session.scheduled_date && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{session.scheduled_date}</span>}
                              {session.scheduled_time && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{session.scheduled_time}</span>}
                              <span>{session.duration_minutes}min</span>
                            </div>
                            {session.sentiment_summary && (() => {
                              const s = session.sentiment_summary as { overall: string };
                              const iconMap: Record<string, any> = { positive: TrendingUp, negative: TrendingDown, neutral: Minus, mixed: Shuffle };
                              const colorMap: Record<string, string> = {
                                positive: "text-emerald-600 bg-emerald-500/10",
                                negative: "text-red-600 bg-red-500/10",
                                neutral: "text-muted-foreground bg-muted",
                                mixed: "text-amber-600 bg-amber-500/10",
                              };
                              const SIcon = iconMap[s.overall] || Minus;
                              const cls = colorMap[s.overall] || colorMap.neutral;
                              return (
                                <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>
                                  <SIcon className="h-2.5 w-2.5" />
                                  {t(`sessionDetail.sentiment.${s.overall}`)}
                                </span>
                              );
                            })()}
                            <div className="flex items-center gap-2 mt-2">
                              {session.status === "live" && session.meeting_url && (
                                <Button size="sm" className="flex-1" onClick={(e) => { e.stopPropagation(); window.open(session.meeting_url, "_blank"); }}>
                                  <Play className="h-3 w-3 me-1" />
                                  {t("sessions.joinSession")}
                                </Button>
                              )}
                              <TranscriptUploadDialog
                                sessionId={session.id}
                                workspaceId={session.workspace_id}
                                hasTranscript={!!transcriptMap[session.id]}
                              >
                                <Button
                                  size="sm"
                                  variant={transcriptMap[session.id] ? "secondary" : "outline"}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <FileText className="h-3 w-3 me-1" />
                                  {transcriptMap[session.id]
                                    ? t("sessions.transcript.view")
                                    : t("sessions.transcript.add")}
                                </Button>
                              </TranscriptUploadDialog>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                {sessions.filter((s) => tab === "all" || s.status === tab).length === 0 && (
                  <EmptyState
                    icon={Video}
                    title={t("sessions.noSessions")}
                    description="Schedule your first qualitative session — IDI, focus group, or UX test — and start gathering rich insights."
                    actionLabel={t("sessions.create")}
                    onAction={() => setOpen(true)}
                  />
                )}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default Sessions;
