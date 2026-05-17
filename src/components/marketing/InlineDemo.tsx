import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { FOUNDER_DECISION_TEMPLATES, getConfidenceMeta } from "@/lib/founderDecision";

const MOCK_RESULTS = {
  pricing: {
    summary: "Founders like the outcome-based framing, but they need proof that the product reduces bad decisions before they accept a premium plan.",
    confidence: 0.72,
    recommendation: "Test the premium plan, but back it with visible trust signals and a lower-risk starter tier.",
    risk: "Premium pricing without proof can trigger skepticism about AI certainty.",
  },
  messaging: {
    summary: "Founder Decision OS lands faster than Hybrid AI-Human Insights Platform because it speaks to urgency, not tooling.",
    confidence: 0.81,
    recommendation: "Lead with decision-speed language and keep cost savings as supporting proof.",
    risk: "If trust signals are too hidden, the message can sound like empty positioning.",
  },
  onboarding: {
    summary: "A founder-specific first-run path feels more relevant, but new users still want a quick proof point before they commit setup time.",
    confidence: 0.63,
    recommendation: "Guide founders into one testable decision in under five minutes before asking for broader workspace setup.",
    risk: "Too much setup before the first insight will hurt activation.",
  },
} as const;

export function InlineDemo() {
  const [selectedTemplateId, setSelectedTemplateId] = useState("messaging");
  const [step, setStep] = useState(1);
  const [isRunning, setIsRunning] = useState(false);
  const [query, setQuery] = useState(FOUNDER_DECISION_TEMPLATES[1].starterPrompt);

  const selectedTemplate = useMemo(
    () => FOUNDER_DECISION_TEMPLATES.find((template) => template.id === selectedTemplateId) ?? FOUNDER_DECISION_TEMPLATES[0],
    [selectedTemplateId]
  );

  const result = MOCK_RESULTS[selectedTemplateId as keyof typeof MOCK_RESULTS];
  const confidence = getConfidenceMeta(result.confidence);

  const handleSelectTemplate = (templateId: string) => {
    const template = FOUNDER_DECISION_TEMPLATES.find((item) => item.id === templateId);
    if (!template) return;
    setSelectedTemplateId(templateId);
    setQuery(template.starterPrompt);
    setStep(2);
  };

  const handleRun = () => {
    setIsRunning(true);
    setTimeout(() => {
      setIsRunning(false);
      setStep(3);
    }, 1800);
  };

  return (
    <div className="mx-auto w-full max-w-4xl overflow-hidden rounded-[30px] border border-border/70 bg-background shadow-[0_38px_120px_-56px_rgba(15,23,42,0.55)]">
      <div className="flex items-center justify-between border-b border-border/70 bg-muted/30 px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-rose-400/80" />
          <div className="h-3 w-3 rounded-full bg-amber-400/80" />
          <div className="h-3 w-3 rounded-full bg-emerald-400/80" />
        </div>
        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          Founder Decision Demo
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[280px_1fr]">
        <aside className="border-b border-border/70 bg-slate-950 px-5 py-6 text-slate-100 lg:border-b-0 lg:border-r">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300/80">
            Decision templates
          </div>
          <div className="mt-5 space-y-3">
            {FOUNDER_DECISION_TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => handleSelectTemplate(template.id)}
                className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                  template.id === selectedTemplateId
                    ? "border-emerald-300/40 bg-white/10"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.08]"
                }`}
              >
                <div className="text-sm font-medium text-white">{template.title}</div>
                <div className="mt-2 text-xs leading-5 text-slate-300/72">{template.description}</div>
              </button>
            ))}
          </div>
        </aside>

        <div className="p-6 sm:p-8">
          {step !== 3 && (
            <div className="mb-6 flex items-center gap-3 text-sm text-muted-foreground">
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-700 dark:text-emerald-400">
                {selectedTemplate.title}
              </span>
              <span>{selectedTemplate.targetAudience}</span>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <Sparkles className="h-8 w-8 text-emerald-600" />
              <h3 className="text-3xl font-semibold tracking-tight">Pick a founder decision to test.</h3>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                Start with pricing, messaging, or onboarding. This lightweight demo mirrors the same decision flow the product now uses throughout the founder workspace.
              </p>
              <Button onClick={() => setStep(2)}>
                Start with messaging
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Founder hypothesis
                </div>
                <h3 className="mt-2 text-3xl font-semibold tracking-tight">{selectedTemplate.hypothesis}</h3>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Decision prompt</label>
                <Textarea
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  rows={5}
                  className="resize-none text-base leading-7"
                />
              </div>

              <div className="rounded-2xl border border-border/70 bg-muted/25 p-4 text-sm text-muted-foreground">
                The live product will turn this into an AI test first, then suggest a real-customer check only if confidence stays medium or low.
              </div>

              <Button
                size="lg"
                className="h-12 rounded-full px-6"
                onClick={handleRun}
                disabled={!query.trim() || isRunning}
              >
                {isRunning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running decision test
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Run founder test
                  </>
                )}
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    Decision scorecard
                  </div>
                  <h3 className="mt-2 text-3xl font-semibold tracking-tight">{selectedTemplate.title}</h3>
                </div>
                <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${confidence.badgeClassName}`}>
                  <ShieldCheck className="h-4 w-4" />
                  {confidence.label}
                </div>
              </div>

              <div className="rounded-[28px] border border-border/70 bg-muted/20 p-6">
                <div className="text-sm leading-7 text-foreground/90">{result.summary}</div>
                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Recommendation</div>
                    <div className="mt-2 text-sm font-medium">{result.recommendation}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Risk</div>
                    <div className="mt-2 text-sm">{result.risk}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Next move</div>
                    <div className="mt-2 text-sm">{confidence.ctaLabel}</div>
                  </div>
                </div>
              </div>

              <div className={`rounded-2xl border p-4 ${confidence.railClassName}`}>
                <div className="flex items-start gap-3">
                  {confidence.level === "low" ? (
                    <TriangleAlert className="mt-0.5 h-5 w-5" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-5 w-5" />
                  )}
                  <div>
                    <div className="text-sm font-medium">{confidence.label}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{confidence.summary}</div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button size="lg" className="rounded-full" onClick={() => setStep(2)}>
                  Test another founder bet
                </Button>
                <Button size="lg" variant="outline" className="rounded-full" onClick={() => (window.location.href = "/signup")}>
                  Open the full founder workspace
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
