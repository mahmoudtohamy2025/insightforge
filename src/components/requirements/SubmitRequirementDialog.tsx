import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getDecisionTemplate } from "@/lib/founderDecision";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId?: string;
  userId?: string;
  onCreated: () => void;
  templateId?: string | null;
}

export function SubmitRequirementDialog({
  open,
  onOpenChange,
  workspaceId,
  userId,
  onCreated,
  templateId,
}: Props) {
  const template = getDecisionTemplate(templateId);
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

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setTitle(template?.title || "");
    setDescription(template?.description || "");
    setBusinessContext(template?.hypothesis || "");
    setCategory(template?.category || "general");
    setPriority(template?.priority || "medium");
    setTargetAudience(template?.targetAudience || "");
    setTargetMarket(template?.targetMarket || "");
    setRequestedDeadline("");
    setTags(template?.tags.join(", ") || "");
  }, [open, template]);

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
        tags: tags ? tags.split(",").map((tag) => tag.trim()).filter(Boolean) : [],
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Decision added to backlog");
      onCreated();
      handleClose();
    },
    onError: (err: any) => toast.error(err.message || "Failed to create decision"),
  });

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : handleClose())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{template ? `Add ${template.title}` : "Add decision"}</DialogTitle>
        </DialogHeader>

        <div className="mb-4 flex gap-1">
          {[1, 2, 3].map((currentStep) => (
            <div
              key={currentStep}
              className={`h-1 flex-1 rounded-full transition-colors ${currentStep <= step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>

        {template && (
          <div className="mb-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm">
            <div className="font-medium">{template.description}</div>
            <div className="mt-1 text-muted-foreground">{template.hypothesis}</div>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Decision title *</Label>
              <Input
                placeholder="e.g. Should we lead with speed or credibility on the homepage?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>What are you trying to decide?</Label>
              <Textarea
                placeholder="Describe the risky decision in one or two sentences."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Hypothesis / business context</Label>
              <Textarea
                placeholder="Why does this matter right now, and what do you think will happen?"
                value={businessContext}
                onChange={(e) => setBusinessContext(e.target.value)}
                rows={3}
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
              <Label>Decision type</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["product", "market", "ux", "brand", "competitor", "pricing", "customer_experience", "general"].map((value) => (
                      <SelectItem key={value} value={value}>
                        {value.replace("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
              <Label>Risk level</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["critical", "high", "medium", "low"].map((value) => (
                      <SelectItem key={value} value={value}>
                        {value.charAt(0).toUpperCase() + value.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Target customer</Label>
              <Input
                placeholder="e.g. Early-stage SaaS founders hiring their first PM"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Target market</Label>
              <Input
                placeholder="e.g. US and Europe, product-led B2B SaaS"
                value={targetMarket}
                onChange={(e) => setTargetMarket(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                Back
              </Button>
              <Button onClick={() => setStep(3)} className="flex-1">
                Next
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Decision deadline</Label>
              <Input
                type="date"
                value={requestedDeadline}
                onChange={(e) => setRequestedDeadline(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Tags</Label>
              <Input
                placeholder="e.g. pricing, founder-os, q2-launch"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </div>

            <div className="rounded-2xl bg-muted/50 p-4 text-sm">
              <p className="font-medium">{title}</p>
                <p className="mt-1 text-muted-foreground">
                  {category.replace("_", " ")} · {priority} risk
                </p>
              {targetAudience && <p className="mt-2 text-muted-foreground">Target customer: {targetAudience}</p>}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                Back
              </Button>
              <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="flex-1">
                {mutation.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                Add to backlog
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
