import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  ShieldCheck,
  Sparkles,
  Tag,
  TrendingUp,
  TriangleAlert,
  Users2,
} from "lucide-react";
import {
  FOUNDER_DECISION_TEMPLATES,
  buildDecisionMemo,
  getConfidenceMeta,
} from "@/lib/founderDecision";

const DEMO_PERSONAS = [
  {
    key: "health-millennials",
    label: "Pricing",
    templateId: "pricing",
    description: "See whether founders buy a premium plan when the promise is better decision quality.",
  },
  {
    key: "gen-z-tech",
    label: "Messaging",
    templateId: "messaging",
    description: "Find which positioning creates trust fastest for first-time founder visitors.",
  },
  {
    key: "mena-professionals",
    label: "Onboarding",
    templateId: "onboarding",
    description: "Check which onboarding story gets a founder to first value before they bounce.",
  },
] as const;

const intentLabel: Record<string, string> = {
  definitely_yes: "Strong positive signal",
  probably_yes: "Positive signal",
  neutral: "Mixed signal",
  probably_no: "Caution signal",
  definitely_no: "Negative signal",
};

function getRiskLine(confidenceLevel: "high" | "medium" | "low", purchaseIntent?: string, sentiment?: number) {
  if (confidenceLevel === "high" && (purchaseIntent === "definitely_yes" || purchaseIntent === "probably_yes")) {
    return "The decision is directionally strong. Monitor real conversion after launch.";
  }

  if (confidenceLevel === "medium" || purchaseIntent === "neutral") {
    return "The signal is useful, but a cheap real-user validation loop should happen before rollout.";
  }

  if (typeof sentiment === "number" && sentiment < 0) {
    return "The current framing is creating skepticism. Do not ship without further validation.";
  }

  return "The evidence is still thin. Treat this as a hypothesis rather than a decision.";
}

export default function PublicDemo() {
  const [selectedPersona, setSelectedPersona] = useState<(typeof DEMO_PERSONAS)[number] | null>(DEMO_PERSONAS[1]);
  const [stimulus, setStimulus] = useState(FOUNDER_DECISION_TEMPLATES[1].starterPrompt);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  const selectedTemplate = useMemo(() => {
    const templateId = selectedPersona?.templateId ?? "messaging";
    return FOUNDER_DECISION_TEMPLATES.find((template) => template.id === templateId) ?? FOUNDER_DECISION_TEMPLATES[1];
  }, [selectedPersona]);

  const confidence = getConfidenceMeta(result?.confidence ?? 0.52);
  const riskLine = getRiskLine(confidence.level, result?.purchase_intent, result?.sentiment);
  const memo = buildDecisionMemo({
    title: selectedTemplate.title,
    confidenceScore: result?.confidence ?? 0.52,
    evidenceLabel: "Synthetic founder demo",
    summary: result?.response || "Run the demo to generate a decision summary.",
    risk: riskLine,
    nextAction: confidence.ctaLabel,
  });

  const runDemo = async () => {
    if (!selectedPersona || !stimulus.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await supabase.functions.invoke("public-demo-simulate", {
        body: {
          persona_key: selectedPersona.key,
          stimulus: stimulus.trim(),
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data.error) throw new Error(response.data.error);
      setResult(response.data);
      setRemaining(response.data.remaining_requests);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400 text-slate-950">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">InsightForge</div>
              <div className="text-xs text-muted-foreground">Founder Decision OS</div>
            </div>
          </Link>

          <Link to="/signup">
            <Button>
              Open founder workspace
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <section className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              Founder demo
            </div>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">
              Run one founder test and get a clear read in seconds.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
              This gives founders a fast first read on pricing, messaging, and onboarding decisions. Start with an AI test, then decide whether you should move forward or talk to real customers next.
            </p>
            <div className="mt-6 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> No signup required</span>
              <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-sky-600" /> Results in seconds</span>
              <span className="flex items-center gap-2"><Users2 className="h-4 w-4 text-purple-600" /> Designed for founders, not researchers</span>
            </div>
          </div>

          <div className="rounded-[28px] border border-border/70 bg-muted/20 p-6">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Simple flow</div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-2xl bg-emerald-500/8 px-4 py-3 text-emerald-700 dark:text-emerald-400">1. Run an AI test</div>
              <div className="rounded-2xl bg-amber-500/8 px-4 py-3 text-amber-700 dark:text-amber-400">2. Do a quick real-customer check if needed</div>
              <div className="rounded-2xl bg-rose-500/8 px-4 py-3 text-rose-700 dark:text-rose-400">3. Use participants when the decision is still risky</div>
            </div>
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[360px_1fr]">
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="text-base">Choose a decision to test</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {DEMO_PERSONAS.map((persona) => (
                <button
                  key={persona.key}
                  onClick={() => {
                    setSelectedPersona(persona);
                    const template = FOUNDER_DECISION_TEMPLATES.find((item) => item.id === persona.templateId);
                    if (template) setStimulus(template.starterPrompt);
                  }}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    selectedPersona?.key === persona.key
                      ? "border-emerald-500/40 bg-emerald-500/5"
                      : "border-border/70 hover:border-emerald-500/20 hover:bg-muted/25"
                  }`}
                >
                  <div className="text-sm font-semibold">{persona.label}</div>
                  <div className="mt-2 text-sm leading-6 text-muted-foreground">{persona.description}</div>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{selectedTemplate.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">What you believe</div>
                <p className="mt-2 text-sm leading-6 text-foreground/85">{selectedTemplate.hypothesis}</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">What do you want feedback on?</label>
                <Textarea
                  rows={5}
                  placeholder="Describe the pricing, messaging, or onboarding decision you want help with."
                  value={stimulus}
                  onChange={(e) => setStimulus(e.target.value)}
                  className="resize-none text-base leading-7"
                  maxLength={2000}
                />
              </div>

              <Button size="lg" className="w-full" onClick={runDemo} disabled={!selectedPersona || !stimulus.trim() || loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running founder test
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Run founder test
                  </>
                )}
              </Button>

              {remaining !== null && (
                <p className="text-center text-[11px] text-muted-foreground">
                  {remaining} demo runs remaining this hour
                </p>
              )}
            </CardContent>
          </Card>
        </section>

        {error && (
          <Card className="border-rose-500/30 bg-rose-500/5">
            <CardContent className="p-4 text-sm text-rose-700 dark:text-rose-400">
              {error}
            </CardContent>
          </Card>
        )}

        {result && (
          <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <Card className="border-border/70">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <CardTitle className="text-xl">{selectedTemplate.title} scorecard</CardTitle>
                  <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${confidence.badgeClassName}`}>
                    <ShieldCheck className="h-4 w-4" />
                    {confidence.label}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {result.generation_mode === "heuristic_fallback" && (
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
                    {result.notice || "This result is running in sample mode until a Gemini API key is configured."}
                  </div>
                )}
                <div className="rounded-[24px] border border-border/70 bg-muted/25 p-5 text-sm leading-7">
                  {result.response}
                </div>

                <div className="grid gap-4 sm:grid-cols-4">
                  <div className="rounded-2xl border border-border/70 p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <TrendingUp className="h-4 w-4 text-emerald-600" />
                      <span className="text-lg font-semibold">{typeof result.sentiment === "number" ? result.sentiment.toFixed(2) : "0.00"}</span>
                    </div>
                    <div className="mt-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Sentiment</div>
                  </div>
                  <div className="rounded-2xl border border-border/70 p-4 text-center">
                    <div className="text-lg font-semibold">{Math.round((result.confidence || 0) * 100)}%</div>
                    <div className="mt-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Confidence</div>
                  </div>
                  <div className="rounded-2xl border border-border/70 p-4 text-center">
                    <div className="text-sm font-semibold">{intentLabel[result.purchase_intent] || "Directional signal"}</div>
                    <div className="mt-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Likely reaction</div>
                  </div>
                  <div className="rounded-2xl border border-border/70 p-4 text-center">
                    <div className="text-sm font-semibold">{result.duration_ms ? `${(result.duration_ms / 1000).toFixed(1)}s` : "Fast"}</div>
                    <div className="mt-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Turnaround</div>
                  </div>
                </div>

                {result.key_themes?.length > 0 && (
                  <div>
                    <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      <Tag className="h-3.5 w-3.5" />
                      Main takeaways
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {result.key_themes.map((theme: string, index: number) => (
                        <Badge key={`${theme}-${index}`} variant="outline">
                          {theme}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className={`border ${confidence.railClassName}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Confidence level</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    {confidence.level === "low" ? (
                      <TriangleAlert className="mt-0.5 h-5 w-5" />
                    ) : (
                      <CheckCircle2 className="mt-0.5 h-5 w-5" />
                    )}
                    <div>{confidence.summary}</div>
                  </div>
                  <div className="rounded-2xl bg-background/70 p-3">
                    Next step: <strong>{confidence.ctaLabel}</strong>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/70">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Quick summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Recommendation</div>
                    <p className="mt-2">{memo.recommendation}</p>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Evidence</div>
                    <p className="mt-2">{memo.evidence}</p>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Risk</div>
                    <p className="mt-2">{memo.risk}</p>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Next action</div>
                    <p className="mt-2">{memo.nextAction}</p>
                  </div>
                </CardContent>
              </Card>

              <Link to="/signup">
                <Button size="lg" className="w-full">
                  Open the full founder workspace
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
