import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ArrowLeft, Calendar, Clock, Users, Video, Monitor, FileText, StickyNote,
  Plus, Trash2, Loader2, Bookmark, Eye, Zap, UserPlus, X, ExternalLink, Sparkles, Layout,
  Pencil, Save, XCircle, Globe, Share2, Link, Check, MessageSquare, Gift,
} from "lucide-react";
import { SendIncentiveDialog } from "@/components/incentives/SendIncentiveDialog";
import { TranscriptUploadDialog } from "@/components/sessions/TranscriptUploadDialog";
import { ThemesSection } from "@/components/sessions/ThemesSection";
import { AnalysisProgressButton } from "@/components/sessions/AnalysisProgressButton";
import { SentimentSummaryCard } from "@/components/sessions/SentimentSummaryCard";
import { ProbesTab } from "@/components/sessions/ProbesTab";
import { CommentsThread } from "@/components/CommentsThread";
import { MediaUploadDialog } from "@/components/sessions/MediaUploadDialog";
import { EmptyState } from "@/components/EmptyState";

const typeConfig = {
  focus_group: { label: "sessions.focusGroup", icon: Users, color: "bg-primary/10 text-primary" },
  idi: { label: "sessions.idi", icon: Video, color: "bg-accent/10 text-accent-foreground" },
  ux_test: { label: "sessions.uxTest", icon: Monitor, color: "bg-muted text-muted-foreground" },
};

const statusVariant = {
  draft: "secondary" as const,
  scheduled: "outline" as const,
  live: "default" as const,
  completed: "secondary" as const,
  cancelled: "destructive" as const,
};

const noteTypeIcons = {
  observation: Eye,
  bookmark: Bookmark,
  action_item: Zap,
};

const participantStatuses = ["invited", "confirmed", "attended", "no_show"] as const;

const SessionDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  // Note form state
  const [noteText, setNoteText] = useState("");
  const [noteType, setNoteType] = useState("observation");

  // Transcript edit state
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [editedTranscript, setEditedTranscript] = useState("");

  // Summary edit state
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [editedSummary, setEditedSummary] = useState("");

  // Share link state
  const [shareLinkCopied, setShareLinkCopied] = useState(false);

  // Participant add state
  const [addParticipantOpen, setAddParticipantOpen] = useState(false);
  const [incentiveParticipant, setIncentiveParticipant] = useState<{ id: string; name: string; email?: string } | null>(null);

  // Queries
  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ["session", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: transcript } = useQuery({
    queryKey: ["session-transcript", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_transcripts")
        .select("*")
        .eq("session_id", id!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: notes = [] } = useQuery({
    queryKey: ["session-notes", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_notes")
        .select("*")
        .eq("session_id", id!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: themes = [] } = useQuery({
    queryKey: ["session-themes", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_themes")
        .select("*")
        .eq("session_id", id!)
        .order("confidence_score", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: sessionParticipants = [] } = useQuery({
    queryKey: ["session-participants", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_participants")
        .select("*, participants(id, name, email)")
        .eq("session_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: allParticipants = [] } = useQuery({
    queryKey: ["workspace-participants", currentWorkspace?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participants")
        .select("id, name, email")
        .eq("workspace_id", currentWorkspace!.id)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!currentWorkspace?.id,
  });

  // Mutations
  const addNoteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("session_notes").insert({
        session_id: id!,
        workspace_id: session!.workspace_id,
        note_text: noteText.trim(),
        note_type: noteType,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session-notes", id] });
      setNoteText("");
      toast({ title: t("sessionDetail.noteSaved") });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase.from("session_notes").delete().eq("id", noteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session-notes", id] });
      toast({ title: t("sessionDetail.noteDeleted") });
    },
  });

  const addParticipantMutation = useMutation({
    mutationFn: async (participantId: string) => {
      const { error } = await supabase.from("session_participants").insert({
        session_id: id!,
        workspace_id: session!.workspace_id,
        participant_id: participantId,
        status: "invited",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session-participants", id] });
      setAddParticipantOpen(false);
      toast({ title: t("sessionDetail.participantAdded") });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateParticipantStatusMutation = useMutation({
    mutationFn: async ({ spId, status }: { spId: string; status: string }) => {
      const { error } = await supabase
        .from("session_participants")
        .update({ status })
        .eq("id", spId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session-participants", id] });
    },
  });

  const removeParticipantMutation = useMutation({
    mutationFn: async (spId: string) => {
      const { error } = await supabase.from("session_participants").delete().eq("id", spId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session-participants", id] });
      toast({ title: t("sessionDetail.participantRemoved") });
    },
  });

  // Analyze transcript mutation
  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("analyze-transcript", {
        body: { session_id: id, workspace_id: session?.workspace_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["session-themes", id] });
      queryClient.invalidateQueries({ queryKey: ["session", id] });
      toast({ title: t("sessionDetail.analysisComplete"), description: `${data.count} ${t("sessionDetail.themesExtracted")}` });
    },
    onError: (e) => toast({ title: t("sessionDetail.analysisError"), description: e.message, variant: "destructive" }),
  });

  // Summarize mutation
  const summarizeMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("summarize-session", {
        body: { session_id: id, workspace_id: session?.workspace_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session", id] });
      toast({ title: t("sessionDetail.summaryGenerated") });
    },
    onError: (e) => toast({ title: t("sessionDetail.summaryError"), description: e.message, variant: "destructive" }),
  });

  // Save transcript edit mutation
  const saveTranscriptMutation = useMutation({
    mutationFn: async (newText: string) => {
      const { error } = await supabase
        .from("session_transcripts")
        .update({ raw_text: newText, updated_at: new Date().toISOString() })
        .eq("id", transcript!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session-transcript", id] });
      setIsEditingTranscript(false);
      toast({ title: t("sessionDetail.transcriptSaved") });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Save summary edit mutation
  const saveSummaryMutation = useMutation({
    mutationFn: async (newSummary: string) => {
      const { error } = await supabase
        .from("sessions")
        .update({ summary: newSummary, updated_at: new Date().toISOString() })
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session", id] });
      setIsEditingSummary(false);
      toast({ title: t("sessionDetail.summarySaved") });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Generate share link mutation
  const generateShareLinkMutation = useMutation({
    mutationFn: async () => {
      const existingToken = session?.share_token;
      if (existingToken) return existingToken;
      const newToken = crypto.randomUUID();
      const { error } = await supabase
        .from("sessions")
        .update({ share_token: newToken })
        .eq("id", id!);
      if (error) throw error;
      return newToken;
    },
    onSuccess: (token) => {
      const url = `${window.location.origin}/shared/${token}`;
      navigator.clipboard.writeText(url);
      setShareLinkCopied(true);
      setTimeout(() => setShareLinkCopied(false), 2000);
      queryClient.invalidateQueries({ queryKey: ["session", id] });
      toast({ title: t("sessionDetail.shareLinkCopied") });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });


  if (sessionLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">{t("sessionDetail.notFound")}</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate("/sessions")}>
          <ArrowLeft className="h-4 w-4 me-2" />
          {t("sessions.title")}
        </Button>
      </div>
    );
  }

  const tc = typeConfig[session.type as keyof typeof typeConfig] || typeConfig.idi;
  const TypeIcon = tc.icon;
  const linkedIds = new Set(sessionParticipants.map((sp: any) => sp.participant_id));
  const availableParticipants = allParticipants.filter((p) => !linkedIds.has(p.id));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/sessions")} className="mt-1">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold truncate">{session.title}</h1>
            <Badge variant={statusVariant[session.status as keyof typeof statusVariant] || "secondary"}>
              {session.status === "live" && <span className="h-1.5 w-1.5 rounded-full bg-destructive me-1 animate-pulse" />}
              {t(`sessions.${session.status}`)}
            </Badge>
            <div className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${tc.color}`}>
              <TypeIcon className="h-3 w-3" />
              {t(tc.label)}
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
            {session.scheduled_date && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {session.scheduled_date}
              </span>
            )}
            {session.scheduled_time && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {session.scheduled_time}
              </span>
            )}
            <span>{session.duration_minutes}{t("sessionDetail.min")}</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            {session.meeting_url && (
              <Button size="sm" variant="outline" onClick={() => window.open(session.meeting_url, "_blank")}>
                <ExternalLink className="h-3.5 w-3.5 me-1.5" />
                {t("studio.openMeeting")}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => navigate(`/studio/${session.id}`)}>
              <Layout className="h-3.5 w-3.5 me-1.5" />
              {t("studio.sessionWorkspace")}
            </Button>
            {session.summary && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => generateShareLinkMutation.mutate()}
                disabled={generateShareLinkMutation.isPending}
              >
                {shareLinkCopied ? (
                  <Check className="h-3.5 w-3.5 me-1.5" />
                ) : (
                  <Share2 className="h-3.5 w-3.5 me-1.5" />
                )}
                {shareLinkCopied ? t("sessionDetail.linkCopied") : t("sessionDetail.shareSnapshot")}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Summary Card */}
      {(session.summary || transcript) && (
        <Card>
          <CardContent className="p-4">
            {session.summary ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    {t("sessionDetail.aiSummary")}
                  </h3>
                  <div className="flex items-center gap-1">
                    {!isEditingSummary ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditedSummary(session.summary || "");
                            setIsEditingSummary(true);
                          }}
                        >
                          <Pencil className="h-3 w-3 me-1" />
                          {t("common.edit")}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => summarizeMutation.mutate()}
                          disabled={summarizeMutation.isPending}
                        >
                          {summarizeMutation.isPending && <Loader2 className="h-3 w-3 me-1 animate-spin" />}
                          {t("sessionDetail.regenerateSummary")}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setIsEditingSummary(false)}
                        >
                          <XCircle className="h-3.5 w-3.5 me-1" />
                          {t("common.cancel")}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => saveSummaryMutation.mutate(editedSummary)}
                          disabled={saveSummaryMutation.isPending || editedSummary.trim() === session.summary}
                        >
                          {saveSummaryMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 me-1 animate-spin" />
                          ) : (
                            <Save className="h-3.5 w-3.5 me-1" />
                          )}
                          {t("common.save")}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {isEditingSummary ? (
                  <Textarea
                    value={editedSummary}
                    onChange={(e) => setEditedSummary(e.target.value)}
                    className="min-h-[120px] text-sm"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {session.summary}
                  </p>
                )}
              </div>
            ) : transcript ? (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{t("sessionDetail.noSummary")}</p>
                <Button
                  size="sm"
                  onClick={() => summarizeMutation.mutate()}
                  disabled={summarizeMutation.isPending}
                >
                  {summarizeMutation.isPending && <Loader2 className="h-3 w-3 me-1 animate-spin" />}
                  <Sparkles className="h-3.5 w-3.5 me-1.5" />
                  {t("sessionDetail.generateSummary")}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Sentiment Summary Card */}
      {session.sentiment_summary && (
        <SentimentSummaryCard sentiment={session.sentiment_summary as unknown as Parameters<typeof SentimentSummaryCard>[0]["sentiment"]} />
      )}

      {/* Tabs */}
      <Tabs defaultValue="transcript">
        <TabsList>
          <TabsTrigger value="transcript">
            <FileText className="h-3.5 w-3.5 me-1.5" />
            {t("sessionDetail.transcript")}
          </TabsTrigger>
          <TabsTrigger value="notes">
            <StickyNote className="h-3.5 w-3.5 me-1.5" />
            {t("sessionDetail.notes")} ({notes.length})
          </TabsTrigger>
          <TabsTrigger value="participants">
            <Users className="h-3.5 w-3.5 me-1.5" />
            {t("sessionDetail.participants")} ({sessionParticipants.length})
          </TabsTrigger>
          <TabsTrigger value="probes">
            <MessageSquare className="h-3.5 w-3.5 me-1.5" />
            {t("probes.tab")}
          </TabsTrigger>
          <TabsTrigger value="comments">
            <MessageSquare className="h-3.5 w-3.5 me-1.5" />
            {t("comments.tab") || "Comments"}
          </TabsTrigger>
        </TabsList>

        {/* Transcript Tab */}
        <TabsContent value="transcript" className="mt-4">
          {transcript ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  {t("sessionDetail.transcriptSource")}: {transcript.source}
                  <Badge variant="outline" className="text-xs gap-1">
                    <Globe className="h-3 w-3" />
                    {transcript.language === "ar" ? "العربية" : "English"}
                  </Badge>
                </p>
                <div className="flex items-center gap-2">
                  {!isEditingTranscript ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditedTranscript(transcript.raw_text);
                        setIsEditingTranscript(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5 me-1.5" />
                      {t("common.edit")}
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsEditingTranscript(false)}
                      >
                        <XCircle className="h-3.5 w-3.5 me-1.5" />
                        {t("common.cancel")}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => saveTranscriptMutation.mutate(editedTranscript)}
                        disabled={saveTranscriptMutation.isPending || editedTranscript.trim() === transcript.raw_text}
                      >
                        {saveTranscriptMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5 me-1.5" />
                        )}
                        {t("common.save")}
                      </Button>
                    </>
                  )}
                  <AnalysisProgressButton
                    isPending={analyzeMutation.isPending}
                    hasThemes={themes.length > 0}
                    onAnalyze={() => analyzeMutation.mutate()}
                  />
                  <TranscriptUploadDialog
                    sessionId={session.id}
                    workspaceId={session.workspace_id}
                    hasTranscript={true}
                  >
                    <Button size="sm" variant="outline">
                      {t("sessions.transcript.replace")}
                    </Button>
                  </TranscriptUploadDialog>
                </div>
              </div>
              <Card>
                <CardContent className="p-0">
                  {isEditingTranscript ? (
                    <Textarea
                      value={editedTranscript}
                      onChange={(e) => setEditedTranscript(e.target.value)}
                      className="min-h-[500px] font-mono text-sm border-0 rounded-lg focus-visible:ring-0 focus-visible:ring-offset-0 leading-relaxed"
                    />
                  ) : (
                    <ScrollArea className="h-[500px]">
                      <pre className="p-4 text-sm font-mono whitespace-pre-wrap break-words text-foreground leading-relaxed">
                        {transcript.raw_text}
                      </pre>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
              <ThemesSection themes={themes} />
            </div>
          ) : (
            <EmptyState
              icon={FileText}
              title={t("sessionDetail.noTranscript")}
              description={t("sessionDetail.noTranscriptDesc")}
            >
              <TranscriptUploadDialog
                sessionId={session.id}
                workspaceId={session.workspace_id}
                hasTranscript={false}
              >
                <Button>
                  <Plus className="h-4 w-4 me-2" />
                  {t("sessions.transcript.save")}
                </Button>
              </TranscriptUploadDialog>
              <MediaUploadDialog sessionId={session.id} workspaceId={session.workspace_id} />
            </EmptyState>
          )}
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex gap-2">
                <Select value={noteType} onValueChange={setNoteType}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="observation">
                      <span className="flex items-center gap-1.5"><Eye className="h-3 w-3" />{t("sessionDetail.observation")}</span>
                    </SelectItem>
                    <SelectItem value="bookmark">
                      <span className="flex items-center gap-1.5"><Bookmark className="h-3 w-3" />{t("sessionDetail.bookmark")}</span>
                    </SelectItem>
                    <SelectItem value="action_item">
                      <span className="flex items-center gap-1.5"><Zap className="h-3 w-3" />{t("sessionDetail.actionItem")}</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder={t("sessionDetail.addNotePlaceholder")}
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && noteText.trim()) addNoteMutation.mutate();
                  }}
                />
                <Button
                  onClick={() => addNoteMutation.mutate()}
                  disabled={!noteText.trim() || addNoteMutation.isPending}
                >
                  {addNoteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>

          {notes.length === 0 ? (
            <EmptyState
              icon={StickyNote}
              title={t("sessionDetail.noNotes")}
              description={t("sessionDetail.noNotesDesc")}
            />
          ) : (
            <div className="space-y-2">
              {notes.map((note) => {
                const NoteIcon = noteTypeIcons[note.note_type as keyof typeof noteTypeIcons] || Eye;
                const isOwner = note.created_by === user?.id;
                return (
                  <Card key={note.id}>
                    <CardContent className="p-3 flex items-start gap-3">
                      <div className="mt-0.5">
                        <NoteIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{note.note_text}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(note.created_at!).toLocaleString()}
                          {note.note_type && ` · ${t(`sessionDetail.${note.note_type}`)}`}
                        </p>
                      </div>
                      {isOwner && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => deleteNoteMutation.mutate(note.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Participants Tab */}
        <TabsContent value="participants" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Popover open={addParticipantOpen} onOpenChange={setAddParticipantOpen}>
              <PopoverTrigger asChild>
                <Button size="sm" disabled={availableParticipants.length === 0}>
                  <UserPlus className="h-4 w-4 me-2" />
                  {t("sessionDetail.addParticipant")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-2" align="end">
                <ScrollArea className="max-h-48">
                  {availableParticipants.map((p) => (
                    <button
                      key={p.id}
                      className="w-full text-start px-3 py-2 rounded-md hover:bg-accent text-sm transition-colors"
                      onClick={() => addParticipantMutation.mutate(p.id)}
                      disabled={addParticipantMutation.isPending}
                    >
                      <span className="font-medium">{p.name}</span>
                      {p.email && <span className="text-muted-foreground text-xs ms-2">{p.email}</span>}
                    </button>
                  ))}
                  {availableParticipants.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-3">
                      {t("sessionDetail.noAvailableParticipants")}
                    </p>
                  )}
                </ScrollArea>
              </PopoverContent>
            </Popover>
          </div>

          {sessionParticipants.length === 0 ? (
            <EmptyState
              icon={Users}
              title={t("sessionDetail.noParticipants")}
              description={t("sessionDetail.noParticipantsDesc")}
            />
          ) : (
            <div className="space-y-2">
              {sessionParticipants.map((sp: any) => (
                <Card key={sp.id}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{sp.participants?.name || "—"}</p>
                      {sp.participants?.email && (
                        <p className="text-xs text-muted-foreground">{sp.participants.email}</p>
                      )}
                    </div>
                    <Select
                      value={sp.status}
                      onValueChange={(status) =>
                        updateParticipantStatusMutation.mutate({ spId: sp.id, status })
                      }
                    >
                      <SelectTrigger className="w-[130px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {participantStatuses.map((s) => (
                          <SelectItem key={s} value={s}>
                            {t(`sessionDetail.status.${s}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-primary"
                      title="Send incentive"
                      onClick={() => setIncentiveParticipant({
                        id: sp.participants?.id,
                        name: sp.participants?.name || "Participant",
                        email: sp.participants?.email,
                      })}
                    >
                      <Gift className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => removeParticipantMutation.mutate(sp.id)}
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Send Incentive Dialog */}
          {incentiveParticipant && (
            <SendIncentiveDialog
              open={!!incentiveParticipant}
              onOpenChange={(open) => { if (!open) setIncentiveParticipant(null); }}
              workspaceId={session?.workspace_id}
              participantId={incentiveParticipant.id}
              participantName={incentiveParticipant.name}
              recipientEmail={incentiveParticipant.email}
              linkedSessionId={session?.id}
            />
          )}
        </TabsContent>

        {/* Probes Tab */}
        <TabsContent value="probes" className="mt-4">
          <ProbesTab
            sessionId={session.id}
            workspaceId={session.workspace_id}
            projectId={session.project_id}
            hasTranscript={!!transcript}
          />
        </TabsContent>

        {/* Comments Tab */}
        <TabsContent value="comments" className="mt-4">
          <CommentsThread entityType="session" entityId={session.id} maxHeight="400px" />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SessionDetail;
