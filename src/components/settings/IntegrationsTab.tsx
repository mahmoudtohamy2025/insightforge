import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Webhook, Plug, Trash2, Loader2, Copy, CheckCircle2, XCircle, Eye, EyeOff, MessageSquare, RefreshCw } from "lucide-react";
import { format } from "date-fns";

const WEBHOOK_EVENTS = [
  { value: "session.analysis_complete", label: "Session Analysis Complete" },
  { value: "survey.response_submitted", label: "Survey Response Submitted" },
  { value: "survey.target_reached", label: "Survey Target Reached" },
  { value: "insight.synthesis_complete", label: "Insight Synthesis Complete" },
  { value: "session.created", label: "Session Created" },
  { value: "survey.launched", label: "Survey Launched" },
];

interface IntegrationsTabProps {
  workspaceId?: string;
  isAdminOrOwner: boolean;
  t: (key: string) => string;
}

export function IntegrationsTab({ workspaceId, isAdminOrOwner, t }: IntegrationsTabProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return (
    <div className="space-y-6">
      {/* Slack Integration Card */}
      <SlackIntegrationCard workspaceId={workspaceId} isAdminOrOwner={isAdminOrOwner} t={t} />
      
      <Separator />

      {/* Webhooks Section */}
      <WebhooksSection workspaceId={workspaceId} isAdminOrOwner={isAdminOrOwner} t={t} userId={user?.id} />
    </div>
  );
}

// --- Slack Integration ---
function SlackIntegrationCard({ workspaceId, isAdminOrOwner, t }: { workspaceId?: string; isAdminOrOwner: boolean; t: (key: string) => string }) {
  const { data: integration, isLoading } = useQuery({
    queryKey: ["integration-slack", workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_integrations")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .eq("integration_type", "slack")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!workspaceId,
  });

  const isConnected = integration?.status === "connected";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#4A154B] flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-base">{t("integrations.slack")}</CardTitle>
              <CardDescription className="text-xs">{t("integrations.slackDesc")}</CardDescription>
            </div>
          </div>
          <Badge variant={isConnected ? "default" : "secondary"} className="text-xs">
            {isConnected ? (
              <><CheckCircle2 className="h-3 w-3 me-1" />{t("integrations.connected")}</>
            ) : (
              <><XCircle className="h-3 w-3 me-1" />{t("integrations.disconnected")}</>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <div className="space-y-3">
            {isConnected && integration?.last_sync_at && (
              <p className="text-xs text-muted-foreground">
                {t("integrations.lastSync")}: {format(new Date(integration.last_sync_at), "MMM d, yyyy HH:mm")}
              </p>
            )}
            <div className="flex items-center gap-2">
              {!isConnected ? (
                <p className="text-sm text-muted-foreground">
                  {t("integrations.slackSetupHint")}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("integrations.slackConnectedHint")}
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Webhooks Section ---
function WebhooksSection({ workspaceId, isAdminOrOwner, t, userId }: { workspaceId?: string; isAdminOrOwner: boolean; t: (key: string) => string; userId?: string }) {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewingDeliveries, setViewingDeliveries] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});

  const { data: webhooks = [], isLoading } = useQuery({
    queryKey: ["webhooks", workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhooks")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!workspaceId,
  });

  const { data: deliveries = [] } = useQuery({
    queryKey: ["webhook-deliveries", viewingDeliveries],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhook_deliveries")
        .select("*")
        .eq("webhook_id", viewingDeliveries!)
        .order("attempted_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!viewingDeliveries,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!workspaceId || !newUrl.trim()) throw new Error("URL required");
      // Generate a 32-byte random secret
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      const secret = Array.from(array).map(b => b.toString(16).padStart(2, "0")).join("");

      const { error } = await supabase
        .from("webhooks")
        .insert({
          workspace_id: workspaceId,
          url: newUrl.trim(),
          events: selectedEvents,
          secret_hash: secret,
          created_by: userId,
        });
      if (error) throw error;
      return secret;
    },
    onSuccess: (secret) => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      setShowCreate(false);
      setNewUrl("");
      setSelectedEvents([]);
      toast({
        title: t("integrations.webhookCreated"),
        description: t("integrations.webhookSecretHint"),
      });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("webhooks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      setDeletingId(null);
      toast({ title: t("integrations.webhookDeleted") });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const newStatus = status === "active" ? "disabled" : "active";
      const { error } = await supabase
        .from("webhooks")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
    },
  });

  const toggleEvent = (event: string) => {
    setSelectedEvents(prev =>
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Webhook className="h-4 w-4" />
              {t("integrations.webhooks")}
            </CardTitle>
            <CardDescription className="text-xs mt-1">{t("integrations.webhooksDesc")}</CardDescription>
          </div>
          {isAdminOrOwner && (
            <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
              <Plug className="h-4 w-4 me-1" />
              {t("integrations.addWebhook")}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Create form */}
        {showCreate && (
          <div className="rounded-lg border border-border p-4 space-y-4 bg-muted/30">
            <div className="space-y-2">
              <Label>{t("integrations.webhookUrl")}</Label>
              <Input
                value={newUrl}
                onChange={e => setNewUrl(e.target.value)}
                placeholder="https://your-server.com/webhook"
                type="url"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("integrations.eventTypes")}</Label>
              <p className="text-xs text-muted-foreground">{t("integrations.eventTypesHint")}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                {WEBHOOK_EVENTS.map(evt => (
                  <label key={evt.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={selectedEvents.includes(evt.value)}
                      onCheckedChange={() => toggleEvent(evt.value)}
                    />
                    {evt.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !newUrl.trim()}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 me-1 animate-spin" />}
                {t("common.create")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowCreate(false)}>
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        )}

        {/* Webhooks list */}
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : webhooks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">{t("integrations.noWebhooks")}</p>
        ) : (
          <div className="space-y-3">
            {webhooks.map((wh: any) => (
              <div key={wh.id} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant={wh.status === "active" ? "default" : "secondary"} className="text-[10px] shrink-0">
                      {wh.status}
                    </Badge>
                    <code className="text-xs text-muted-foreground truncate">{wh.url}</code>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isAdminOrOwner && (
                      <Switch
                        checked={wh.status === "active"}
                        onCheckedChange={() => toggleMutation.mutate({ id: wh.id, status: wh.status })}
                      />
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setViewingDeliveries(viewingDeliveries === wh.id ? null : wh.id)}>
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                    {isAdminOrOwner && (
                      <Button variant="ghost" size="sm" onClick={() => setDeletingId(wh.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Events */}
                <div className="flex flex-wrap gap-1">
                  {wh.events.length === 0 ? (
                    <span className="text-[10px] text-muted-foreground">{t("integrations.allEvents")}</span>
                  ) : (
                    wh.events.map((e: string) => (
                      <Badge key={e} variant="outline" className="text-[10px]">{e}</Badge>
                    ))
                  )}
                </div>

                {/* Secret */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">{t("integrations.secret")}:</span>
                  <code className="text-[10px] font-mono">
                    {showSecret[wh.id] ? wh.secret_hash : "••••••••••••••••"}
                  </code>
                  <button onClick={() => setShowSecret(prev => ({ ...prev, [wh.id]: !prev[wh.id] }))}>
                    {showSecret[wh.id] ? <EyeOff className="h-3 w-3 text-muted-foreground" /> : <Eye className="h-3 w-3 text-muted-foreground" />}
                  </button>
                  <button onClick={() => { navigator.clipboard.writeText(wh.secret_hash); toast({ title: "Copied" }); }}>
                    <Copy className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>

                {/* Delivery log */}
                {viewingDeliveries === wh.id && (
                  <div className="mt-2 rounded border border-border/50 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs py-1">{t("integrations.event")}</TableHead>
                          <TableHead className="text-xs py-1">{t("integrations.status")}</TableHead>
                          <TableHead className="text-xs py-1">{t("integrations.time")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deliveries.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-xs text-muted-foreground text-center py-3">
                              {t("integrations.noDeliveries")}
                            </TableCell>
                          </TableRow>
                        ) : (
                          deliveries.map((d: any) => (
                            <TableRow key={d.id}>
                              <TableCell className="text-xs py-1">{d.event_type}</TableCell>
                              <TableCell className="text-xs py-1">
                                <Badge variant={d.success ? "default" : "destructive"} className="text-[10px]">
                                  {d.response_status || "ERR"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs py-1 text-muted-foreground">
                                {d.attempted_at ? format(new Date(d.attempted_at), "MMM d HH:mm:ss") : "—"}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Delete Confirmation */}
        <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("integrations.deleteWebhookTitle")}</AlertDialogTitle>
              <AlertDialogDescription>{t("integrations.deleteWebhookDesc")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletingId && deleteMutation.mutate(deletingId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t("common.delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
