import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sparkles,
  Loader2,
  PlayCircle,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";

// Variant identifier for analytics — matches Landing.tsx so events from
// the teams landing arm can be filtered cleanly in PostHog.
const VARIANT = "teams" as const;

// Persona key matches one of the three pre-built personas in the
// `public-demo-simulate` edge function (health-millennials | gen-z-tech | mena-professionals).
// We use mena-professionals to match the "Sarah from Dubai" framing the demo opens with.
const DEMO_PERSONA_KEY = "mena-professionals" as const;

// Shape returned by the `public-demo-simulate` edge function on success.
type DemoResult = {
  persona: string;
  response: string;
  sentiment: number;       // -1.0 to 1.0
  confidence: number;       // 0.0 to 1.0
  key_themes: string[];
  purchase_intent:
    | "definitely_yes"
    | "probably_yes"
    | "neutral"
    | "probably_no"
    | "definitely_no";
  emotional_reaction:
    | "excited"
    | "interested"
    | "neutral"
    | "skeptical"
    | "concerned"
    | "opposed";
  duration_ms: number;
  demo: true;
  remaining_requests: number;
};

const PURCHASE_INTENT_DISPLAY: Record<
  DemoResult["purchase_intent"],
  { label: string; color: string }
> = {
  definitely_yes: { label: "Would definitely buy", color: "text-emerald-500" },
  probably_yes: { label: "Probably would buy", color: "text-emerald-500" },
  neutral: { label: "On the fence", color: "text-amber-500" },
  probably_no: { label: "Probably wouldn't buy", color: "text-orange-500" },
  definitely_no: { label: "Wouldn't buy", color: "text-red-500" },
};

const EMOTIONAL_REACTION_EMOJI: Record<DemoResult["emotional_reaction"], string> = {
  excited: "🤩",
  interested: "🙂",
  neutral: "😐",
  skeptical: "🤔",
  concerned: "😟",
  opposed: "😠",
};

function sentimentLabel(sentiment: number): { text: string; color: string } {
  if (sentiment >= 0.4) return { text: "Strongly positive", color: "text-emerald-500" };
  if (sentiment >= 0.1) return { text: "Mildly positive", color: "text-emerald-400" };
  if (sentiment > -0.1) return { text: "Neutral", color: "text-muted-foreground" };
  if (sentiment > -0.4) return { text: "Mildly negative", color: "text-orange-500" };
  return { text: "Strongly negative", color: "text-red-500" };
}

async function fireConfetti() {
  const emojis = ["🚀", "🎉", "✨", "🌟", "💡"];
  const container = document.body;
  const count = 40;
  for (let i = 0; i < count; i++) {
    const el = document.createElement("span");
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    el.style.cssText = `
      position:fixed;
      top:-2rem;
      left:${Math.random() * 100}vw;
      font-size:${1.2 + Math.random() * 1}rem;
      pointer-events:none;
      z-index:9999;
      animation: inlineConfettiFall ${1.5 + Math.random() * 1.5}s ease-in forwards;
      animation-delay: ${Math.random() * 0.8}s;
    `;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }
  if (!document.getElementById("inline-confetti-style")) {
    const style = document.createElement("style");
    style.id = "inline-confetti-style";
    style.textContent = `@keyframes inlineConfettiFall { to { transform: translateY(110vh) rotate(720deg); opacity:0; } }`;
    document.head.appendChild(style);
  }
}

export function InlineDemo() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState(
    "Would you use a subscription service for specialized coffee delivered monthly?"
  );
  const [result, setResult] = useState<DemoResult | null>(null);
  const [error, setError] = useState<{ message: string; isRateLimit: boolean } | null>(null);

  const advanceToStep = (next: number) => {
    setStep(next);
    trackEvent("demo_step", { step: next, variant: VARIANT });
  };

  // P0.5 — Real edge function call. Replaces the 2-second hardcoded mock.
  // P0.6 — Analytics events fire on click, on completion, on error, on rate-limit.
  const handleRunSimulation = async () => {
    setLoading(true);
    setError(null);
    const startedAt = Date.now();
    trackEvent("demo_run_clicked", {
      variant: VARIANT,
      stimulus_length: query.length,
      persona_key: DEMO_PERSONA_KEY,
    });

    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        "public-demo-simulate",
        {
          body: { persona_key: DEMO_PERSONA_KEY, stimulus: query },
        }
      );

      // Supabase invocation-layer error (network, function 5xx, etc.)
      if (invokeError) {
        throw invokeError;
      }

      // 429 rate-limit (function returns { error, retry_after_seconds } with 429 status,
      // which Supabase surfaces as data when CORS lets it through).
      if (data?.error) {
        const isRateLimit = !!data?.retry_after_seconds;
        setError({
          message: isRateLimit
            ? "You've used your 3 free demo runs this hour. Sign up free to keep going — no credit card."
            : data.error,
          isRateLimit,
        });
        trackEvent(isRateLimit ? "demo_rate_limited" : "demo_error", {
          variant: VARIANT,
          reason: data.error,
        });
        setLoading(false);
        return;
      }

      setResult(data as DemoResult);
      setStep(3);
      setLoading(false);
      trackEvent("demo_completed", {
        variant: VARIANT,
        took_ms: Date.now() - startedAt,
        sentiment: data.sentiment,
        confidence: data.confidence,
        purchase_intent: data.purchase_intent,
        emotional_reaction: data.emotional_reaction,
        themes_count: Array.isArray(data.key_themes) ? data.key_themes.length : 0,
      });
      await fireConfetti();
    } catch (e: any) {
      setError({
        message:
          "The demo is temporarily unavailable. Sign up free to run real simulations — no credit card.",
        isRateLimit: false,
      });
      trackEvent("demo_error", {
        variant: VARIANT,
        reason: e?.message ?? "unknown",
      });
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-card border border-border shadow-2xl shadow-primary/5 rounded-2xl overflow-hidden flex flex-col transition-all duration-300 min-h-[400px]">
      {/* Header */}
      <div className="bg-muted/50 border-b border-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-red-500/80" />
          <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
          <div className="h-3 w-3 rounded-full bg-green-500/80" />
        </div>
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Interactive Demo · Real AI · No signup
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-6 relative flex flex-col justify-center">
        {step === 1 && (
          <div className="space-y-6 animate-fade-in text-center">
            <Sparkles className="h-10 w-10 text-primary mx-auto opacity-80" />
            <h3 className="text-2xl font-bold">Meet Sarah</h3>
            <div className="mx-auto bg-primary/10 border border-primary/20 rounded-xl p-4 max-w-xs text-left">
              <p className="text-sm font-semibold mb-1">👩🏽‍💼 Sarah M. (32, Dubai)</p>
              <p className="text-xs text-muted-foreground">
                Marketing Professional · GCC · upper-middle income · family-oriented · career-driven.
              </p>
            </div>
            <Button size="lg" className="px-8 mt-4" onClick={() => advanceToStep(2)}>
              Ask Sarah a Question <PlayCircle className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-fade-in">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-primary" />
              Run your first simulation
            </h3>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                What would you like to ask her?
              </label>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="text-base h-12"
                maxLength={2000}
              />
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center p-8 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-primary font-medium animate-pulse">
                  Running real AI simulation...
                </p>
                <p className="text-xs text-muted-foreground">
                  This is a real Gemini call. Typically takes 3–10 seconds.
                </p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center p-6 space-y-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                <AlertTriangle className="h-6 w-6 text-amber-500" />
                <p className="text-sm text-center text-foreground/90">{error.message}</p>
                <Button
                  size="lg"
                  className="w-full bg-gradient-to-r from-primary to-purple-600 hover:opacity-90"
                  onClick={() => {
                    trackEvent("demo_signup_clicked", {
                      variant: VARIANT,
                      from: error.isRateLimit ? "rate_limit" : "error",
                    });
                    window.location.href = "/signup";
                  }}
                >
                  Sign up free to keep going
                </Button>
              </div>
            ) : (
              <Button size="lg" className="w-full h-12 text-base" onClick={handleRunSimulation}>
                <Sparkles className="mr-2 h-4 w-4" />
                Simulate Response
              </Button>
            )}
          </div>
        )}

        {step === 3 && result && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-2 text-emerald-500 font-bold mb-4">
              <CheckCircle2 className="h-5 w-5" />
              Simulation Complete ({(result.duration_ms / 1000).toFixed(1)}s)
              <span className="text-xs font-normal text-muted-foreground ml-auto">
                Real Gemini response · not a script
              </span>
            </div>

            <div className="bg-muted border border-border rounded-xl p-5 relative">
              <div className="absolute -top-3 -left-3 text-3xl">👩🏽‍💼</div>
              <h4 className="font-semibold text-sm mb-2 pl-4">Sarah's response:</h4>
              <p className="text-sm leading-relaxed text-foreground/90 pl-4">
                "{result.response}"
              </p>

              <div className="mt-4 pt-4 border-t border-border/50 grid grid-cols-2 sm:grid-cols-4 gap-4 pl-4">
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                    Sentiment
                  </span>
                  <span className={`text-sm font-semibold ${sentimentLabel(result.sentiment).color}`}>
                    {sentimentLabel(result.sentiment).text}
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    {(result.sentiment >= 0 ? "+" : "") + result.sentiment.toFixed(2)}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                    Confidence
                  </span>
                  <span className="text-sm font-semibold">
                    {Math.round(result.confidence * 100)}%
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                    Purchase Intent
                  </span>
                  <span
                    className={`text-sm font-semibold ${PURCHASE_INTENT_DISPLAY[result.purchase_intent].color}`}
                  >
                    {PURCHASE_INTENT_DISPLAY[result.purchase_intent].label}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                    Reaction
                  </span>
                  <span className="text-2xl" title={result.emotional_reaction}>
                    {EMOTIONAL_REACTION_EMOJI[result.emotional_reaction]}
                  </span>
                </div>
              </div>

              {result.key_themes && result.key_themes.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border/50 pl-4">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                    Key themes
                  </span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {result.key_themes.slice(0, 5).map((theme) => (
                      <span
                        key={theme}
                        className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-xs text-primary"
                      >
                        {theme}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Button
              size="lg"
              variant="default"
              className="w-full bg-gradient-to-r from-primary to-purple-600 hover:opacity-90"
              onClick={() => {
                trackEvent("demo_signup_clicked", {
                  variant: VARIANT,
                  from: "completed_result",
                  remaining_requests: result.remaining_requests,
                });
                window.location.href = "/signup";
              }}
            >
              Try with 1,000 Personas — free
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              {result.remaining_requests > 0
                ? `${result.remaining_requests} more free demo runs this hour · No credit card required`
                : "That was your last free demo run this hour · Sign up to keep simulating"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
