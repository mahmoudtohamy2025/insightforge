import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface CreateWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateWorkspaceDialog({ open, onOpenChange }: CreateWorkspaceDialogProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { refetchWorkspaces, switchWorkspace } = useWorkspace();
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;

    setIsLoading(true);
    const slug =
      name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") +
      "-" +
      crypto.randomUUID().slice(0, 8);

    const { data, error } = await supabase
      .from("workspaces")
      .insert({ name: name.trim(), slug, created_by: user.id })
      .select("id")
      .single();

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setIsLoading(false);
      return;
    }

    // Add creator as owner
    const { error: memberError } = await supabase
      .from("workspace_memberships")
      .insert({ workspace_id: data.id, user_id: user.id, role: "owner" });

    if (memberError) {
      toast({ title: "Error", description: memberError.message, variant: "destructive" });
      setIsLoading(false);
      return;
    }

    await refetchWorkspaces();
    switchWorkspace(data.id);
    toast({ title: t("workspace.created") });
    setName("");
    setIsLoading(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("workspace.createNew")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ws-name">{t("auth.workspaceName")}</Label>
            <Input
              id="ws-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Research"
              required
              disabled={isLoading}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {t("common.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
