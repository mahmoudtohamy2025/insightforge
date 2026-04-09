import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MapPin,
  Mail,
  Phone,
  Calendar,
  Star,
  Users,
  Save,
  Loader2,
  Pencil,
  X,
  Plus,
  Tag,
  FileText,
} from "lucide-react";

const GENDER_OPTIONS = ["Male", "Female", "Non-binary", "Prefer not to say", "Other"];

interface Participant {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  age?: number | null;
  gender?: string | null;
  location?: string | null;
  source?: string | null;
  notes?: string | null;
  quality_score?: number | null;
  session_count?: number | null;
  created_at?: string | null;
}

interface ParticipantDetailDialogProps {
  participant: Participant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ParticipantDetailDialog = ({
  participant,
  open,
  onOpenChange,
}: ParticipantDetailDialogProps) => {
  const { t } = useI18n();
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAge, setEditAge] = useState("");
  const [editGender, setEditGender] = useState("");
  const [editLocation, setEditLocation] = useState("");

  // Notes
  const [notes, setNotes] = useState("");

  // Tags
  const [newTag, setNewTag] = useState("");

  // Reset state when participant changes
  useEffect(() => {
    if (participant) {
      setNotes(participant.notes || "");
      setEditName(participant.name);
      setEditEmail(participant.email || "");
      setEditPhone(participant.phone || "");
      setEditAge(participant.age ? String(participant.age) : "");
      setEditGender(participant.gender || "");
      setEditLocation(participant.location || "");
      setEditing(false);
      setNewTag("");
    }
  }, [participant?.id]);

  // Fetch session history
  const { data: sessions = [] } = useQuery({
    queryKey: ["participant-sessions", participant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("session_participants")
        .select("id, status, created_at, session_id, sessions(title, scheduled_date, status)")
        .eq("participant_id", participant!.id)
        .eq("workspace_id", currentWorkspace!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!participant?.id && !!currentWorkspace?.id,
  });

  // Fetch survey responses
  const { data: surveyResponses = [] } = useQuery({
    queryKey: ["participant-survey-responses", participant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("survey_responses")
        .select("id, completed_at, created_at, survey_id, surveys(title, status)")
        .eq("participant_id", participant!.id)
        .eq("workspace_id", currentWorkspace!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!participant?.id && !!currentWorkspace?.id,
  });

  // Fetch tags
  const { data: tags = [] } = useQuery({
    queryKey: ["participant-tags", participant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_tags")
        .select("id, tag_name")
        .eq("participant_id", participant!.id)
        .eq("workspace_id", currentWorkspace!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!participant?.id && !!currentWorkspace?.id,
  });

  // Update demographics mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("participants")
        .update({
          name: editName,
          email: editEmail || null,
          phone: editPhone || null,
          age: editAge ? parseInt(editAge) : null,
          gender: editGender || null,
          location: editLocation || null,
        })
        .eq("id", participant!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participants"] });
      setEditing(false);
      toast({ title: t("participants.updated") });
    },
    onError: (e) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Notes mutation
  const notesMutation = useMutation({
    mutationFn: async (newNotes: string) => {
      const { error } = await supabase
        .from("participants")
        .update({ notes: newNotes })
        .eq("id", participant!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participants"] });
      toast({ title: t("participants.notesSaved") });
    },
    onError: (e) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Add tag mutation
  const addTagMutation = useMutation({
    mutationFn: async (tagName: string) => {
      const { error } = await supabase.from("participant_tags").insert({
        workspace_id: currentWorkspace!.id,
        participant_id: participant!.id,
        tag_name: tagName.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participant-tags", participant?.id] });
      setNewTag("");
      toast({ title: t("participants.tagAdded") });
    },
    onError: (e) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Remove tag mutation
  const removeTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      const { error } = await supabase.from("participant_tags").delete().eq("id", tagId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participant-tags", participant?.id] });
      toast({ title: t("participants.tagRemoved") });
    },
    onError: (e) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (!participant) return null;

  const statusColor: Record<string, string> = {
    invited: "bg-muted text-muted-foreground",
    confirmed: "bg-primary/10 text-primary",
    attended: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    no_show: "bg-destructive/10 text-destructive",
  };

  const handleAddTag = () => {
    if (newTag.trim() && !tags.some((t: any) => t.tag_name.toLowerCase() === newTag.trim().toLowerCase())) {
      addTagMutation.mutate(newTag);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              {participant.name}
              {participant.source && participant.source !== "manual" && (
                <Badge variant="outline" className="text-[10px]">
                  {participant.source}
                </Badge>
              )}
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditing(!editing)}
              className="h-7 px-2"
            >
              {editing ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
              <span className="ms-1 text-xs">{editing ? t("common.cancel") : t("common.edit")}</span>
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-5">
          {/* Demographics - View or Edit mode */}
          {editing ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">{t("participants.fieldName")}</label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">{t("participants.fieldEmail")}</label>
                  <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">{t("participants.fieldPhone")}</label>
                  <Input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="h-8 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">{t("participants.fieldAge")}</label>
                  <Input type="number" value={editAge} onChange={(e) => setEditAge(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">{t("participants.fieldGender")}</label>
                  <Select value={editGender} onValueChange={setEditGender}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {GENDER_OPTIONS.map((g) => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">{t("participants.fieldLocation")}</label>
                  <Input value={editLocation} onChange={(e) => setEditLocation(e.target.value)} className="h-8 text-sm" />
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => updateMutation.mutate()}
                disabled={!editName.trim() || updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 me-1 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5 me-1" />
                )}
                {t("common.save")}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 text-sm">
              {participant.email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  <span className="truncate">{participant.email}</span>
                </div>
              )}
              {participant.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  <span>{participant.phone}</span>
                </div>
              )}
              {participant.location && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{participant.location}</span>
                </div>
              )}
              {participant.age && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{participant.age} {t("participants.years")}</span>
                </div>
              )}
              {participant.gender && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  <span>{participant.gender}</span>
                </div>
              )}
            </div>
          )}

          {/* Stats */}
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5">
              <Star className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">
                {participant.quality_score ?? 0}
              </span>
              <span className="text-xs text-muted-foreground">{t("participants.qualityScore")}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">
                {participant.session_count ?? 0}
              </span>
              <span className="text-xs text-muted-foreground">{t("participants.sessions")}</span>
            </div>
          </div>

          <Separator />

          {/* Tags */}
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" />
              {t("participants.tags")}
            </h4>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((tag: any) => (
                <Badge key={tag.id} variant="secondary" className="text-xs gap-1">
                  {tag.tag_name}
                  <button
                    onClick={() => removeTagMutation.mutate(tag.id)}
                    className="ms-0.5 hover:text-destructive"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
              {tags.length === 0 && (
                <span className="text-xs text-muted-foreground">{t("participants.noTags")}</span>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder={t("participants.addTagPlaceholder")}
                className="h-7 text-xs flex-1"
                onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
              />
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                onClick={handleAddTag}
                disabled={!newTag.trim() || addTagMutation.isPending}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <Separator />

          {/* Session History */}
          <div>
            <h4 className="text-sm font-medium mb-2">{t("participants.sessionHistory")}</h4>
            {sessions.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("participants.noSessions")}</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-auto">
                {sessions.map((sp: any) => (
                  <div
                    key={sp.id}
                    className="flex items-center justify-between text-sm bg-muted/50 rounded-md px-3 py-2"
                  >
                    <div>
                      <p className="font-medium text-xs">
                        {sp.sessions?.title || "Untitled"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {sp.sessions?.scheduled_date || "No date"}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={`text-[10px] ${statusColor[sp.status] || ""}`}
                    >
                      {sp.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Survey Responses */}
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              {t("participants.surveyResponses")}
            </h4>
            {surveyResponses.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("participants.noSurveyResponses")}</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-auto">
                {surveyResponses.map((sr: any) => (
                  <div
                    key={sr.id}
                    className="flex items-center justify-between text-sm bg-muted/50 rounded-md px-3 py-2"
                  >
                    <div>
                      <p className="font-medium text-xs">
                        {sr.surveys?.title || "Untitled Survey"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {sr.completed_at
                          ? new Date(sr.completed_at).toLocaleDateString()
                          : new Date(sr.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {sr.surveys?.status || "unknown"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Notes */}
          <div>
            <h4 className="text-sm font-medium mb-2">{t("participants.notes")}</h4>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("participants.notesPlaceholder")}
              rows={3}
              className="text-sm"
            />
            <Button
              size="sm"
              className="mt-2"
              onClick={() => notesMutation.mutate(notes)}
              disabled={notesMutation.isPending || notes === (participant.notes || "")}
            >
              {notesMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 me-1 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5 me-1" />
              )}
              {t("participants.saveNotes")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
