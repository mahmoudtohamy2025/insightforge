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
  ArrowLeft, FileQuestion, Calendar, Users, Tag, Loader2,
  Send, Sparkles, CheckCircle2, Clock
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const STATUS_OPTIONS = [
  "submitted","under_review","approved","in_progress","insights_ready","completed","declined","on_hold"
];
const STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  under_review: "Under Review",
  approved: "Approved",
  in_progress: "In Progress",
  insights_ready: "Insights Ready",
  completed: "Completed",
  declined: "Declined",
  on_hold: "On Hold",
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
      // Log the status change as a comment
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
      toast.success("Status updated");
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
      // Save suggestion to the requirement
      await supabase.from("requirements").update({ ai_methodology_suggestion: data }).eq("id", id);
    } catch (err: any) {
      toast.error("Failed to get AI suggestion");
    } finally {
      setAiLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!req) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Requirement not found.
        <Button variant="link" onClick={() => navigate("/requirements")}>Back to Requirements</Button>
      </div>
    );
  }

  const suggestion = aiSuggestion || req.ai_methodology_suggestion;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      {/* Back */}
      <Button variant="ghost" size="sm" className="w-fit -ml-2" onClick={() => navigate("/requirements")}>
        <ArrowLeft className="h-4 w-4 me-2" />
        Requirements
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div>
            <div className="flex items-start gap-3 mb-2">
              <FileQuestion className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1">
                <h1 className="text-xl font-bold">{req.title}</h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[req.status] || ""}`}>
                    {STATUS_LABELS[req.status] || req.status}
                  </span>
                  <Badge variant={PRIORITY_COLORS[req.priority] || "secondary"}>
                    {req.priority} priority
                  </Badge>
                  {req.category && (
                    <Badge variant="outline" className="text-xs">
                      {req.category.replace("_", " ")}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {req.description && (
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{req.description}</p>
            )}
          </div>

          {req.business_context && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Business Context</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{req.business_context}</p>
              </CardContent>
            </Card>
          )}

          {/* AI Methodology Suggestion */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  AI Methodology Suggestion
                </CardTitle>
                <Button size="sm" variant="outline" onClick={handleGetAiSuggestion} disabled={aiLoading}>
                  {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Get Suggestion"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {suggestion ? (
                <div className="text-sm space-y-2">
                  {suggestion.recommended_methodology && (
                    <p><span className="font-medium">Recommended:</span> {suggestion.recommended_methodology}</p>
                  )}
                  {suggestion.rationale && (
                    <p className="text-muted-foreground">{suggestion.rationale}</p>
                  )}
                  {suggestion.estimated_effort && (
                    <p><span className="font-medium">Effort:</span> {suggestion.estimated_effort}</p>
                  )}
                  {suggestion.matching_twin_count !== undefined && (
                    <p><span className="font-medium">Matching digital twins:</span> {suggestion.matching_twin_count}</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Click "Get Suggestion" to have AI recommend a research methodology, effort estimate, and matching digital twins.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Comments */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Discussion</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {comments.length === 0 && (
                <p className="text-xs text-muted-foreground">No comments yet. Start the discussion.</p>
              )}
              {comments.map((c: any) => (
                <div key={c.id} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold">
                      {(c.profiles?.full_name || "U").charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs font-medium">{c.profiles?.full_name || "User"}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(c.created_at), "MMM d, HH:mm")}
                    </span>
                    {c.comment_type !== "comment" && (
                      <Badge variant="outline" className="text-xs">{c.comment_type.replace("_", " ")}</Badge>
                    )}
                  </div>
                  <p className="text-sm ps-8 text-muted-foreground">{c.body}</p>
                  <Separator className="mt-1" />
                </div>
              ))}
              <div className="flex gap-2 mt-2">
                <Textarea
                  placeholder="Add a comment..."
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

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          {/* Status Management */}
          {canManage && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Update Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={req.status} onValueChange={(v) => statusMutation.mutate(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_LABELS[s] || s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          {/* Details */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Details</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              {req.target_audience && (
                <div className="flex items-start gap-2">
                  <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Target Audience</p>
                    <p>{req.target_audience}</p>
                  </div>
                </div>
              )}
              {req.target_market && (
                <div className="flex items-start gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Target Market</p>
                    <p>{req.target_market}</p>
                  </div>
                </div>
              )}
              {req.requested_deadline && (
                <div className="flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Requested By</p>
                    <p>{format(new Date(req.requested_deadline), "MMM d, yyyy")}</p>
                  </div>
                </div>
              )}
              {req.estimated_effort && (
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Estimated Effort</p>
                    <p className="capitalize">{req.estimated_effort}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Submitted</p>
                  <p>{format(new Date(req.created_at), "MMM d, yyyy")}</p>
                </div>
              </div>
              {req.completed_at && (
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Completed</p>
                    <p>{format(new Date(req.completed_at), "MMM d, yyyy")}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tags */}
          {req.tags && req.tags.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {req.tags.map((tag: string) => (
                    <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Linked Research */}
          {(req.linked_project_ids?.length > 0 || req.linked_session_ids?.length > 0 || req.linked_survey_ids?.length > 0) && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Linked Research</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-1 text-xs text-muted-foreground">
                {req.linked_project_ids?.length > 0 && <p>{req.linked_project_ids.length} Project(s)</p>}
                {req.linked_session_ids?.length > 0 && <p>{req.linked_session_ids.length} Session(s)</p>}
                {req.linked_survey_ids?.length > 0 && <p>{req.linked_survey_ids.length} Survey(s)</p>}
                {req.linked_simulation_ids?.length > 0 && <p>{req.linked_simulation_ids.length} Simulation(s)</p>}
                {req.linked_insight_ids?.length > 0 && <p>{req.linked_insight_ids.length} Insight(s)</p>}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
