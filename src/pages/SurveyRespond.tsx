import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SurveyQuestionInput } from "@/components/surveys/SurveyQuestionInput";
import { CheckCircle2, AlertCircle, FileQuestion } from "lucide-react";

interface Logic {
  show_if?: { question_id: string; equals: string };
}

interface Question {
  id: string;
  question_text: string;
  question_type: string;
  options: string[] | null;
  sort_order: number;
  required: boolean;
  logic?: Logic | null;
}

interface Branding {
  logo_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  workspace_name: string | null;
}

interface SurveyData {
  survey: { id: string; title: string; description: string | null };
  questions: Question[];
  branding: Branding | null;
}
type PageState = "loading" | "form" | "submitted" | "already_submitted" | "not_found" | "closed" | "error";

const SurveyRespond = () => {
  const { surveyId } = useParams<{ surveyId: string }>();
  const [state, setState] = useState<PageState>("loading");
  const [data, setData] = useState<SurveyData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!surveyId) { setState("not_found"); return; }

    if (localStorage.getItem(`submitted-${surveyId}`)) {
      setState("already_submitted");
      return;
    }

    const fetchSurvey = async () => {
      try {
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const resp = await fetch(
          `https://${projectId}.supabase.co/functions/v1/submit-survey-response?survey_id=${surveyId}`,
          {
            method: "GET",
            headers: {
              "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
            },
          }
        );

        if (resp.status === 404) { setState("not_found"); return; }
        if (resp.status === 403) { setState("closed"); return; }
        if (!resp.ok) { setState("error"); return; }

        const json = await resp.json();
        setData(json);
        setState("form");
      } catch {
        setState("error");
      }
    };

    fetchSurvey();
  }, [surveyId]);

  // Helper to replace {{Q1}}, {{Q2}} etc with actual answers
  const processPiping = (text: string) => {
    if (!data || !text) return text;
    return text.replace(/\{\{\s*Q(\d+)\s*\}\}/gi, (match, numStr) => {
      const index = parseInt(numStr, 10) - 1;
      const q = data.questions[index];
      if (!q) return match;
      
      const answer = answers[q.id];
      if (!answer) return "___";
      
      try {
        const parsed = JSON.parse(answer);
        if (Array.isArray(parsed)) return parsed.join(", ");
        if (typeof parsed === "object") {
          return Object.entries(parsed).map(([k,v]) => `${k}: ${v}`).join(", ");
        }
      } catch {
        return answer;
      }
      return answer;
    });
  };

  // Compute visible questions based on display logic
  const visibleQuestions = useMemo(() => {
    if (!data) return [];
    return data.questions.filter((q) => {
      const logic = q.logic as Logic | null | undefined;
      if (!logic?.show_if) return true;
      const { question_id, equals } = logic.show_if;
      const answer = answers[question_id] || "";
      // For multi_select, check if the selected options include the target value
      try {
        const parsed = JSON.parse(answer);
        if (Array.isArray(parsed)) return parsed.includes(equals);
      } catch { /* not JSON */ }
      return answer === equals;
    });
  }, [data, answers]);

  const handleSubmit = async () => {
    if (!data || !surveyId) return;

    const visibleIds = new Set(visibleQuestions.map((q) => q.id));
    const errors = new Set<string>();
    visibleQuestions.forEach((q) => {
      if (q.required && (!answers[q.id] || answers[q.id].trim() === "")) {
        errors.add(q.id);
      }
    });

    if (errors.size > 0) {
      setValidationErrors(errors);
      return;
    }

    // Only send answers for visible questions
    const filteredAnswers: Record<string, string> = {};
    visibleQuestions.forEach((q) => {
      if (answers[q.id]) filteredAnswers[q.id] = answers[q.id];
    });

    setSubmitting(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const resp = await fetch(
        `https://${projectId}.supabase.co/functions/v1/submit-survey-response`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
          },
          body: JSON.stringify({ survey_id: surveyId, answers: filteredAnswers }),
        }
      );

      if (!resp.ok) {
        setState("error");
        return;
      }

      localStorage.setItem(`submitted-${surveyId}`, "true");
      setState("submitted");
    } catch {
      setState("error");
    } finally {
      setSubmitting(false);
    }
  };

  const updateAnswer = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setValidationErrors((prev) => {
      const next = new Set(prev);
      next.delete(questionId);
      return next;
    });
  };

  // ── State screens ──
  if (state === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-2xl space-y-4">
          <Skeleton className="h-10 w-64 mx-auto" />
          <Skeleton className="h-5 w-96 mx-auto" />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (state === "not_found") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <FileQuestion className="h-16 w-16 mx-auto text-muted-foreground" />
          <h1 className="text-2xl font-bold text-foreground">Survey Not Found</h1>
          <p className="text-muted-foreground">This survey doesn't exist or the link is incorrect.</p>
        </div>
      </div>
    );
  }

  if (state === "closed") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <AlertCircle className="h-16 w-16 mx-auto text-muted-foreground" />
          <h1 className="text-2xl font-bold text-foreground">Survey Closed</h1>
          <p className="text-muted-foreground">This survey is no longer accepting responses.</p>
        </div>
      </div>
    );
  }

  if (state === "already_submitted") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <CheckCircle2 className="h-16 w-16 mx-auto text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Already Submitted</h1>
          <p className="text-muted-foreground">You have already submitted your response to this survey.</p>
        </div>
      </div>
    );
  }

  if (state === "submitted") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <CheckCircle2 className="h-16 w-16 mx-auto text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Thank You!</h1>
          <p className="text-muted-foreground">Your response has been recorded successfully.</p>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <AlertCircle className="h-16 w-16 mx-auto text-destructive" />
          <h1 className="text-2xl font-bold text-foreground">Something Went Wrong</h1>
          <p className="text-muted-foreground">Please try again later.</p>
        </div>
      </div>
    );
  }

  // ── Form state ──
  if (!data) return null;
  const answeredCount = visibleQuestions.filter((q) => answers[q.id] && answers[q.id].trim() !== "").length;
  const progress = visibleQuestions.length > 0 ? (answeredCount / visibleQuestions.length) * 100 : 0;
  const brand = data.branding;
  const primaryColor = brand?.primary_color || undefined;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card" style={primaryColor ? { borderBottomColor: primaryColor } : undefined}>
        <div className="max-w-2xl mx-auto px-4 py-6 text-center">
          {brand?.logo_url && (
            <img
              src={brand.logo_url}
              alt={brand.workspace_name || "Logo"}
              className="mx-auto mb-4 max-h-[60px] max-w-[200px] object-contain"
            />
          )}
          <h1 className="text-2xl font-bold text-foreground">{data.survey.title}</h1>
          {data.survey.description && (
            <p className="text-muted-foreground mt-2">{data.survey.description}</p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="sticky top-0 z-10 bg-card border-b">
        <div className="max-w-2xl mx-auto px-4">
          <div className="h-1 rounded-full bg-muted my-2">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%`, backgroundColor: primaryColor || "hsl(var(--primary))" }}
            />
          </div>
          <p className="text-xs text-muted-foreground pb-2">
            {answeredCount} / {visibleQuestions.length} answered
          </p>
        </div>
      </div>

      {/* Questions */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {visibleQuestions.map((q, i) => (
          <Card
            key={q.id}
            className={validationErrors.has(q.id) ? "border-destructive" : ""}
          >
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-start gap-2">
                <span className="text-sm font-medium text-muted-foreground shrink-0">
                  {i + 1}.
                </span>
                <div className="flex-1">
                  <p className="font-medium text-foreground">
                    {processPiping(q.question_text)}
                    {q.required && <span className="text-destructive ms-1">*</span>}
                  </p>
                </div>
              </div>
              <SurveyQuestionInput
                questionId={q.id}
                questionType={q.question_type}
                options={q.options}
                value={answers[q.id] || ""}
                onChange={(v) => updateAnswer(q.id, v)}
              />
              {validationErrors.has(q.id) && (
                <p className="text-xs text-destructive">This question is required</p>
              )}
            </CardContent>
          </Card>
        ))}

        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full"
          size="lg"
          style={primaryColor ? { backgroundColor: primaryColor, borderColor: primaryColor } : undefined}
        >
          {submitting ? "Submitting..." : "Submit"}
        </Button>

        <p className="text-center text-xs text-muted-foreground pb-6">
          Powered by <span className="font-semibold">{brand?.workspace_name || "InsightForge"}</span>
        </p>
      </div>
    </div>
  );
};

export default SurveyRespond;
