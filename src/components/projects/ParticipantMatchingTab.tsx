import { useState, useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { Search, UserCheck, UserPlus, Star, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface Criterion {
  criterion: string;
  requirement: string;
}

interface ParticipantMatchingTabProps {
  projectId: string;
  screenerCriteria: Criterion[];
  sessions: Array<{ id: string; title: string }>;
}

interface MatchedParticipant {
  id: string;
  name: string;
  age: number | null;
  gender: string | null;
  location: string | null;
  quality_score: number | null;
  session_count: number | null;
  email: string | null;
  tags: string[];
  matchedCriteria: number;
  totalCriteria: number;
  alreadyAssigned: boolean;
}

function parseCriteria(criteria: Criterion[]) {
  return criteria.map((c) => {
    const key = c.criterion.toLowerCase().trim();
    const val = c.requirement.toLowerCase().trim();
    return { key, val, original: c };
  });
}

function matchParticipant(
  participant: { age: number | null; gender: string | null; location: string | null; tags: string[] },
  parsed: ReturnType<typeof parseCriteria>
): number {
  let matched = 0;
  for (const { key, val } of parsed) {
    if (key.includes("age")) {
      // Try to parse range like "25-35" or "25 - 35"
      const rangeMatch = val.match(/(\d+)\s*[-–]\s*(\d+)/);
      if (rangeMatch && participant.age != null) {
        const min = parseInt(rangeMatch[1]);
        const max = parseInt(rangeMatch[2]);
        if (participant.age >= min && participant.age <= max) matched++;
      }
    } else if (key.includes("gender") || key.includes("sex")) {
      if (participant.gender && participant.gender.toLowerCase().includes(val)) matched++;
    } else if (key.includes("location") || key.includes("city") || key.includes("region") || key.includes("country")) {
      if (participant.location && participant.location.toLowerCase().includes(val)) matched++;
    } else if (key.includes("tag") || key.includes("segment")) {
      if (participant.tags.some((t) => t.toLowerCase().includes(val))) matched++;
    } else {
      // Generic: check if any field contains the requirement
      const fields = [
        participant.gender,
        participant.location,
        ...participant.tags,
      ].filter(Boolean).map((f) => f!.toLowerCase());
      if (fields.some((f) => f.includes(val))) matched++;
    }
  }
  return matched;
}

export const ParticipantMatchingTab = ({ projectId, screenerCriteria, sessions }: ParticipantMatchingTabProps) => {
  const { t } = useI18n();
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();
  const workspaceId = currentWorkspace?.id;

  const [hasSearched, setHasSearched] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  // Fetch all participants
  const { data: participants = [], isLoading: loadingParticipants } = useQuery({
    queryKey: ["matching-participants", workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participants")
        .select("id, name, age, gender, location, quality_score, session_count, email")
        .eq("workspace_id", workspaceId!)
        .order("quality_score", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!workspaceId && hasSearched,
  });

  // Fetch tags for all participants
  const { data: allTags = [] } = useQuery({
    queryKey: ["matching-tags", workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participant_tags")
        .select("participant_id, tag_name")
        .eq("workspace_id", workspaceId!);
      if (error) throw error;
      return data;
    },
    enabled: !!workspaceId && hasSearched,
  });

  // Fetch already-assigned participants for this project's sessions
  const { data: assignedParticipants = [] } = useQuery({
    queryKey: ["matching-assigned", projectId],
    queryFn: async () => {
      const sessionIds = sessions.map((s) => s.id);
      if (sessionIds.length === 0) return [];
      const { data, error } = await supabase
        .from("session_participants")
        .select("participant_id, session_id")
        .in("session_id", sessionIds);
      if (error) throw error;
      return data;
    },
    enabled: hasSearched && sessions.length > 0,
  });

  // Build tag map
  const tagMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const t of allTags) {
      if (!map[t.participant_id]) map[t.participant_id] = [];
      map[t.participant_id].push(t.tag_name);
    }
    return map;
  }, [allTags]);

  // Assigned set
  const assignedSet = useMemo(
    () => new Set(assignedParticipants.map((a) => a.participant_id)),
    [assignedParticipants]
  );

  // Compute matches
  const matched: MatchedParticipant[] = useMemo(() => {
    if (!hasSearched || screenerCriteria.length === 0) return [];
    const parsed = parseCriteria(screenerCriteria);
    return participants
      .map((p) => {
        const tags = tagMap[p.id] || [];
        const matchedCount = matchParticipant({ ...p, tags }, parsed);
        return {
          ...p,
          tags,
          matchedCriteria: matchedCount,
          totalCriteria: parsed.length,
          alreadyAssigned: assignedSet.has(p.id),
        };
      })
      .filter((p) => p.matchedCriteria > 0)
      .sort((a, b) => {
        if (b.matchedCriteria !== a.matchedCriteria) return b.matchedCriteria - a.matchedCriteria;
        return (b.quality_score || 0) - (a.quality_score || 0);
      });
  }, [hasSearched, participants, tagMap, assignedSet, screenerCriteria]);

  // Assign mutation
  const assignMutation = useMutation({
    mutationFn: async ({ participantId, sessionId }: { participantId: string; sessionId: string }) => {
      if (!workspaceId) throw new Error("No workspace");
      const { error } = await supabase.from("session_participants").insert({
        workspace_id: workspaceId,
        session_id: sessionId,
        participant_id: participantId,
        status: "invited",
      });
      if (error) throw error;
      // Increment session_count
      const participant = participants.find((p) => p.id === participantId);
      if (participant) {
        await supabase
          .from("participants")
          .update({ session_count: (participant.session_count || 0) + 1 })
          .eq("id", participantId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["matching-assigned", projectId] });
      queryClient.invalidateQueries({ queryKey: ["matching-participants"] });
      toast.success(t("projects.recruit.assigned"));
      setAssigningId(null);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setAssigningId(null);
    },
  });

  if (screenerCriteria.length === 0) {
    return (
      <EmptyState
        icon={AlertCircle}
        title={t("projects.recruit.noCriteria")}
        description={t("projects.recruit.noCriteriaDesc")}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Criteria summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t("projects.screenerCriteria")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {screenerCriteria.map((c, i) => (
              <Badge key={i} variant="outline">
                {c.criterion}: {c.requirement}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Find matches button */}
      {!hasSearched ? (
        <Button onClick={() => setHasSearched(true)} className="gap-2">
          <Search className="h-4 w-4" />
          {t("projects.recruit.findMatches")}
        </Button>
      ) : loadingParticipants ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : matched.length === 0 ? (
        <EmptyState
          icon={Search}
          title={t("projects.recruit.noMatches")}
          description={t("projects.recruit.noMatchesDesc")}
        />
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {t("projects.recruit.results")} ({matched.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("participants.name")}</TableHead>
                  <TableHead>{t("participants.age")}</TableHead>
                  <TableHead>{t("participants.gender")}</TableHead>
                  <TableHead>{t("participants.location")}</TableHead>
                  <TableHead>{t("projects.recruit.matchScore")}</TableHead>
                  <TableHead className="flex items-center gap-1">
                    <Star className="h-3 w-3" /> {t("participants.qualityScore")}
                  </TableHead>
                  <TableHead>{t("participants.sessionCount")}</TableHead>
                  <TableHead>{t("projects.recruit.action")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matched.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.age ?? "—"}</TableCell>
                    <TableCell className="capitalize">{p.gender ?? "—"}</TableCell>
                    <TableCell>{p.location ?? "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={p.matchedCriteria === p.totalCriteria ? "default" : "secondary"}
                      >
                        {p.matchedCriteria}/{p.totalCriteria}
                      </Badge>
                    </TableCell>
                    <TableCell>{p.quality_score ?? "—"}</TableCell>
                    <TableCell>{p.session_count ?? 0}</TableCell>
                    <TableCell>
                      {p.alreadyAssigned ? (
                        <Badge variant="outline" className="gap-1">
                          <UserCheck className="h-3 w-3" />
                          {t("projects.recruit.alreadyAssigned")}
                        </Badge>
                      ) : sessions.length === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {t("projects.noSessions")}
                        </span>
                      ) : sessions.length === 1 ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={assignMutation.isPending && assigningId === p.id}
                          onClick={() => {
                            setAssigningId(p.id);
                            assignMutation.mutate({
                              participantId: p.id,
                              sessionId: sessions[0].id,
                            });
                          }}
                          className="gap-1"
                        >
                          <UserPlus className="h-3 w-3" />
                          {t("projects.recruit.assign")}
                        </Button>
                      ) : (
                        <Select
                          onValueChange={(sessionId) => {
                            setAssigningId(p.id);
                            assignMutation.mutate({ participantId: p.id, sessionId });
                          }}
                        >
                          <SelectTrigger className="h-8 w-36 text-xs">
                            <SelectValue placeholder={t("projects.recruit.assignToSession")} />
                          </SelectTrigger>
                          <SelectContent>
                            {sessions.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
