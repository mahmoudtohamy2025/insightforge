import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Megaphone } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
}

const STUDY_TYPES = [
  { value: "survey", label: "Survey" },
  { value: "focus_group", label: "Focus Group" },
  { value: "interview", label: "Interview" },
  { value: "usability_test", label: "Usability Test" },
  { value: "twin_calibration", label: "AI Twin Calibration" },
];

export function CreateStudyDialog({ open, onOpenChange, workspaceId }: Props) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [studyType, setStudyType] = useState("survey");
  const [estimatedMinutes, setEstimatedMinutes] = useState("15");
  const [rewardDollars, setRewardDollars] = useState("5.00");
  const [maxParticipants, setMaxParticipants] = useState("50");

  const createMutation = useMutation({
    mutationFn: async () => {
      const rewardCents = Math.round(parseFloat(rewardDollars) * 100);
      const { data, error } = await supabase.functions.invoke("study-listing", {
        body: {
          workspace_id: workspaceId,
          title,
          description,
          study_type: studyType,
          estimated_minutes: parseInt(estimatedMinutes),
          reward_amount_cents: rewardCents,
          max_participants: parseInt(maxParticipants),
          status: "active",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study-listings"] });
      toast({ title: "Study Published! 🎉", description: "Participants can now see and accept your study." });
      resetForm();
      onOpenChange(false);
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setStudyType("survey");
    setEstimatedMinutes("15");
    setRewardDollars("5.00");
    setMaxParticipants("50");
  };

  const hourlyRate = () => {
    const mins = parseInt(estimatedMinutes);
    const dollars = parseFloat(rewardDollars);
    if (!mins || !dollars || mins <= 0) return "N/A";
    return `$${(dollars * (60 / mins)).toFixed(2)}/hr`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Post a Study
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Checkout Flow Feedback" />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Briefly describe what participants will do..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Study Type</Label>
              <Select value={studyType} onValueChange={setStudyType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STUDY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Duration (min)</Label>
              <Input type="number" value={estimatedMinutes} onChange={(e) => setEstimatedMinutes(e.target.value)} min={1} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Reward ($)</Label>
              <Input type="number" value={rewardDollars} onChange={(e) => setRewardDollars(e.target.value)} min={0.5} step={0.5} />
            </div>
            <div className="space-y-2">
              <Label>Max Participants</Label>
              <Input type="number" value={maxParticipants} onChange={(e) => setMaxParticipants(e.target.value)} min={1} />
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            Effective rate: <span className="font-medium text-foreground">{hourlyRate()}</span>
            {" · "}
            Total budget: <span className="font-medium text-foreground">
              ${(parseFloat(rewardDollars || "0") * parseInt(maxParticipants || "0")).toFixed(2)}
            </span>
          </div>

          <Button
            className="w-full"
            onClick={() => createMutation.mutate()}
            disabled={!title || createMutation.isPending}
          >
            {createMutation.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
            Publish Study
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
