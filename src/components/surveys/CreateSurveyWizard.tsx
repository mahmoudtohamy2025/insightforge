import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, RefreshCw, Loader2, Pencil, Trash2, ChevronUp, ChevronDown, Plus, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface GeneratedQuestion {
  question: string;
  type: "scale" | "multiple_choice" | "multi_select" | "matrix" | "open_ended" | "nps" | "yes_no";
  options?: string[] | { rows: string[]; columns: string[] };
  matrix_rows?: string[];
  matrix_columns?: string[];
}

interface CreateSurveyWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLaunch: (data: { title: string; description: string; targetResponses: number; questions: GeneratedQuestion[] }) => void;
  isCreating: boolean;
}

const questionTypeBadge: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  scale: { label: "Scale 1-5", variant: "secondary" },
  multiple_choice: { label: "Multiple Choice", variant: "default" },
  multi_select: { label: "Multi-Select", variant: "default" },
  matrix: { label: "Matrix / Grid", variant: "default" },
  open_ended: { label: "Open Ended", variant: "outline" },
  nps: { label: "NPS 0-10", variant: "secondary" },
  yes_no: { label: "Yes / No", variant: "outline" },
};

const QUESTION_TYPES: GeneratedQuestion["type"][] = ["scale", "multiple_choice", "multi_select", "matrix", "open_ended", "nps", "yes_no"];

const needsOptions = (type: string) => type === "multiple_choice" || type === "multi_select";
const needsMatrix = (type: string) => type === "matrix";

export function CreateSurveyWizard({ open, onOpenChange, onLaunch, isCreating }: CreateSurveyWizardProps) {
  const { t } = useI18n();
  const [step, setStep] = useState(1);
  const [objective, setObjective] = useState("");
  const [targetResponses, setTargetResponses] = useState(500);
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<GeneratedQuestion | null>(null);

  const steps = [
    t("surveys.wizard.step1"),
    t("surveys.wizard.step2"),
    t("surveys.wizard.step4"), // 3-step: Objective → Questions → Review
  ];

  const handleOpenChange = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      setStep(1);
      setObjective("");
      setTargetResponses(500);
      setGeneratedQuestions([]);
      setEditingIndex(null);
      setEditDraft(null);
    }
  };

  const generateQuestions = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-survey-questions", {
        body: { objective },
      });

      if (error) throw new Error(error.message || "Generation failed");
      if (data?.error) throw new Error(data.error);

      if (data?.questions?.length) {
        // Map matrix rows/cols from Gemini back to options object
        const mappedQuestions = data.questions.map((q: GeneratedQuestion) => {
          if (q.type === "matrix" && (q.matrix_rows || q.matrix_columns)) {
            return {
              ...q,
              options: { rows: q.matrix_rows || [], columns: q.matrix_columns || [] }
            };
          }
          return q;
        });
        setGeneratedQuestions(mappedQuestions);
        setEditingIndex(null);
        setEditDraft(null);
        setStep(2);
      } else {
        throw new Error("No questions returned");
      }
    } catch (err: any) {
      toast({
        title: t("surveys.wizard.generateError"),
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLaunch = () => {
    onLaunch({
      title: objective.slice(0, 100) || "Untitled Survey",
      description: objective,
      targetResponses,
      questions: generatedQuestions,
    });
  };

  const startEditing = (index: number) => {
    setEditingIndex(index);
    
    let clonedOptions = undefined;
    const currentOptions = generatedQuestions[index].options;
    if (currentOptions) {
      if (Array.isArray(currentOptions)) {
        clonedOptions = [...currentOptions];
      } else {
        clonedOptions = { 
          rows: [...(currentOptions.rows || [])], 
          columns: [...(currentOptions.columns || [])] 
        };
      }
    }
    
    setEditDraft({ 
      ...generatedQuestions[index], 
      options: clonedOptions 
    });
  };

  const cancelEditing = () => {
    setEditingIndex(null);
    setEditDraft(null);
  };

  const saveEditing = () => {
    if (editingIndex === null || !editDraft || !editDraft.question.trim()) return;
    const updated = [...generatedQuestions];
    updated[editingIndex] = { ...editDraft };
    if (!needsOptions(editDraft.type) && !needsMatrix(editDraft.type)) {
      delete updated[editingIndex].options;
      delete updated[editingIndex].matrix_rows;
      delete updated[editingIndex].matrix_columns;
    } else if (needsMatrix(editDraft.type)) {
      updated[editingIndex].options = {
        rows: editDraft.matrix_rows || [],
        columns: editDraft.matrix_columns || []
      };
    }
    setGeneratedQuestions(updated);
    setEditingIndex(null);
    setEditDraft(null);
  };

  const deleteQuestion = (index: number) => {
    setGeneratedQuestions((prev) => prev.filter((_, i) => i !== index));
    if (editingIndex === index) cancelEditing();
    else if (editingIndex !== null && editingIndex > index) setEditingIndex(editingIndex - 1);
  };

  const moveQuestion = (index: number, direction: "up" | "down") => {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= generatedQuestions.length) return;
    const updated = [...generatedQuestions];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    setGeneratedQuestions(updated);
    if (editingIndex === index) setEditingIndex(target);
    else if (editingIndex === target) setEditingIndex(index);
  };

  const addQuestion = () => {
    const newQ: GeneratedQuestion = { question: "", type: "open_ended" };
    setGeneratedQuestions((prev) => [...prev, newQ]);
    setEditingIndex(generatedQuestions.length);
    setEditDraft({ ...newQ });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("surveys.create")}</DialogTitle>
        </DialogHeader>
        {/* Step Indicator */}
        <div className="flex gap-2 mb-4">
          {steps.map((s, i) => (
            <div key={i} className="flex-1">
              <div className={`h-1.5 rounded-full ${i + 1 <= step ? "bg-primary" : "bg-muted"}`} />
              <p className={`text-[10px] mt-1 ${i + 1 === step ? "text-primary font-medium" : "text-muted-foreground"}`}>{s}</p>
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <Label>{t("surveys.wizard.objective")}</Label>
            <Textarea
              placeholder={t("surveys.wizard.objectivePlaceholder")}
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              className="min-h-[120px]"
            />
            <Button onClick={generateQuestions} className="w-full" disabled={!objective.trim() || isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 me-2 animate-spin" />
                  {t("surveys.wizard.generating")}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 me-2" />
                  {t("surveys.wizard.generateQuestions")}
                </>
              )}
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {generatedQuestions.map((q, i) => (
              <Card key={i} className="p-3">
                {editingIndex === i && editDraft ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground">Q{i + 1}</span>
                      <Input
                        value={editDraft.question}
                        onChange={(e) => setEditDraft({ ...editDraft, question: e.target.value })}
                        placeholder="Enter question text..."
                        className="flex-1"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === "Enter") saveEditing(); if (e.key === "Escape") cancelEditing(); }}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Select value={editDraft.type} onValueChange={(v) => setEditDraft({ ...editDraft, type: v as GeneratedQuestion["type"] })}>
                        <SelectTrigger className="w-44 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {QUESTION_TYPES.map((qt) => (
                            <SelectItem key={qt} value={qt}>{questionTypeBadge[qt]?.label || qt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="ghost" onClick={saveEditing} className="h-8 w-8 p-0"><Check className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={cancelEditing} className="h-8 w-8 p-0"><X className="h-4 w-4" /></Button>
                    </div>
                    {needsOptions(editDraft.type) && (
                      <Input
                        value={Array.isArray(editDraft.options) ? editDraft.options.join(", ") : ""}
                        onChange={(e) => setEditDraft({ ...editDraft, options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                        placeholder="Option 1, Option 2, Option 3..."
                        className="text-xs"
                      />
                    )}
                    {needsMatrix(editDraft.type) && (
                      <div className="space-y-2 pt-1">
                        <Input
                          value={(editDraft.matrix_rows || (editDraft.options as any)?.rows || []).join(", ")}
                          onChange={(e) => setEditDraft({ ...editDraft, matrix_rows: e.target.value.split(",").map((s) => s.trim()) })}
                          placeholder="Rows (comma separated)"
                          className="text-xs"
                        />
                        <Input
                          value={(editDraft.matrix_columns || (editDraft.options as any)?.columns || []).join(", ")}
                          onChange={(e) => setEditDraft({ ...editDraft, matrix_columns: e.target.value.split(",").map((s) => s.trim()) })}
                          placeholder="Columns / Scale (comma separated)"
                          className="text-xs"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-mono text-muted-foreground mt-0.5">Q{i + 1}</span>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm">{q.question}</p>
                      <Badge variant={questionTypeBadge[q.type]?.variant || "outline"} className="text-[10px]">
                        {questionTypeBadge[q.type]?.label || q.type}
                      </Badge>
                      {q.options && Array.isArray(q.options) && q.options.length > 0 ? (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {q.options.map((opt, j) => (
                            <span key={j} className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{opt as string}</span>
                          ))}
                        </div>
                      ) : null}
                      {q.type === "matrix" && q.options && !Array.isArray(q.options) && (
                        <div className="flex gap-4 mt-2">
                          <div className="text-xs text-muted-foreground">
                            <strong>Rows:</strong> {(q.options as any).rows?.join(", ")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            <strong>Cols:</strong> {(q.options as any).columns?.join(", ")}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {i > 0 && (
                        <Button size="sm" variant="ghost" onClick={() => moveQuestion(i, "up")} className="h-7 w-7 p-0"><ChevronUp className="h-3.5 w-3.5" /></Button>
                      )}
                      {i < generatedQuestions.length - 1 && (
                        <Button size="sm" variant="ghost" onClick={() => moveQuestion(i, "down")} className="h-7 w-7 p-0"><ChevronDown className="h-3.5 w-3.5" /></Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => startEditing(i)} className="h-7 w-7 p-0"><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteQuestion(i)} className="h-7 w-7 p-0 text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                )}
              </Card>
            ))}
            <Button variant="outline" size="sm" onClick={addQuestion} className="w-full">
              <Plus className="h-4 w-4 me-1" /> {t("surveys.detail.addQuestion")}
            </Button>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => setStep(1)}>{t("common.back")}</Button>
              <Button variant="outline" onClick={generateQuestions} disabled={isGenerating}>
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 me-1" />}
                {t("surveys.wizard.regenerate")}
              </Button>
              <Button className="flex-1" onClick={() => setStep(3)} disabled={generatedQuestions.length === 0}>{t("common.next")}</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>{t("surveys.wizard.sampleSize")}</Label>
                <Input
                  placeholder="500"
                  type="number"
                  value={targetResponses}
                  onChange={(e) => setTargetResponses(Number(e.target.value) || 0)}
                />
              </div>
            </div>
            <Card className="p-4">
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <span className="text-muted-foreground">{t("surveys.detail.questions")}:</span><span className="font-medium">{generatedQuestions.length}</span>
                <span className="text-muted-foreground">{t("surveys.wizard.sampleSize")}:</span><span className="font-medium">{targetResponses}</span>
                <span className="text-muted-foreground">{t("surveys.wizard.estimatedTime")}:</span><span className="font-medium">3-5 days</span>
                <span className="text-muted-foreground">{t("integrations.status")}:</span><Badge>Ready to Launch</Badge>
              </div>
            </Card>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>{t("common.back")}</Button>
              <Button className="flex-1" onClick={handleLaunch} disabled={isCreating}>
                {isCreating ? "Creating..." : `${t("surveys.wizard.launch")} 🚀`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
