import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert, Json } from "@/integrations/supabase/types";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  Plus,
  Check,
  X,
  Info,
  Eye,
} from "lucide-react";

const typeLabels: Record<string, string> = {
  scale: "Scale",
  multiple_choice: "Multiple Choice",
  multi_select: "Multi-Select",
  open_ended: "Open Ended",
  nps: "NPS",
  ranking: "Ranking",
  text: "Short Text",
  yes_no: "Yes / No",
  matrix: "Matrix / Grid",
};

const QUESTION_TYPES = ["scale", "multiple_choice", "multi_select", "matrix", "open_ended", "nps", "ranking", "text", "yes_no"];

interface QuestionLogic {
  show_if?: { question_id: string; equals: string };
}

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  options: unknown;
  sort_order: number;
  required: boolean;
  survey_id: string;
  workspace_id: string;
  logic?: QuestionLogic | unknown;
}

interface QuestionEditorProps {
  questions: Question[];
  surveyId: string;
  workspaceId: string;
  isDraft: boolean;
}

const needsOptions = (type: string) => type === "multiple_choice" || type === "multi_select";
const needsMatrix = (type: string) => type === "matrix";

interface DraftState {
  question_text: string;
  question_type: string;
  options: string[];
  matrix_rows: string[];
  matrix_cols: string[];
  logic: QuestionLogic | null;
}

export function QuestionEditor({ questions, surveyId, workspaceId, isDraft }: QuestionEditorProps) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<DraftState | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newDraft, setNewDraft] = useState<DraftState>({ question_text: "", question_type: "open_ended", options: [], matrix_rows: [], matrix_cols: [], logic: null });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["survey-questions", surveyId] });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const { error } = await supabase.from("survey_questions").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success(t("surveys.detail.questionSaved")); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("survey_questions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success(t("surveys.detail.questionDeleted")); },
  });

  const addMutation = useMutation({
    mutationFn: async (data: { question_text: string; question_type: string; options: string[] | null; sort_order: number; logic?: QuestionLogic | null }) => {
      const insertData: TablesInsert<"survey_questions"> = {
        survey_id: surveyId,
        workspace_id: workspaceId,
        question_text: data.question_text,
        question_type: data.question_type,
        options: data.options,
        sort_order: data.sort_order,
        required: true,
        logic: (data.logic || undefined) as unknown as Json,
      };
      const { error } = await supabase.from("survey_questions").insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success(t("surveys.detail.questionAdded")); setAddingNew(false); setNewDraft({ question_text: "", question_type: "open_ended", options: [], matrix_rows: [], matrix_cols: [], logic: null }); },
  });

  const reorderMutation = useMutation({
    mutationFn: async (updates: { id: string; sort_order: number }[]) => {
      for (const u of updates) {
        const { error } = await supabase.from("survey_questions").update({ sort_order: u.sort_order }).eq("id", u.id);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  const startEditing = (q: Question) => {
    setEditingId(q.id);
    let opts = [] as string[];
    let mRows = [] as string[];
    let mCols = [] as string[];
    
    if (q.question_type === "matrix" && q.options && typeof q.options === "object") {
      const typedOpt = q.options as { rows?: string[], columns?: string[] };
      mRows = typedOpt.rows || [];
      mCols = typedOpt.columns || [];
    } else if (q.options && Array.isArray(q.options)) {
      opts = q.options as string[];
    }
    
    setEditDraft({ 
      question_text: q.question_text, 
      question_type: q.question_type, 
      options: [...opts], 
      matrix_rows: [...mRows],
      matrix_cols: [...mCols],
      logic: (q.logic as QuestionLogic) || null 
    });
  };

  const constructOptionsPayload = (draft: DraftState) => {
    if (needsOptions(draft.question_type)) return draft.options.filter(Boolean);
    if (needsMatrix(draft.question_type)) return { 
      rows: draft.matrix_rows.filter(Boolean), 
      columns: draft.matrix_cols.filter(Boolean) 
    };
    return null;
  };

  const saveEdit = (id: string) => {
    if (!editDraft || !editDraft.question_text.trim()) return;
    const opts = constructOptionsPayload(editDraft);
    updateMutation.mutate({ id, data: { question_text: editDraft.question_text, question_type: editDraft.question_type, options: opts, logic: editDraft.logic || null } });
    setEditingId(null);
    setEditDraft(null);
  };

  const cancelEdit = () => { setEditingId(null); setEditDraft(null); };

  const moveQuestion = (index: number, direction: "up" | "down") => {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= questions.length) return;
    reorderMutation.mutate([
      { id: questions[index].id, sort_order: questions[target].sort_order },
      { id: questions[target].id, sort_order: questions[index].sort_order },
    ]);
  };

  const handleAddNew = () => {
    if (!newDraft.question_text.trim()) return;
    const opts = constructOptionsPayload(newDraft);
    addMutation.mutate({ question_text: newDraft.question_text, question_type: newDraft.question_type, options: opts as any, sort_order: questions.length, logic: newDraft.logic });
  };

  // Get questions that can be referenced for display logic (only choice-based questions before the current one)
  const getLogicCandidates = (currentIndex: number) => {
    return questions.slice(0, currentIndex).filter((q) =>
      ["multiple_choice", "multi_select", "yes_no", "scale", "nps"].includes(q.question_type)
    );
  };

  const getOptionsForQuestion = (qId: string): string[] => {
    const q = questions.find((x) => x.id === qId);
    if (!q) return [];
    if (q.question_type === "yes_no") return ["yes", "no"];
    if (q.question_type === "scale") return ["1", "2", "3", "4", "5"];
    if (q.question_type === "nps") return Array.from({ length: 11 }, (_, i) => String(i));
    if (q.options && Array.isArray(q.options)) return q.options as string[];
    return [];
  };

  const renderLogicEditor = (
    draft: { logic: QuestionLogic | null },
    setLogic: (l: QuestionLogic | null) => void,
    currentIndex: number,
  ) => {
    const candidates = getLogicCandidates(currentIndex);
    if (candidates.length === 0) return null;

    const logic = draft.logic;
    const selectedQId = logic?.show_if?.question_id || "";
    const selectedValue = logic?.show_if?.equals || "";
    const valueOptions = selectedQId ? getOptionsForQuestion(selectedQId) : [];

    return (
      <div className="flex items-center gap-2 flex-wrap pt-1">
        <Eye className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs text-muted-foreground">{t("surveys.detail.showOnlyIf")}</span>
        <Select
          value={selectedQId || "__none__"}
          onValueChange={(v) => {
            if (v === "__none__") { setLogic(null); return; }
            setLogic({ show_if: { question_id: v, equals: "" } });
          }}
        >
          <SelectTrigger className="w-40 h-7 text-xs">
            <SelectValue placeholder="Always show" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Always show</SelectItem>
            {candidates.map((c, ci) => (
              <SelectItem key={c.id} value={c.id}>Q{ci + 1}: {c.question_text.slice(0, 30)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedQId && valueOptions.length > 0 && (
          <>
            <span className="text-xs text-muted-foreground">=</span>
            <Select value={selectedValue} onValueChange={(v) => setLogic({ show_if: { question_id: selectedQId, equals: v } })}>
              <SelectTrigger className="w-32 h-7 text-xs">
                <SelectValue placeholder="Select value" />
              </SelectTrigger>
              <SelectContent>
                {valueOptions.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </div>
    );
  };

  const renderEditForm = (
    draft: DraftState,
    setDraft: (d: DraftState) => void,
    onSave: () => void,
    onCancel: () => void,
    label: string,
    currentIndex: number,
  ) => (
    <div className="space-y-2 p-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-muted-foreground">{label}</span>
        <Input
          value={draft.question_text}
          onChange={(e) => setDraft({ ...draft, question_text: e.target.value })}
          placeholder="Enter question text..."
          className="flex-1"
          autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") onSave(); if (e.key === "Escape") onCancel(); }}
        />
      </div>
      <div className="flex items-center gap-2">
        <Select value={draft.question_type} onValueChange={(v) => setDraft({ ...draft, question_type: v })}>
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {QUESTION_TYPES.map((qt) => (
              <SelectItem key={qt} value={qt}>{typeLabels[qt] ?? qt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="ghost" onClick={onSave} className="h-8 w-8 p-0"><Check className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" onClick={onCancel} className="h-8 w-8 p-0"><X className="h-4 w-4" /></Button>
      </div>
      {needsOptions(draft.question_type) && (
        <Input
          value={draft.options.join(", ")}
          onChange={(e) => setDraft({ ...draft, options: e.target.value.split(",").map((s) => s.trim()) })}
          placeholder="Option 1, Option 2, Option 3... (comma separated)"
          className="text-xs"
        />
      )}
      {needsMatrix(draft.question_type) && (
        <div className="space-y-2 pt-2">
          <div>
            <span className="text-xs text-muted-foreground ml-1">Rows (comma separated)</span>
            <Input
              value={draft.matrix_rows.join(", ")}
              onChange={(e) => setDraft({ ...draft, matrix_rows: e.target.value.split(",").map((s) => s.trim()) })}
              placeholder="Price, Quality, Support..."
              className="text-xs mt-1"
            />
          </div>
          <div>
            <span className="text-xs text-muted-foreground ml-1">Columns / Scale (comma separated)</span>
            <Input
              value={draft.matrix_cols.join(", ")}
              onChange={(e) => setDraft({ ...draft, matrix_cols: e.target.value.split(",").map((s) => s.trim()) })}
              placeholder="Poor, Fair, Good, Excellent..."
              className="text-xs mt-1"
            />
          </div>
        </div>
      )}
      {renderLogicEditor(draft, (l) => setDraft({ ...draft, logic: l }), currentIndex)}
    </div>
  );

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">{t("surveys.detail.questions")}</h2>

      {!isDraft && (
        <Alert className="mb-3">
          <Info className="h-4 w-4" />
          <AlertDescription>{t("surveys.detail.questionsReadOnly")}</AlertDescription>
        </Alert>
      )}

      {questions.length === 0 && !addingNew ? (
        <p className="text-sm text-muted-foreground">{t("surveys.detail.noQuestions")}</p>
      ) : (
        <div className="space-y-3">
          {questions.map((q, i) => (
            <Card key={q.id}>
              {editingId === q.id && editDraft ? (
                renderEditForm(editDraft, (d) => setEditDraft(d), () => saveEdit(q.id), cancelEdit, `Q${i + 1}`, i)
              ) : (
                <>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-sm font-medium">
                        {i + 1}. {q.question_text}
                      </CardTitle>
                      <div className="flex items-center gap-1 shrink-0 ms-2">
                        <Badge variant="secondary" className="text-[11px]">
                          {typeLabels[q.question_type] ?? q.question_type}
                        </Badge>
                        {isDraft && (
                          <>
                            {i > 0 && (
                              <Button size="sm" variant="ghost" onClick={() => moveQuestion(i, "up")} className="h-7 w-7 p-0">
                                <ChevronUp className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {i < questions.length - 1 && (
                              <Button size="sm" variant="ghost" onClick={() => moveQuestion(i, "down")} className="h-7 w-7 p-0">
                                <ChevronDown className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => startEditing(q)} className="h-7 w-7 p-0">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{t("surveys.detail.confirmDeleteTitle")}</AlertDialogTitle>
                                  <AlertDialogDescription>{t("surveys.detail.confirmDeleteDesc")}</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteMutation.mutate(q.id)}>
                                    {t("common.delete")}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {q.options && Array.isArray(q.options) && (q.options as string[]).length > 0 && (
                      <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                        {(q.options as string[]).map((opt, j) => (
                          <li key={j}>{opt}</li>
                        ))}
                      </ul>
                    )}
                    {q.question_type === "matrix" && q.options && typeof q.options === "object" && (
                      <div className="text-sm text-muted-foreground mt-2 bg-muted/30 p-2 rounded-md border border-border/50">
                        <div className="flex gap-4">
                          <div className="flex-1">
                            <strong className="text-xs uppercase tracking-wider text-foreground">Rows:</strong>
                            <ul className="list-disc list-inside mt-1 space-y-0.5">
                              {((q.options as any).rows || []).map((r: string, j: number) => <li key={`r-${j}`}>{r}</li>)}
                            </ul>
                          </div>
                          <div className="flex-1">
                            <strong className="text-xs uppercase tracking-wider text-foreground">Columns:</strong>
                            <ul className="list-disc list-inside mt-1 space-y-0.5">
                              {((q.options as any).columns || []).map((c: string, j: number) => <li key={`c-${j}`}>{c}</li>)}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                    {(q.logic as QuestionLogic)?.show_if && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                        <Eye className="h-3 w-3" />
                        <span>
                          {t("surveys.detail.showOnlyIf")} Q{questions.findIndex((x) => x.id === (q.logic as QuestionLogic).show_if!.question_id) + 1} = "{(q.logic as QuestionLogic).show_if!.equals}"
                        </span>
                      </div>
                    )}
                  </CardContent>
                </>
              )}
            </Card>
          ))}
        </div>
      )}

      {isDraft && (
        <div className="mt-3">
          {addingNew ? (
            <Card>
              {renderEditForm(
                newDraft,
                (d) => setNewDraft(d),
                handleAddNew,
                () => { setAddingNew(false); setNewDraft({ question_text: "", question_type: "open_ended", options: [], matrix_rows: [], matrix_cols: [], logic: null }); },
                `Q${questions.length + 1}`,
                questions.length,
              )}
            </Card>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setAddingNew(true)} className="w-full">
              <Plus className="h-4 w-4 me-1" />
              {t("surveys.detail.addQuestion")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
