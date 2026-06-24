import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Webhook, Plus, Trash2, Copy, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export function WebhooksTab({ workspaceId }: { workspaceId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: hooks = [], isLoading } = useQuery({
    queryKey: ["webhooks", workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhooks")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const secret = `whsec_${crypto.randomUUID().replace(/-/g, "")}`;
      const { error } = await supabase.from("webhooks").insert({
        workspace_id: workspaceId,
        url: url.trim(),
        events: ["simulation.completed"],
        secret_hash: secret,
        created_by: user.id,
      });
      if (error) throw error;
      return secret;
    },
    onSuccess: (secret) => {
      queryClient.invalidateQueries({ queryKey: ["webhooks", workspaceId] });
      setNewSecret(secret);
      setUrl("");
      toast({ title: "Webhook added", description: "Copy the signing secret now — it won't be shown again." });
    },
    onError: (e: any) => toast({ title: "Failed to add webhook", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (hookId: string) => {
      const { error } = await supabase.from("webhooks").delete().eq("id", hookId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks", workspaceId] });
      toast({ title: "Webhook removed" });
    },
  });

  const copySecret = async () => {
    if (!newSecret) return;
    await navigator.clipboard.writeText(newSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isValidUrl = /^https:\/\/.+/.test(url.trim());

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium flex items-center gap-2">
          <Webhook className="h-4 w-4" /> Webhooks
        </h3>
        <p className="text-sm text-muted-foreground">
          Receive an HMAC-SHA256-signed POST when an event fires. Currently emits{" "}
          <code className="bg-muted px-1 rounded text-xs">simulation.completed</code>.
        </p>
      </div>

      {newSecret && (
        <div className="rounded-md border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/40 p-3 space-y-2">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
            Signing secret — save it now, it won't be shown again. Verify the <code>X-Signature</code> HMAC with it.
          </p>
          <div className="flex gap-2">
            <Input readOnly value={newSecret} className="font-mono text-xs bg-background" />
            <Button variant="secondary" size="icon" onClick={copySecret} className="shrink-0">
              {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Input
          placeholder="https://your-endpoint.com/webhook"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Button onClick={() => createMutation.mutate()} disabled={!isValidUrl || createMutation.isPending} className="shrink-0">
          <Plus className="h-4 w-4 mr-1.5" /> Add
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Endpoints</CardTitle>
          <CardDescription>{hooks.length} configured</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-12 bg-muted/50 rounded animate-pulse" />
          ) : hooks.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm border-2 border-dashed rounded-md">
              No webhooks configured.
            </div>
          ) : (
            <div className="space-y-2">
              {hooks.map((h: any) => (
                <div key={h.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="min-w-0">
                    <p className="font-mono text-xs truncate">{h.url}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {(h.events || []).map((ev: string) => (
                        <Badge key={ev} variant="secondary" className="text-[10px]">{ev}</Badge>
                      ))}
                      <span className="text-[10px] text-muted-foreground">
                        added {h.created_at ? format(new Date(h.created_at), "MMM d, yyyy") : ""}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { if (confirm("Remove this webhook?")) deleteMutation.mutate(h.id); }}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
