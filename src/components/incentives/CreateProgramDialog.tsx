import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId?: string;
  userId?: string;
  onCreated: () => void;
}

const CURRENCIES = ["USD", "EUR", "GBP", "SAR", "AED", "EGP"];
const INCENTIVE_TYPES = ["gift_card", "cash", "points", "donation", "lottery", "physical", "custom"] as const;
const TYPE_LABELS: Record<string, string> = {
  gift_card: "Digital Gift Card",
  cash: "Cash Payment",
  points: "Points / Credits",
  donation: "Charitable Donation",
  lottery: "Lottery / Raffle",
  physical: "Physical Gift",
  custom: "Custom",
};

export function CreateProgramDialog({ open, onOpenChange, workspaceId, userId, onCreated }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [totalBudget, setTotalBudget] = useState("");
  const [defaultAmount, setDefaultAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [incentiveType, setIncentiveType] = useState<string>("gift_card");
  const [autoDisburse, setAutoDisburse] = useState(false);
  const [disburseOn, setDisburseOn] = useState("completion");
  const [provider, setProvider] = useState<string>("manual");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!workspaceId || !userId) throw new Error("Missing workspace or user");
      const totalCents = Math.round(parseFloat(totalBudget || "0") * 100);
      const defaultCents = Math.round(parseFloat(defaultAmount || "0") * 100);
      const { error } = await supabase.from("incentive_programs").insert({
        workspace_id: workspaceId,
        created_by: userId,
        name,
        description: description || null,
        total_budget_cents: totalCents,
        default_amount_cents: defaultCents,
        currency,
        incentive_type: incentiveType,
        auto_disburse: autoDisburse,
        disburse_on: disburseOn,
        provider: provider as any,
        status: "active",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Incentive program created");
      onCreated();
      handleClose();
    },
    onError: (err: any) => toast.error(err.message || "Failed to create program"),
  });

  const handleClose = () => {
    setName(""); setDescription(""); setTotalBudget(""); setDefaultAmount("");
    setCurrency("USD"); setIncentiveType("gift_card"); setAutoDisburse(false);
    setDisburseOn("completion"); setProvider("manual");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Incentive Program</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Program Name *</Label>
            <Input
              placeholder="e.g. Q2 User Research Incentives"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Description</Label>
            <Textarea
              placeholder="Optional description for this program"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Incentive Type</Label>
              <Select value={incentiveType} onValueChange={setIncentiveType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INCENTIVE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Total Budget ({currency})</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={totalBudget}
                onChange={(e) => setTotalBudget(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Default Per Participant ({currency})</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={defaultAmount}
                onChange={(e) => setDefaultAmount(e.target.value)}
              />
            </div>
          </div>

          {incentiveType !== "manual" && (
            <div className="flex flex-col gap-1.5">
              <Label>Provider</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="tremendous">Tremendous</SelectItem>
                  <SelectItem value="runa">Runa</SelectItem>
                  <SelectItem value="stripe_connect">Stripe Connect</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-3 p-3 border rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Auto-Disburse</p>
                <p className="text-xs text-muted-foreground">Automatically send incentives when participants complete sessions/surveys</p>
              </div>
              <Switch checked={autoDisburse} onCheckedChange={setAutoDisburse} />
            </div>
            {autoDisburse && (
              <div className="flex flex-col gap-1.5">
                <Label>Disburse On</Label>
                <Select value={disburseOn} onValueChange={setDisburseOn}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completion">Session/Survey Completion</SelectItem>
                    <SelectItem value="quality_check">After Quality Review</SelectItem>
                    <SelectItem value="manual">Manual Approval</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} className="flex-1">Cancel</Button>
            <Button
              onClick={() => mutation.mutate()}
              disabled={!name.trim() || mutation.isPending}
              className="flex-1"
            >
              {mutation.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
              Create Program
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
