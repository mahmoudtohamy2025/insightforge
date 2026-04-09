import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Copy, Loader2, Search, Users, Mail, MailX } from "lucide-react";

interface DistributeSurveyDialogProps {
  surveyId: string;
  surveyTitle: string;
}

export function DistributeSurveyDialog({ surveyId, surveyTitle }: DistributeSurveyDialogProps) {
  const { currentWorkspace } = useWorkspace();
  const { t } = useI18n();
  const workspaceId = currentWorkspace?.id;

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const { data: participants = [], isLoading } = useQuery({
    queryKey: ["participants-for-distribute", workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("participants")
        .select("id, name, email")
        .eq("workspace_id", workspaceId!)
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!workspaceId && open,
  });

  const filtered = participants.filter((p) => {
    const q = search.toLowerCase();
    return (
      (p.name?.toLowerCase().includes(q) ?? false) ||
      (p.email?.toLowerCase().includes(q) ?? false)
    );
  });

  const withEmail = filtered.filter((p) => p.email);
  const noEmail = filtered.filter((p) => !p.email);

  const toggleAll = () => {
    if (selected.size === withEmail.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(withEmail.map((p) => p.id)));
    }
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const distribute = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("distribute-survey", {
        body: {
          survey_id: surveyId,
          workspace_id: workspaceId,
          participant_ids: Array.from(selected),
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const url = data?.survey_url;
      toast.success(
        `Survey distributed to ${data?.sent_count || selected.size} participants.` +
        (data?.email_enabled ? " Emails sent!" : " Copy the link to share manually."),
      );
      if (url) {
        navigator.clipboard.writeText(url);
        toast.info("Survey link copied to clipboard");
      }
      setOpen(false);
      setSelected(new Set());
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to distribute survey");
    },
  });

  const surveyLink = `${window.location.origin}/s/${surveyId}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Send className="h-3.5 w-3.5 me-1" />
          Distribute
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Distribute Survey
          </DialogTitle>
          <DialogDescription>
            Send "{surveyTitle}" to workspace participants
          </DialogDescription>
        </DialogHeader>

        {/* Survey link */}
        <div className="flex gap-2">
          <Input value={surveyLink} readOnly className="text-xs font-mono flex-1" />
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(surveyLink);
              toast.success("Link copied!");
            }}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search participants..."
            className="pl-9 text-sm"
          />
        </div>

        {/* Select all */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <button
            type="button"
            onClick={toggleAll}
            className="text-primary hover:underline"
          >
            {selected.size === withEmail.length && withEmail.length > 0 ? "Deselect all" : "Select all with email"}
          </button>
          <span>{selected.size} selected</span>
        </div>

        {/* Participant list */}
        <ScrollArea className="h-[240px] rounded-md border">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              No participants found
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {withEmail.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={selected.has(p.id)}
                    onCheckedChange={() => toggle(p.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name || "Unnamed"}</p>
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                      <Mail className="h-3 w-3 shrink-0" />
                      {p.email}
                    </p>
                  </div>
                </label>
              ))}
              {noEmail.length > 0 && (
                <>
                  <div className="text-xs text-muted-foreground px-2 pt-3 pb-1 flex items-center gap-1">
                    <MailX className="h-3 w-3" />
                    No email ({noEmail.length})
                  </div>
                  {noEmail.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 rounded-md px-2 py-2 opacity-50 cursor-not-allowed"
                    >
                      <Checkbox disabled checked={false} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.name || "Unnamed"}</p>
                        <p className="text-xs text-muted-foreground">No email address</p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={selected.size === 0 || distribute.isPending}
            onClick={() => distribute.mutate()}
          >
            {distribute.isPending && <Loader2 className="h-3.5 w-3.5 me-1 animate-spin" />}
            <Send className="h-3.5 w-3.5 me-1" />
            Send to {selected.size} participant{selected.size !== 1 ? "s" : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
