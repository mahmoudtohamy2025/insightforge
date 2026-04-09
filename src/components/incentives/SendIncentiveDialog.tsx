import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Gift } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId?: string;
  participantId: string;
  participantName: string;
  recipientEmail?: string;
  linkedSessionId?: string;
  linkedSurveyId?: string;
}

function formatCents(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export function SendIncentiveDialog({
  open, onOpenChange, workspaceId, participantId, participantName,
  recipientEmail, linkedSessionId, linkedSurveyId,
}: Props) {
  const { user } = useAuth();
  const [selectedProgram, setSelectedProgram] = useState("");
  const [amount, setAmount] = useState("");
  const [email, setEmail] = useState(recipientEmail || "");

  const { data: programs = [] } = useQuery({
    queryKey: ["active-incentive-programs", workspaceId],
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data, error } = await supabase
        .from("incentive_programs")
        .select("id, name, default_amount_cents, currency, total_budget_cents, spent_cents, status")
        .eq("workspace_id", workspaceId)
        .eq("status", "active");
      if (error) throw error;
      return data;
    },
    enabled: !!workspaceId && open,
  });

  const selectedProgramData = programs.find((p: any) => p.id === selectedProgram);

  const handleProgramChange = (programId: string) => {
    setSelectedProgram(programId);
    const prog = programs.find((p: any) => p.id === programId);
    if (prog) {
      setAmount((prog.default_amount_cents / 100).toFixed(2));
    }
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("disburse-incentive", {
        body: {
          program_id: selectedProgram,
          workspace_id: workspaceId,
          participant_id: participantId,
          amount_cents: Math.round(parseFloat(amount) * 100),
          currency: selectedProgramData?.currency || "USD",
          reason: linkedSessionId ? "session_completion" : linkedSurveyId ? "survey_completion" : "manual",
          linked_session_id: linkedSessionId || null,
          linked_survey_id: linkedSurveyId || null,
          delivery_method: email ? "email" : "manual",
          recipient_email: email || null,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(
        data?.status === "awaiting_approval"
          ? "Incentive queued for approval"
          : "Incentive sent successfully"
      );
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message || "Failed to send incentive"),
  });

  const remaining = selectedProgramData
    ? selectedProgramData.total_budget_cents - selectedProgramData.spent_cents
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-4 w-4 text-primary" />
            Send Incentive to {participantName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {programs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No active incentive programs. Create one in the Incentives section first.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <Label>Program</Label>
                <Select value={selectedProgram} onValueChange={handleProgramChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a program" />
                  </SelectTrigger>
                  <SelectContent>
                    {programs.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({formatCents(p.total_budget_cents - p.spent_cents, p.currency)} left)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedProgramData && (
                <div className="flex flex-col gap-1.5">
                  <Label>Amount ({selectedProgramData.currency})</Label>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-muted-foreground">
                    Budget remaining: {formatCents(remaining, selectedProgramData.currency)}
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label>Recipient Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="participant@email.com"
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={() => mutation.mutate()}
                  disabled={!selectedProgram || !amount || parseFloat(amount) <= 0 || mutation.isPending}
                  className="flex-1"
                >
                  {mutation.isPending ? <Loader2 className="h-4 w-4 me-2 animate-spin" /> : <Gift className="h-4 w-4 me-2" />}
                  Send
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
