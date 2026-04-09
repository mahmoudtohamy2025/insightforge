import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Key, Plus, Copy, Trash2, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface ApiKeysTabProps {
  workspaceId: string;
}

export function ApiKeysTab({ workspaceId }: ApiKeysTabProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: apiKeys = [], isLoading } = useQuery({
    queryKey: ["api-keys", workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("api_keys")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const generateKeyMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!user) throw new Error("Not authenticated");
      
      // Generate standard API key format
      const rawKey = `sk_live_${crypto.randomUUID().replace(/-/g, "")}`;
      
      // Hash it for DB storage (simple SHA-256)
      const msgUint8 = new TextEncoder().encode(rawKey);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Create hint
      const keyHint = `sk_live_...${rawKey.slice(-4)}`;

      const { data, error } = await supabase.from("api_keys").insert({
        workspace_id: workspaceId,
        created_by: user.id,
        name,
        key_hash: keyHash,
        key_hint: keyHint,
      }).select().single();

      if (error) throw error;
      return { dbKey: data, rawKey };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["api-keys", workspaceId] });
      setNewKey(data.rawKey);
      setKeyName("");
      toast({
        title: "API Key generated",
        description: "Please copy it now, it won't be shown again.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to generate API Key",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const deleteKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("api_keys").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys", workspaceId] });
      toast({ title: "API Key deleted", description: "The key has been revoked permanently." });
    },
  });

  const handleCopy = async () => {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setNewKey(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">API Keys</h3>
        <p className="text-sm text-muted-foreground">
          Manage API keys for accessing the InsightForge public API.
        </p>
      </div>

      <div className="flex justify-end">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Generate new key
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate New API Key</DialogTitle>
              <DialogDescription>
                Create a new API key to authenticate requests to the public API.
              </DialogDescription>
            </DialogHeader>

            {newKey ? (
              <div className="space-y-4 py-4">
                <div className="rounded-md bg-muted p-4 space-y-3 border">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 p-3 rounded-md border border-amber-200 dark:border-amber-900/50">
                    <Key className="h-5 w-5 shrink-0" />
                    <p className="text-sm font-medium">Please save this secret key somewhere safe and accessible. For security reasons, you won't be able to view it again.</p>
                  </div>
                  <div className="flex gap-2">
                    <Input readOnly value={newKey} className="font-mono bg-background" />
                    <Button onClick={handleCopy} variant="secondary" className="shrink-0">
                      {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Key Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g. Zapier Integration"
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              {newKey ? (
                <Button onClick={closeDialog}>Done</Button>
              ) : (
                <Button 
                  onClick={() => generateKeyMutation.mutate(keyName)} 
                  disabled={!keyName.trim() || generateKeyMutation.isPending}
                >
                  {generateKeyMutation.isPending ? "Generating..." : "Generate Key"}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Active API Keys</CardTitle>
          <CardDescription>You have {apiKeys.length} active API key{apiKeys.length !== 1 ? 's' : ''}.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="h-16 bg-muted/50 rounded-md animate-pulse" />
              ))}
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-md">
              No API keys configured.
            </div>
          ) : (
            <div className="space-y-3">
              {apiKeys.map((key) => (
                <div key={key.id} className="flex items-center justify-between p-4 border rounded-lg bg-card">
                  <div className="space-y-1">
                    <p className="font-medium text-sm">{key.name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
                      <span>{key.key_hint}</span>
                      <span>•</span>
                      <span>Created {format(new Date(key.created_at || ""), "MMM d, yyyy")}</span>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => {
                      if (confirm("Are you sure you want to revoke this key? Any integrations using it will break.")) {
                        deleteKeyMutation.mutate(key.id);
                      }
                    }}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      <div className="pt-8">
        <h3 className="text-lg font-medium mb-4">Simulation API (Digital Twins)</h3>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Use the same API key to access the <strong>Digital Twin Simulation API</strong> via the <code className="bg-muted px-1 rounded text-xs">X-API-Key</code> header.
            </p>
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase">cURL Example</p>
              <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto"><code>{`curl -X POST \\
  https://pjscposcnznrabswauuw.supabase.co/functions/v1/api-simulate \\
  -H "X-API-Key: sk_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "market_sim",
    "segment_ids": ["uuid-1", "uuid-2"],
    "product": "Premium coffee subscription",
    "pricing": "14.99",
    "market_size": 500000,
    "time_horizon_months": 24
  }'`}</code></pre>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Python</p>
              <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto"><code>{`import requests

resp = requests.post(
    "https://pjscposcnznrabswauuw.supabase.co/functions/v1/api-simulate",
    headers={"X-API-Key": "sk_live_YOUR_KEY"},
    json={
        "type": "policy",
        "segment_ids": ["uuid-1"],
        "policy_description": "Ban single-use plastics by 2028",
        "impact_areas": ["environment", "economy"],
        "severity": "high"
    }
)
print(resp.json())`}</code></pre>
            </div>
            <div className="text-xs text-muted-foreground border-t pt-3 mt-2">
              <p className="font-medium mb-1">Available simulation types:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li><code className="bg-muted px-1 rounded">solo</code> — Single twin query</li>
                <li><code className="bg-muted px-1 rounded">focus_group</code> — Multi-twin discussion</li>
                <li><code className="bg-muted px-1 rounded">ab_test</code> — A/B variant comparison</li>
                <li><code className="bg-muted px-1 rounded">market_sim</code> — Adoption curves &amp; revenue</li>
                <li><code className="bg-muted px-1 rounded">policy</code> — Policy impact assessment</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
