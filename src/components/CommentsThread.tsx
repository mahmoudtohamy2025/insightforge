import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageSquare,
  Send,
  Trash2,
  Pencil,
  CornerDownRight,
  Loader2,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Comment {
  id: string;
  workspace_id: string;
  entity_type: string;
  entity_id: string;
  parent_id: string | null;
  body: string;
  mentions: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface CommentsThreadProps {
  entityType: "pattern" | "theme" | "session" | "survey";
  entityId: string;
  maxHeight?: string;
}

// Helper to bypass type-gen mismatches until `supabase gen types` is re-run
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const commentsTable = () => (supabase as any).from("comments");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const membersTable = () => (supabase as any).from("workspace_members");

export function CommentsThread({
  entityType,
  entityId,
  maxHeight = "300px",
}: CommentsThreadProps) {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");

  const workspaceId = currentWorkspace?.id;

  const queryKey = ["comments", entityType, entityId];

  const { data: comments = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await commentsTable()
        .select("*")
        .eq("workspace_id", workspaceId!)
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as Comment[];
    },
    enabled: !!workspaceId && !!entityId,
  });

  // Group: top-level + replies
  const topLevel = comments.filter((c) => !c.parent_id);
  const replies = comments.filter((c) => c.parent_id);
  const getReplies = (parentId: string) =>
    replies.filter((r) => r.parent_id === parentId);

  const { data: members = [] } = useQuery({
    queryKey: ["workspace-members-names", workspaceId],
    queryFn: async () => {
      const { data, error } = await membersTable()
        .select("user_id, profiles(full_name)")
        .eq("workspace_id", workspaceId!);
      if (error) throw error;
      return (data || []) as Array<{
        user_id: string;
        profiles: { full_name: string } | null;
      }>;
    },
    enabled: !!workspaceId,
  });

  const getMemberName = (userId: string) => {
    const m = members.find((m) => m.user_id === userId);
    return m?.profiles?.full_name || "Unknown";
  };

  const addComment = useMutation({
    mutationFn: async () => {
      const { error } = await commentsTable().insert({
        workspace_id: workspaceId!,
        entity_type: entityType,
        entity_id: entityId,
        parent_id: replyTo,
        body: body.trim(),
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setBody("");
      setReplyTo(null);
    },
    onError: (e) =>
      toast({
        title: "Error",
        description: e.message,
        variant: "destructive",
      }),
  });

  const updateComment = useMutation({
    mutationFn: async () => {
      const { error } = await commentsTable()
        .update({ body: editBody.trim(), updated_at: new Date().toISOString() })
        .eq("id", editingId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setEditingId(null);
      setEditBody("");
    },
    onError: (e) =>
      toast({
        title: "Error",
        description: e.message,
        variant: "destructive",
      }),
  });

  const deleteComment = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await commentsTable()
        .delete()
        .eq("id", commentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  useEffect(() => {
    if (replyTo && inputRef.current) {
      inputRef.current.focus();
    }
  }, [replyTo]);

  const renderComment = (comment: Comment, isReply = false) => {
    const isOwner = comment.created_by === user?.id;
    const isEditing = editingId === comment.id;
    const name = getMemberName(comment.created_by);
    const initials = name.slice(0, 2).toUpperCase();
    const commentReplies = getReplies(comment.id);

    return (
      <div key={comment.id} className={`${isReply ? "ms-6" : ""}`}>
        <div className="flex items-start gap-2 py-2">
          <Avatar className="h-6 w-6 shrink-0">
            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">{name}</span>
              <span className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(comment.created_at), {
                  addSuffix: true,
                })}
              </span>
              {comment.updated_at !== comment.created_at && (
                <span className="text-[10px] text-muted-foreground italic">
                  (edited)
                </span>
              )}
            </div>
            {isEditing ? (
              <div className="mt-1 space-y-1">
                <Textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  className="text-xs min-h-[50px]"
                />
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    className="h-6 text-[10px]"
                    onClick={() => updateComment.mutate()}
                    disabled={!editBody.trim() || updateComment.isPending}
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[10px]"
                    onClick={() => {
                      setEditingId(null);
                      setEditBody("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-foreground mt-0.5 whitespace-pre-wrap">
                {comment.body}
              </p>
            )}
            {!isEditing && (
              <div className="flex items-center gap-1 mt-1">
                {!isReply && (
                  <button
                    className="text-[10px] text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setReplyTo(comment.id);
                    }}
                  >
                    <CornerDownRight className="h-3 w-3 inline me-0.5" />
                    Reply
                  </button>
                )}
                {isOwner && (
                  <>
                    <button
                      className="text-[10px] text-muted-foreground hover:text-foreground ms-2"
                      onClick={() => {
                        setEditingId(comment.id);
                        setEditBody(comment.body);
                      }}
                    >
                      <Pencil className="h-2.5 w-2.5 inline me-0.5" />
                      Edit
                    </button>
                    <button
                      className="text-[10px] text-muted-foreground hover:text-destructive ms-2"
                      onClick={() => deleteComment.mutate(comment.id)}
                    >
                      <Trash2 className="h-2.5 w-2.5 inline me-0.5" />
                      Delete
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        {/* Render replies */}
        {commentReplies.map((reply) => renderComment(reply, true))}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <MessageSquare className="h-3.5 w-3.5" />
        {t("comments.title") || "Comments"} ({comments.length})
      </div>

      <ScrollArea style={{ maxHeight }}>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            {t("comments.noComments") || "No comments yet"}
          </p>
        ) : (
          <div className="space-y-1 divide-y divide-border/50">
            {topLevel.map((c) => renderComment(c))}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="space-y-1">
        {replyTo && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 rounded px-2 py-1">
            <CornerDownRight className="h-3 w-3" />
            Replying to {getMemberName(comments.find((c) => c.id === replyTo)?.created_by || "")}
            <button
              className="ms-auto hover:text-foreground"
              onClick={() => setReplyTo(null)}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <Textarea
            ref={inputRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={
              t("comments.placeholder") || "Write a comment..."
            }
            className="text-xs min-h-[36px] max-h-[80px] resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && body.trim()) {
                addComment.mutate();
              }
            }}
          />
          <Button
            size="sm"
            className="h-9 w-9 shrink-0"
            onClick={() => addComment.mutate()}
            disabled={!body.trim() || addComment.isPending}
          >
            {addComment.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          {t("comments.submitHint") || "⌘Enter to submit"}
        </p>
      </div>
    </div>
  );
}
