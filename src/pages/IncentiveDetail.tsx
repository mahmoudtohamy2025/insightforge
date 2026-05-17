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
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Gift, DollarSign, Send, Loader2, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

function formatCents(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  awaiting_approval: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  processing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  sent: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  claimed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  expired: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

export default function IncentiveDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { isAdmin, isOwner } = useWorkspaceRole();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");

  const workspaceId = currentWorkspace?.id;
  const canManage = isAdmin || isOwner;

  const { data: program, isLoading: programLoading } = useQuery({
    queryKey: ["incentive-program", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("incentive_programs")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: disbursements = [], isLoading: disLoading } = useQuery({
    queryKey: ["disbursements", id, statusFilter],
    queryFn: async () => {
      if (!id) return [];
      let query = supabase
        .from("incentive_disbursements")
        .select("*, participants(full_name, email)")
        .eq("program_id", id)
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const programStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase
        .from("incentive_programs")
        .update({ status: newStatus })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incentive-program", id] });
      queryClient.invalidateQueries({ queryKey: ["incentive-programs", workspaceId] });
      toast.success("Program status updated");
    },
    onError: () => toast.error("Failed to update status"),
  });

  const approveMutation = useMutation({
    mutationFn: async (disbursementId: string) => {
      const { error } = await supabase
        .from("incentive_disbursements")
        .update({ status: "processing", approved_by: user?.id, approved_at: new Date().toISOString() })
        .eq("id", disbursementId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["disbursements", id] });
      toast.success("Disbursement approved");
    },
    onError: () => toast.error("Failed to approve"),
  });

  if (programLoading) {
    return (
      <div className="p-6 flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!program) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Program not found.
        <Button variant="link" onClick={() => navigate("/incentives")}>Back to Rewards</Button>
      </div>
    );
  }

  const spentPct = program.total_budget_cents > 0
    ? Math.min(100, Math.round((program.spent_cents / program.total_budget_cents) * 100))
    : 0;

  const statusCounts = disbursements.reduce((acc: Record<string, number>, d: any) => {
    acc[d.status] = (acc[d.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto">
      <Button variant="ghost" size="sm" className="w-fit -ml-2" onClick={() => navigate("/incentives")}>
        <ArrowLeft className="h-4 w-4 me-2" />
        Rewards
      </Button>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Gift className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">{program.name}</h1>
            {program.description && (
              <p className="text-sm text-muted-foreground">{program.description}</p>
            )}
          </div>
        </div>
        {canManage && (
          <Select value={program.status} onValueChange={(v) => programStatusMutation.mutate(v)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["draft","active","paused","closed"].map((s) => (
                <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Budget Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Budget
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between text-sm mb-2">
              <span className="font-semibold text-lg">{formatCents(program.spent_cents, program.currency)}</span>
              <span className="text-muted-foreground">of {formatCents(program.total_budget_cents, program.currency)}</span>
            </div>
            <Progress value={spentPct} className="h-3 mb-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{spentPct}% used</span>
              <span>{formatCents(program.total_budget_cents - program.spent_cents, program.currency)} remaining</span>
            </div>
            {spentPct >= 90 && (
              <div className="flex items-center gap-2 mt-2 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" />
                Budget nearly exhausted
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Disbursements</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            {Object.entries(statusCounts).map(([status, count]) => (
              <div key={status} className="flex justify-between">
                <span className="text-muted-foreground capitalize">{status}</span>
                <span className="font-medium">{count as number}</span>
              </div>
            ))}
            {Object.keys(statusCounts).length === 0 && (
              <p className="text-xs text-muted-foreground">No disbursements yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Disbursements Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Disbursement History</CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {["pending","awaiting_approval","processing","sent","claimed","expired","failed","cancelled"].map((s) => (
                  <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {disLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : disbursements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No disbursements found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Participant</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Date</TableHead>
                  {canManage && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {disbursements.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div className="text-sm font-medium">{d.participants?.full_name || "Unknown"}</div>
                      <div className="text-xs text-muted-foreground">{d.participants?.email}</div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCents(d.amount_cents, d.currency)}
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[d.status] || ""}`}>
                        {d.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {d.reason?.replace(/_/g, " ") || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(d.created_at), "MMM d, yyyy")}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        {d.status === "awaiting_approval" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => approveMutation.mutate(d.id)}
                            disabled={approveMutation.isPending}
                          >
                            {approveMutation.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
