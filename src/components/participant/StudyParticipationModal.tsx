import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { CheckCircle2, ChevronRight, ChevronLeft, Loader2, X, Clock, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface Participation {
  id: string;
  study_id: string;
  status: string;
  study_listings: {
    id: string;
    title: string;
    study_type: string;
    estimated_minutes: number;
    reward_amount_cents: number;
    description: string | null;
  } | null;
}

interface StudyParticipationModalProps {
  participation: Participation;
  onClose: () => void;
  onComplete: () => void;
}

// Simulated study questions based on study type
function getStudyQuestions(studyType: string, title: string) {
  const base = [
    {
      id: "q1",
      type: "textarea" as const,
      question: `What is your overall experience or opinion regarding the topic: "${title}"?`,
      required: true,
    },
    {
      id: "q2",
      type: "radio" as const,
      question: "How satisfied are you with the current options available in this space?",
      options: ["Very Unsatisfied", "Unsatisfied", "Neutral", "Satisfied", "Very Satisfied"],
      required: true,
    },
    {
      id: "q3",
      type: "textarea" as const,
      question: "What improvements or changes would you like to see?",
      required: false,
    },
    {
      id: "q4",
      type: "radio" as const,
      question: "How likely are you to recommend a product/service in this category to others?",
      options: ["Not at all likely", "Unlikely", "Neutral", "Likely", "Very likely"],
      required: true,
    },
    {
      id: "q5",
      type: "textarea" as const,
      question: "Is there anything else you'd like to share with the research team?",
      required: false,
    },
  ];

  if (studyType === "twin_calibration") {
    return [
      {
        id: "c1",
        type: "radio" as const,
        question: "When making purchase decisions, what matters most to you?",
        options: ["Price", "Quality", "Brand reputation", "Recommendations from friends", "Environmental impact"],
        required: true,
      },
      {
        id: "c2",
        type: "textarea" as const,
        question: "Describe your typical decision-making process when buying something new.",
        required: true,
      },
      {
        id: "c3",
        type: "radio" as const,
        question: "How do you typically research products before buying?",
        options: ["Read reviews online", "Ask friends/family", "Visit stores", "Watch videos", "Trust my instincts"],
        required: true,
      },
    ];
  }

  return base;
}

export function StudyParticipationModal({ participation, onClose, onComplete }: StudyParticipationModalProps) {
  const study = participation.study_listings;
  if (!study) return null;

  const questions = getStudyQuestions(study.study_type, study.title);
  const [step, setStep] = useState(0); // 0 = intro, 1..n = questions, n+1 = success
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  const totalSteps = questions.length;
  const currentQ = step > 0 && step <= totalSteps ? questions[step - 1] : null;
  const isIntro = step === 0;
  const isDone = step > totalSteps;
  const progress = isDone ? 100 : Math.round((step / (totalSteps + 1)) * 100);

  const canProceed = () => {
    if (isIntro) return true;
    if (isDone) return true;
    if (!currentQ) return true;
    if (!currentQ.required) return true;
    return !!answers[currentQ.id]?.trim();
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("study-participate", {
        body: {
          action: "submit",
          study_id: study.id,
          participation_id: participation.id,
          submission_payload: {
            version: 1,
            study_type: study.study_type,
            questions: questions.map((question) => ({
              id: question.id,
              type: question.type,
              question: question.question,
              required: question.required,
            })),
            responses: answers,
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      setStep(totalSteps + 1);
    },
    onError: (err) => {
      toast({ title: "Submission Failed", description: err.message, variant: "destructive" });
    },
  });

  const handleNext = () => {
    if (step === totalSteps && !isDone) {
      submitMutation.mutate();
    } else {
      setStep(s => s + 1);
    }
  };

  return (
    <Dialog open onOpenChange={() => !submitMutation.isPending && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-base font-semibold line-clamp-1">
              {study.title}
            </span>
          </DialogTitle>
          <DialogDescription className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {study.estimated_minutes} min
            </span>
            <span className="flex items-center gap-1">
              <DollarSign className="h-3 w-3 text-emerald-500" />
              Earn ${(study.reward_amount_cents / 100).toFixed(2)}
            </span>
          </DialogDescription>
        </DialogHeader>

        {/* Progress bar */}
        {!isIntro && !isDone && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Question {step} of {totalSteps}</span>
              <span>{progress}% complete</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        )}

        <div className="py-2 min-h-[200px]">
          {/* Intro screen */}
          {isIntro && (
            <div className="space-y-4 text-center py-4">
              <div className="h-16 w-16 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
                <span className="text-3xl">📋</span>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Ready to Begin?</h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  This study has {totalSteps} questions and should take about {study.estimated_minutes} minutes.
                  Answer honestly — there are no right or wrong answers. Your responses stay anonymous.
                </p>
              </div>
              <div className="flex flex-col gap-2 text-left max-w-xs mx-auto">
                {[
                  "Take your time with each question",
                  "Be honest — it leads to better research",
                  "You can go back to previous questions",
                ].map((tip, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    {tip}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Questions */}
          {currentQ && (
            <div className="space-y-4">
              <div>
                <p className="font-medium text-sm leading-relaxed">
                  {currentQ.required && <span className="text-destructive mr-1">*</span>}
                  {currentQ.question}
                </p>
                {!currentQ.required && (
                  <p className="text-xs text-muted-foreground mt-0.5">Optional</p>
                )}
              </div>

              {currentQ.type === "textarea" && (
                <Textarea
                  placeholder="Share your thoughts here..."
                  value={answers[currentQ.id] || ""}
                  onChange={e => setAnswers(a => ({ ...a, [currentQ.id]: e.target.value }))}
                  rows={5}
                  className="resize-none"
                />
              )}

              {currentQ.type === "radio" && currentQ.options && (
                <RadioGroup
                  value={answers[currentQ.id] || ""}
                  onValueChange={v => setAnswers(a => ({ ...a, [currentQ.id]: v }))}
                  className="space-y-2"
                >
                  {currentQ.options.map(opt => (
                    <div
                      key={opt}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all",
                        answers[currentQ.id] === opt
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      )}
                      onClick={() => setAnswers(a => ({ ...a, [currentQ.id]: opt }))}
                    >
                      <RadioGroupItem value={opt} id={`${currentQ.id}-${opt}`} />
                      <Label htmlFor={`${currentQ.id}-${opt}`} className="cursor-pointer text-sm flex-1">
                        {opt}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
            </div>
          )}

          {/* Success screen */}
          {isDone && (
            <div className="space-y-4 text-center py-4">
              <div className="h-20 w-20 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="font-bold text-xl">Study Submitted!</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Thank you for your participation. Your responses have been submitted successfully.
                </p>
              </div>
              <div className="rounded-xl bg-muted/50 border p-4 text-sm space-y-1">
                <p className="font-semibold">What happens next?</p>
                <p className="text-muted-foreground text-xs">
                  The researcher will review your responses within 5 business days.
                  Once approved, <strong>${(study.reward_amount_cents / 100).toFixed(2)}</strong> will
                  be added to your available balance automatically.
                </p>
              </div>
              <Button className="w-full" onClick={onComplete}>
                Done <CheckCircle2 className="h-4 w-4 ms-2" />
              </Button>
            </div>
          )}
        </div>

        {/* Navigation */}
        {!isDone && (
          <div className="flex items-center justify-between pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep(s => Math.max(0, s - 1))}
              disabled={isIntro}
            >
              <ChevronLeft className="h-4 w-4 me-1" /> Back
            </Button>
            <Button
              size="sm"
              onClick={handleNext}
              disabled={!canProceed() || submitMutation.isPending}
            >
              {submitMutation.isPending && <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />}
              {step === totalSteps ? "Submit Study" : isIntro ? "Start" : "Next"}
              {!submitMutation.isPending && step < totalSteps && <ChevronRight className="h-4 w-4 ms-1" />}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
