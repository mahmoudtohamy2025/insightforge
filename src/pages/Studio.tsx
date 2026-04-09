import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/EmptyState";
import {
  ArrowLeft, ExternalLink, StickyNote, FileText, Plus, Trash2,
  Loader2, Bookmark, Eye, Zap, Sparkles, Tag, Keyboard, Brain,
  Mic, MicOff, Save
} from "lucide-react";

// Web Speech API Types
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const noteTypeIcons = {
  observation: Eye,
  bookmark: Bookmark,
  action_item: Zap,
};

const Studio = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  const [noteText, setNoteText] = useState("");
  const [noteType, setNoteType] = useState("observation");
  const [rightTab, setRightTab] = useState("notes");
  const [showShortcuts, setShowShortcuts] = useState(false);
  
  // Real-time transcription state
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");

  const workspaceId = currentWorkspace?.id;

  const { data: session, isLoading } = useQuery({
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
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

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
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("analyze-transcript", {
        body: { session_id: id, workspace_id: workspaceId },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session-themes", id] });
      toast({ title: t("studio.analysisStarted") || "Analysis started" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const saveTranscriptMutation = useMutation({
    mutationFn: async (text: string) => {
      // Check if a transcript already exists
      const existing = transcript;
      
      if (existing) {
        const { error } = await supabase
          .from("session_transcripts")
          .update({ raw_text: existing.raw_text + "\n\n" + text })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("session_transcripts")
          .insert({
            session_id: id!,
            raw_text: text,
            workspace_id: workspaceId || "",
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["session-transcript", id] });
      setLiveTranscript("");
      toast({ title: "Live transcript saved" });
    },
    onError: (e) => toast({ title: "Failed to save transcript", description: e.message, variant: "destructive" }),
  });

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recog = new SpeechRecognition();
        recog.continuous = true;
        recog.interimResults = true;
        
        recog.onresult = (event: any) => {
          let final = "";
          let interim = "";
          
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              final += event.results[i][0].transcript;
            } else {
              interim += event.results[i][0].transcript;
            }
          }
          
          if (final) {
            setLiveTranscript(prev => prev + (prev ? " " : "") + final);
          }
          setInterimTranscript(interim);
        };
        
        recog.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          if (event.error !== "no-speech") {
            setIsListening(false);
          }
        };

        recog.onend = () => {
          // Restart if still marked as listening (to prevent stopping after a pause)
          if (isListening) {
            try {
              recog.start();
            } catch (e) {
              setIsListening(false);
            }
          } else {
            setIsListening(false);
          }
        };
        
        setRecognition(recog);
      }
    }
  }, []); // Only run once to setup

  // Sync isListening with recognition start/stop
  useEffect(() => {
    if (!recognition) return;
    
    if (isListening) {
      try {
        recognition.start();
      } catch (e) {
        // Already started or error
      }
    } else {
      try {
        recognition.stop();
      } catch (e) {
        // Error stopping
      }
    }
    
    return () => {
      if (isListening) {
         try { recognition.stop(); } catch(e) { console.debug("Speech stop error", e); }
      }
    };
  }, [isListening, recognition]);

  const toggleListening = () => {
    if (!recognition) {
      toast({ 
        title: "Speech Recognition Unavailable", 
        description: "Your browser does not support Speech Recognition. Try Chrome, Edge, or Safari.", 
        variant: "destructive" 
      });
      return;
    }
    setIsListening(prev => !prev);
  };

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't trigger when typing in inputs
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    switch (e.key.toLowerCase()) {
      case "n":
        setRightTab("notes");
        break;
      case "t":
        setRightTab("themes");
        break;
      case "a":
        if (transcript && !analyzeMutation.isPending) {
          analyzeMutation.mutate();
        }
        break;
      case "?":
        setShowShortcuts((prev) => !prev);
        break;
    }
  }, [transcript, analyzeMutation]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/sessions/${id}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-bold">{t("studio.analysisWorkspace") || "Analysis Workspace"}</h1>
            <p className="text-xs text-muted-foreground">{session.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {transcript && themes.length === 0 && (
            <Button
              size="sm"
              onClick={() => analyzeMutation.mutate()}
              disabled={analyzeMutation.isPending}
            >
              {analyzeMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 me-1 animate-spin" />
              ) : (
                <Brain className="h-3.5 w-3.5 me-1" />
              )}
              {t("studio.analyze") || "Analyze"}
            </Button>
          )}
          {session.meeting_url && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(session.meeting_url, "_blank")}
            >
              <ExternalLink className="h-3.5 w-3.5 me-1" />
              {t("studio.openMeeting")}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowShortcuts((prev) => !prev)}
            title="Keyboard shortcuts (?)"
          >
            <Keyboard className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Keyboard shortcuts hint */}
      {showShortcuts && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
          <span className="font-medium">{t("studio.shortcuts") || "Shortcuts"}:</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-background border text-[10px]">N</kbd> Notes</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-background border text-[10px]">T</kbd> Themes</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-background border text-[10px]">A</kbd> Analyze</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-background border text-[10px]">?</kbd> Toggle</span>
        </div>
      )}

      {/* Two-panel layout: Transcript (left) | Tabbed Panel (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* LEFT: Transcript Panel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                {t("sessionDetail.transcript")}
                {transcript && (
                  <Badge variant="outline" className="text-[10px]">
                    {transcript.language || "en"}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {liveTranscript && (
                   <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-7 text-xs px-2"
                    onClick={() => saveTranscriptMutation.mutate(liveTranscript)}
                    disabled={saveTranscriptMutation.isPending}
                  >
                    <Save className="h-3 w-3 me-1" />
                    Save Live Additions
                  </Button>
                )}
                 <Button 
                  size="sm" 
                  variant={isListening ? "destructive" : "default"} 
                  className="h-7 text-xs px-2 shadow-sm relative overflow-hidden group"
                  onClick={toggleListening}
                >
                  {isListening && (
                    <span className="absolute inset-0 w-full h-full bg-destructive-foreground/20 animate-pulse pointer-events-none" />
                  )}
                  {isListening ? (
                    <>
                      <MicOff className="h-3 w-3 me-1 z-10" />
                      <span className="z-10">Stop Recording</span>
                    </>
                  ) : (
                    <>
                      <Mic className="h-3 w-3 me-1 z-10" />
                      <span className="z-10">Start Live Transcription</span>
                    </>
                  )}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(transcript || liveTranscript) ? (
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {transcript && (
                    <pre className="text-sm font-mono whitespace-pre-wrap break-words text-foreground/80 leading-relaxed font-sans">
                      {transcript.raw_text}
                    </pre>
                  )}
                  
                  {liveTranscript && (
                    <div className="border-t pt-4">
                      <p className="text-xs font-semibold uppercase text-primary mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        Live Transcription
                      </p>
                      <pre className="text-sm font-mono whitespace-pre-wrap break-words text-foreground font-sans">
                        {liveTranscript}
                        <span className="text-muted-foreground italic">{interimTranscript ? ` ${interimTranscript}` : ""}</span>
                      </pre>
                    </div>
                  )}
                  
                  {!liveTranscript && interimTranscript && (
                    <div className="border-t pt-4">
                      <p className="text-xs font-semibold uppercase text-primary mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        Live Transcription
                      </p>
                      <pre className="text-sm font-mono whitespace-pre-wrap break-words text-muted-foreground italic font-sans">
                        {interimTranscript}
                      </pre>
                    </div>
                  )}
                </div>
              </ScrollArea>
            ) : (
              <EmptyState
                icon={Mic}
                title={t("sessionDetail.noTranscript") || "No Transcript"}
                description={"Start live transcription to record this session, or upload an audio file later."}
              />
            )}
          </CardContent>
        </Card>

        {/* RIGHT: Tabbed Panel (Notes / Themes) */}
        <Card>
          <CardContent className="pt-4">
            <Tabs value={rightTab} onValueChange={setRightTab}>
              <TabsList className="w-full">
                <TabsTrigger value="notes" className="flex-1 text-xs">
                  <StickyNote className="h-3 w-3 me-1" />
                  {t("sessionDetail.notes")} ({notes.length})
                </TabsTrigger>
                <TabsTrigger value="themes" className="flex-1 text-xs">
                  <Tag className="h-3 w-3 me-1" />
                  {t("studio.themes") || "Themes"} ({themes.length})
                </TabsTrigger>
              </TabsList>

              {/* Notes Tab */}
              <TabsContent value="notes" className="mt-3 space-y-3">
                <div className="flex gap-2">
                  <Select value={noteType} onValueChange={setNoteType}>
                    <SelectTrigger className="w-[120px] h-8 text-xs">
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
                    className="flex-1 h-8 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && noteText.trim()) addNoteMutation.mutate();
                    }}
                  />
                  <Button
                    size="sm"
                    className="h-8"
                    onClick={() => addNoteMutation.mutate()}
                    disabled={!noteText.trim() || addNoteMutation.isPending}
                  >
                    {addNoteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  </Button>
                </div>
                <ScrollArea className="h-[420px]">
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
                          <div key={note.id} className="flex items-start gap-2 text-xs p-2 rounded-md bg-muted/50">
                            <NoteIcon className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p>{note.note_text}</p>
                              <span className="text-muted-foreground">
                                {new Date(note.created_at!).toLocaleTimeString()}
                              </span>
                            </div>
                            {isOwner && (
                              <button
                                className="shrink-0 text-muted-foreground hover:text-destructive"
                                onClick={() => deleteNoteMutation.mutate(note.id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              {/* Themes Tab */}
              <TabsContent value="themes" className="mt-3">
                <ScrollArea className="h-[450px]">
                  {themes.length === 0 ? (
                    <div className="text-center py-8">
                      <Sparkles className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        {t("studio.noThemes") || "No themes extracted yet"}
                      </p>
                      {transcript && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          onClick={() => analyzeMutation.mutate()}
                          disabled={analyzeMutation.isPending}
                        >
                          {analyzeMutation.isPending && <Loader2 className="h-3 w-3 me-1 animate-spin" />}
                          <Brain className="h-3 w-3 me-1" />
                          {t("studio.analyze") || "Run Analysis"}
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {themes.map((theme) => (
                        <div key={theme.id} className="p-3 rounded-md bg-muted/50 space-y-1">
                          <div className="flex items-center gap-2">
                            <Tag className="h-3 w-3 text-primary shrink-0" />
                            <p className="text-sm font-medium">{theme.title}</p>
                            {theme.confidence_score != null && (
                              <Badge variant="outline" className="text-[10px]">{Math.round(theme.confidence_score * 100)}%</Badge>
                            )}
                          </div>
                          {theme.description && (
                            <p className="text-xs text-muted-foreground ps-5">{theme.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Studio;
