import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  FileQuestion,
  Loader2,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Tag,
  TriangleAlert,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  estimateDecisionConfidence,
  getRequirementDecisionMemo,
  getConfidenceMeta,
  getEvidenceStatus,
  getRecommendedNextAction,
} from "@/lib/founderDecision";

const STATUS_OPTIONS = ["submitted", "under_review", "approved", "in_progress", "insights_ready", "completed", "declined", "on_hold"];
const STATUS_LABELS: Record<string, string> = {
  submitted: "Captured",
  under_review: "Scoping",
  approved: "Ready to test",
  in_progress: "Running",
  insights_ready: "Memo ready",
  completed: "Closed",
  declined: "Declined",
  on_hold: "On hold",
};
const STATUS_COLORS: Record<string, string> = {
  submitted: "bg-muted text-muted-foreground",
  under_review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  approved: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  in_progress: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  insights_ready: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  declined: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  on_hold: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};
const PRIORITY_COLORS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  critical: "destructive",
  high: "default",
  medium: "secondary",
  low: "outline",
};

export default function RequirementDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { isAdmin, isOwner } = useWorkspaceRole();
  const queryClient = useQueryClient();
  const [commentBody, setCommentBody] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<any>(null);

  const workspaceId = currentWorkspace?.id;
  const canManage = isAdmin || isOwner;

  const { data: req, isLoading } = useQuery({
    queryKey: ["requirement", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("requirements")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["requirement-comments", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("requirement_comments")
        .select("*, profiles(full_name)")
        .eq("requirement_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase
        .from("requirements")
        .update({ status: newStatus, ...(newStatus === "completed" ? { completed_at: new Date().toISOString() } : {}) })
        .eq("id", id);
      if (error) throw error;

      await supabase.from("requirement_comments").insert({
        requirement_id: id,
        workspace_id: workspaceId,
        user_id: user?.id,
        body: `Status changed to "${STATUS_LABELS[newStatus] || newStatus}"`,
        comment_type: "status_change",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requirement", id] });
      queryClient.invalidateQueries({ queryKey: ["requirement-comments", id] });
      queryClient.invalidateQueries({ queryKey: ["requirements", workspaceId] });
      toast.success("Decision status updated");
    },
    onError: () => toast.error("Failed to update status"),
  });

  const commentMutation = useMutation({
    mutationFn: async () => {
      if (!commentBody.trim() || !id || !user || !workspaceId) return;
      const { error } = await supabase.from("requirement_comments").insert({
        requirement_id: id,
        workspace_id: workspaceId,
        user_id: user.id,
        body: commentBody.trim(),
        comment_type: "comment",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setCommentBody("");
      queryClient.invalidateQueries({ queryKey: ["requirement-comments", id] });
    },
    onError: () => toast.error("Failed to post comment"),
  });

  const handleGetAiSuggestion = async () => {
    if (!req) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-methodology", {
        body: {
          workspace_id: workspaceId,
          title: req.title,
          description: req.description,
          category: req.category,
          target_audience: req.target_audience,
          target_market: req.target_market,
        },
      });
      if (error) throw error;
      setAiSuggestion(data);
      await supabase.from("requirements").update({ ai_methodology_suggestion: data }).eq("id", id);
      queryClient.invalidateQueries({ queryKey: ["requirement", id] });
    } catch {
      toast.error("Failed to get AI suggestion");
    } finally {
      setAiLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!req) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Decision not found.
        <Button variant="link" onClick={() => navigate("/requirements")}>Back to backlog</Button>
      </div>
    );
  }

  const suggestion = aiSuggestion || req.ai_methodology_suggestion;
  const confidenceScore = estimateDecisionConfidence({ ...req, ai_methodology_suggestion: suggestion });
  const confidence = getConfidenceMeta(confidenceScore);
  const evidence = getEvidenceStatus(req);
  const nextAction = getRecommendedNextAction({ ...req, ai_methodology_suggestion: suggestion });
  const memo = getRequirementDecisionMemo({
    ...req,
    ai_methodology_suggestion: suggestion,
  });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <Button variant="ghost" size="sm" className="w-fit -ml-2" onClick={() => navigate("/requirements")}>
        <ArrowLeft className="me-2 h-4 w-4" />
        Decisions
      </Button>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <div className="rounded-[28px] border border-border/70 bg-muted/20 p-6">
            <div className="flex items-start gap-4">
              <FileQuestion className="mt-1 h-6 w-6 text-primary" />
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[req.status] || ""}`}>
                    {STATUS_LABELS[req.status] || req.status}
                  </span>
                  <Badge variant={PRIORITY_COLORS[req.priority] || "secondary"}>{req.priority} risk</Badge>
                  {req.category && (
                    <Badge variant="outline">{req.category.replace("_", " ")}</Badge>
                  )}
                </div>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight">{req.title}</h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
                  {req.description || "No decision summary yet."}
                </p>
              </div>
            </div>
          </div>

          {req.business_context && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">What we believe and why it matters</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-7 text-muted-foreground">{req.business_context}</p>
              </CardContent>
            </Card>
          )}

          <Card className={`border ${confidence.railClassName}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Confidence level</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                {confidence.level === "low" ? (
                  <TriangleAlert className="mt-0.5 h-5 w-5" />
                ) : (
                  <ShieldCheck className="mt-0.5 h-5 w-5" />
                )}
                <div>
                  <div className="font-medium">{confidence.label}</div>
                  <div className="mt-1 text-muted-foreground">{confidence.summary}</div>
                </div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Recommended next move</div>
                <div className="mt-2 text-sm">{nextAction}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Decision summary
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <MemoBlock label="Recommendation" value={memo.recommendation} />
              <MemoBlock label="Confidence" value={memo.confidence} />
              <MemoBlock label="Evidence" value={`${memo.evidence}. ${evidence.description}`} />
              <MemoBlock label="Risk" value={memo.risk} />
              <div className="sm:col-span-2">
                <MemoBlock label="Next action" value={memo.nextAction} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                  Suggested research plan
                </CardTitle>
                <Button size="sm" variant="outline" onClick={handleGetAiSuggestion} disabled={aiLoading}>
                  {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Refresh"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {suggestion ? (
                <div className="space-y-3 text-sm">
                  {suggestion.recommended_methodology && (
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Recommended step</div>
                      <div className="mt-1">{suggestion.recommended_methodology}</div>
                    </div>
                  )}
                  {suggestion.rationale && (
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Why this helps</div>
                      <div className="mt-1 text-muted-foreground">{suggestion.rationale}</div>
                    </div>
                  )}
                  {suggestion.estimated_effort && (
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Estimated effort</div>
                      <div className="mt-1">{suggestion.estimated_effort}</div>
                    </div>
                  )}
                  {suggestion.matching_twin_count !== undefined && (
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Matching profiles</div>
                      <div className="mt-1">{suggestion.matching_twin_count} matching profiles</div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Ask InsightForge to suggest the best next step, whether that is an AI test, a survey, an interview, or another customer check.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Notes and discussion</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {comments.length === 0 && (
                <p className="text-xs text-muted-foreground">No notes yet. Add context, pushback, or new evidence here.</p>
              )}

              {comments.map((comment: any) => (
                <div key={comment.id} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {(comment.profiles?.full_name || "U").charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs font-medium">{comment.profiles?.full_name || "User"}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(comment.created_at), "MMM d, HH:mm")}
                    </span>
                    {comment.comment_type !== "comment" && (
                      <Badge variant="outline" className="text-xs">{comment.comment_type.replace("_", " ")}</Badge>
                    )}
                  </div>
                  <p className="ps-8 text-sm text-muted-foreground">{comment.body}</p>
                  <Separator className="mt-1" />
                </div>
              ))}

              <div className="mt-2 flex gap-2">
                <Textarea
                  placeholder="Add context, evidence, or a founder note..."
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  rows={2}
                  className="flex-1"
                />
                <Button
                  size="sm"
                  onClick={() => commentMutation.mutate()}
                  disabled={!commentBody.trim() || commentMutation.isPending}
                  className="self-end"
                >
                  {commentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {canManage && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Update progress</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={req.status} onValueChange={(value) => statusMutation.mutate(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {STATUS_LABELS[status] || status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

            <Card>
              <CardHeader className="pb-2">
              <CardTitle className="text-sm">Try the next step</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
              <Button onClick={() => navigate("/simulate")}>
                Run an AI test
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => navigate("/focus-group")}>
                Start a panel discussion
              </Button>
              <Button variant="outline" onClick={() => navigate("/validation")}>
                Review real-world accuracy
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Decision details</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm">
              {req.target_audience && (
                <DetailRow icon={Users} label="Target customer" value={req.target_audience} />
              )}
              {req.target_market && (
                <DetailRow icon={Tag} label="Target market" value={req.target_market} />
              )}
              {req.requested_deadline && (
                <DetailRow
                  icon={Calendar}
                  label="Decision deadline"
                  value={format(new Date(req.requested_deadline), "MMM d, yyyy")}
                />
              )}
              <DetailRow icon={Clock} label="Created" value={format(new Date(req.created_at), "MMM d, yyyy")} />
              {req.completed_at && (
                <DetailRow
                  icon={CheckCircle2}
                  label="Closed"
                  value={format(new Date(req.completed_at), "MMM d, yyyy")}
                />
              )}
            </CardContent>
          </Card>

          {req.tags && req.tags.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {req.tags.map((tag: string) => (
                    <Badge key={tag} variant="outline">{tag}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Evidence summary</CardTitle>
              </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <span>{evidence.label}</span>
              </div>
              <p className="text-muted-foreground">{evidence.description}</p>
              <div className="pt-2 text-xs text-muted-foreground">
                Linked items:
                {" "}
                {(req.linked_project_ids?.length || 0) +
                  (req.linked_session_ids?.length || 0) +
                  (req.linked_survey_ids?.length || 0) +
                  (req.linked_simulation_ids?.length || 0) +
                  (req.linked_insight_ids?.length || 0)}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MemoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 p-4">
      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-sm leading-6">{value}</div>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
      <div>
        <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
        <div className="mt-1">{value}</div>
      </div>
    </div>
  );
}
