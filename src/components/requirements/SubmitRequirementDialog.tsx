import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

export function SubmitRequirementDialog({ open, onOpenChange, workspaceId, userId, onCreated }: Props) {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [businessContext, setBusinessContext] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState("medium");
  const [targetAudience, setTargetAudience] = useState("");
  const [targetMarket, setTargetMarket] = useState("");
  const [requestedDeadline, setRequestedDeadline] = useState("");
  const [tags, setTags] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!workspaceId || !userId) throw new Error("Missing workspace or user");
      const { error } = await supabase.from("requirements").insert({
        workspace_id: workspaceId,
        requested_by: userId,
        title,
        description: description || null,
        business_context: businessContext || null,
        category,
        priority,
        target_audience: targetAudience || null,
        target_market: targetMarket || null,
        requested_deadline: requestedDeadline || null,
        tags: tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Requirement submitted successfully");
      onCreated();
      handleClose();
    },
    onError: (err: any) => toast.error(err.message || "Failed to submit requirement"),
  });

  const handleClose = () => {
    setStep(1);
    setTitle(""); setDescription(""); setBusinessContext("");
    setCategory("general"); setPriority("medium");
    setTargetAudience(""); setTargetMarket("");
    setRequestedDeadline(""); setTags("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Submit Research Requirement</DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 mb-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Title *</Label>
              <Input
                placeholder="e.g. Understand Gen Z attitudes towards our new product line"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Description</Label>
              <Textarea
                placeholder="What do you need to learn and why?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Business Context</Label>
              <Textarea
                placeholder="What business decision does this research inform?"
                value={businessContext}
                onChange={(e) => setBusinessContext(e.target.value)}
                rows={2}
              />
            </div>
            <Button onClick={() => setStep(2)} disabled={!title.trim()}>
              Next
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["product","market","ux","brand","competitor","pricing","customer_experience","general"].map((c) => (
                      <SelectItem key={c} value={c}>{c.replace("_"," ").replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["critical","high","medium","low"].map((p) => (
                      <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Target Audience</Label>
              <Input
                placeholder="e.g. Millennials in Saudi Arabia"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Target Market</Label>
              <Input
                placeholder="e.g. GCC region, urban areas"
                value={targetMarket}
                onChange={(e) => setTargetMarket(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
              <Button onClick={() => setStep(3)} className="flex-1">Next</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Requested Deadline</Label>
              <Input
                type="date"
                value={requestedDeadline}
                onChange={(e) => setRequestedDeadline(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Tags</Label>
              <Input
                placeholder="e.g. q2-2026, product-launch, brand (comma-separated)"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </div>

            <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
              <p className="font-medium">{title}</p>
              <p className="text-muted-foreground text-xs">{category} · {priority} priority</p>
              {targetAudience && <p className="text-muted-foreground text-xs">Audience: {targetAudience}</p>}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Back</Button>
              <Button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
                className="flex-1"
              >
                {mutation.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                Submit
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
