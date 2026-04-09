import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { UserPlus, Shield, Crown, Loader2, Trash2 } from "lucide-react";
import { logActivity } from "@/lib/activityLogger";
import { TIER_LIMITS } from "@/lib/tierLimits";

const roleColors: Record<string, string> = {
  owner: "bg-accent/10 text-accent-foreground",
  admin: "bg-primary/10 text-primary",
  researcher: "bg-success/10 text-success",
  observer: "bg-muted text-muted-foreground",
};

interface WorkspaceMember {
  id: string;
  user_id: string;
  role: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  is_last_owner: boolean;
}

export function TeamTab() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { currentWorkspace, refetchWorkspaces } = useWorkspace();
  const queryClient = useQueryClient();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("researcher");
  const [removingMember, setRemovingMember] = useState<WorkspaceMember | null>(null);
  const [transferringTo, setTransferringTo] = useState<WorkspaceMember | null>(null);

  const isOwner = currentWorkspace?.role === "owner";
  const isAdminOrOwner = currentWorkspace?.role === "owner" || currentWorkspace?.role === "admin";

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ["workspace-members", currentWorkspace?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("list-workspace-members", {
        body: { workspace_id: currentWorkspace!.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return (data?.members || []) as WorkspaceMember[];
    },
    enabled: !!currentWorkspace?.id,
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      if (!currentWorkspace || !inviteEmail.trim()) throw new Error("Missing data");
      const { data, error } = await supabase.functions.invoke("invite-member", {
        body: { workspace_id: currentWorkspace.id, email: inviteEmail.trim(), role: inviteRole },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["workspace-members"] });
      setInviteEmail("");
      toast({ title: data?.invited ? "Invitation sent" : t("workspace.memberAdded") });
      if (currentWorkspace && user) {
        logActivity(currentWorkspace.id, user.id, "invited_member", "member", undefined, { email: inviteEmail, role: inviteRole });
      }
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: string }) => {
      const { data, error } = await supabase.functions.invoke("invite-member", {
        body: { action: "update_role", workspace_id: currentWorkspace!.id, target_user_id: userId, new_role: newRole },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-members"] });
      refetchWorkspaces();
      toast({ title: t("workspace.roleUpdated") });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke("invite-member", {
        body: { action: "remove_member", workspace_id: currentWorkspace!.id, target_user_id: userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-members"] });
      setRemovingMember(null);
      toast({ title: t("workspace.memberRemoved") });
    },
    onError: (error) => {
      setRemovingMember(null);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const transferOwnershipMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      const { data, error } = await supabase.functions.invoke("invite-member", {
        body: { action: "transfer_ownership", workspace_id: currentWorkspace!.id, target_user_id: targetUserId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-members"] });
      refetchWorkspaces();
      setTransferringTo(null);
      toast({ title: t("workspace.ownershipTransferred") });
    },
    onError: (error) => {
      setTransferringTo(null);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t("settings.team")}</CardTitle>
            <Badge variant="outline" className="text-xs">
              {members.length}/{TIER_LIMITS[currentWorkspace?.tier || "free"]?.members === -1 ? "∞" : TIER_LIMITS[currentWorkspace?.tier || "free"]?.members} members
            </Badge>
          </div>
          {isAdminOrOwner && (
            <div className="flex items-center gap-2">
              <Input
                placeholder={t("workspace.inviteByEmail")}
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-56 h-8 text-xs"
              />
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="researcher">Researcher</SelectItem>
                  <SelectItem value="observer">Observer</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={() => inviteMutation.mutate()}
                disabled={inviteMutation.isPending || !inviteEmail.trim()}
              >
                {inviteMutation.isPending ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <UserPlus className="h-4 w-4 me-2" />}
                {t("settings.inviteMember")}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {membersLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("auth.fullName")}</TableHead>
                <TableHead>{t("auth.email")}</TableHead>
                <TableHead>Role</TableHead>
                {isAdminOrOwner && <TableHead>Change Role</TableHead>}
                {isAdminOrOwner && <TableHead></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={member.avatar_url || ""} />
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {(member.full_name || "U").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span>{member.full_name || "Unknown"}</span>
                      {member.role === "owner" && <Crown className="h-3 w-3 text-accent" />}
                      {member.user_id === user?.id && (
                        <Badge variant="outline" className="text-[10px]">You</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {member.email || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-[10px] ${roleColors[member.role] || ""}`}>
                      <Shield className="h-2.5 w-2.5 me-1" />
                      {t(`settings.roles.${member.role}`)}
                    </Badge>
                  </TableCell>
                  {isAdminOrOwner && (
                    <TableCell>
                      {member.user_id !== user?.id && !member.is_last_owner && member.role !== "owner" && (
                        <Select
                          defaultValue={member.role}
                          onValueChange={(val) => {
                            if (val === "transfer_ownership") {
                              setTransferringTo(member);
                            } else {
                              updateRoleMutation.mutate({ userId: member.user_id, newRole: val });
                            }
                          }}
                        >
                          <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="researcher">Researcher</SelectItem>
                            <SelectItem value="observer">Observer</SelectItem>
                            {isOwner && (
                              <SelectItem value="transfer_ownership" className="text-accent font-medium">
                                {t("workspace.transferOwnership")}
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      )}
                      {member.is_last_owner && (
                        <span className="text-xs text-muted-foreground italic">{t("workspace.lastOwner")}</span>
                      )}
                    </TableCell>
                  )}
                  {isAdminOrOwner && (
                    <TableCell>
                      {member.user_id !== user?.id && !member.is_last_owner && member.role !== "owner" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRemovingMember(member)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Remove Member Confirmation */}
        <AlertDialog open={!!removingMember} onOpenChange={(open) => !open && setRemovingMember(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("workspace.removeMemberTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("workspace.removeMemberDesc").replace("{name}", removingMember?.full_name || removingMember?.email || "this member")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => removingMember && removeMemberMutation.mutate(removingMember.user_id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {removeMemberMutation.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                {t("common.delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Transfer Ownership Confirmation */}
        <AlertDialog open={!!transferringTo} onOpenChange={(open) => !open && setTransferringTo(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("workspace.transferOwnershipTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("workspace.transferOwnershipDesc").replace("{name}", transferringTo?.full_name || transferringTo?.email || "this member")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => transferringTo && transferOwnershipMutation.mutate(transferringTo.user_id)}
              >
                {transferOwnershipMutation.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                {t("workspace.transferOwnership")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
