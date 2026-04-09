import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Sparkles,
  Loader2,
  Send,
  ThumbsUp,
  ThumbsDown,
  Minus,
  TrendingUp,
  Tag,
  Users2,
  Zap,
  ArrowRight,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Link } from "react-router-dom";

const PERSONAS = [
  {
    key: "health-millennials",
    name: "Health-Conscious Millennials",
    description: "25-34, urban USA, wellness-focused",
    emoji: "🥗",
    color: "from-emerald-500/20 to-green-500/20",
  },
  {
    key: "gen-z-tech",
    name: "Gen-Z Tech Enthusiasts",
    description: "18-24, global, digital-native",
    emoji: "📱",
    color: "from-blue-500/20 to-indigo-500/20",
  },
  {
    key: "mena-professionals",
    name: "MENA Working Professionals",
    description: "30-45, GCC, career-driven",
    emoji: "🏢",
    color: "from-amber-500/20 to-orange-500/20",
  },
];

const sentimentColor = (s: number) => {
  if (s > 0.2) return "text-emerald-500";
  if (s < -0.2) return "text-red-500";
  return "text-amber-500";
};

const sentimentIcon = (s: number) => {
  if (s > 0.2) return <ThumbsUp className="h-4 w-4 text-emerald-500" />;
  if (s < -0.2) return <ThumbsDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-amber-500" />;
};

const intentLabel: Record<string, string> = {
  definitely_yes: "Definitely Yes",
  probably_yes: "Probably Yes",
  neutral: "Neutral",
  probably_no: "Probably No",
  definitely_no: "Definitely No",
};

const emotionEmoji: Record<string, string> = {
  excited: "🤩", interested: "🤔", neutral: "😐",
  skeptical: "🧐", concerned: "😟", opposed: "😠",
};

const SAMPLE_PROMPTS = [
  "We're launching an organic energy drink priced at $3.99. How do you feel about it?",
  "Should we offer a monthly subscription box for curated skincare products at $29/month?",
  "Our app now requires Face ID to log in. What's your honest reaction?",
];

export default function PublicDemo() {
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [stimulus, setStimulus] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  const runDemo = async () => {
    if (!selectedPersona || !stimulus.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await supabase.functions.invoke("public-demo-simulate", {
        body: {
          persona_key: selectedPersona,
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
      {/* Top bar */}
      <header className="border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center">
              IF
            </div>
            <span className="font-bold text-lg">InsightForge</span>
            <Badge variant="secondary" className="text-[9px] ml-1">DEMO</Badge>
          </Link>
          <Link to="/signup">
            <Button size="sm">
              Sign Up Free <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Try Digital Consumer Twins — <span className="text-primary">Live</span>
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Choose a pre-built consumer persona, ask any question, and see how an AI-simulated
            consumer responds — with sentiment, confidence, and purchase intent.
          </p>
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" /> No sign-up required</span>
            <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-amber-500" /> 3 free runs</span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-blue-500" /> Results in seconds</span>
          </div>
        </div>

        {/* Step 1: Select Persona */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">1</span>
            Choose a Consumer Persona
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {PERSONAS.map((p) => (
              <button
                key={p.key}
                onClick={() => setSelectedPersona(p.key)}
                className={`text-left p-4 rounded-xl border-2 transition-all ${
                  selectedPersona === p.key
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-border hover:border-primary/30 hover:bg-muted/30"
                }`}
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${p.color} flex items-center justify-center text-2xl mb-3`}>
                  {p.emoji}
                </div>
                <p className="font-semibold text-sm">{p.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Enter question */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">2</span>
            Ask a Question
          </h2>
          <Textarea
            rows={3}
            placeholder="Describe a product, campaign, or ask a direct consumer question..."
            value={stimulus}
            onChange={(e) => setStimulus(e.target.value)}
            className="resize-none"
            maxLength={2000}
          />
          {/* Sample prompts */}
          <div className="flex flex-wrap gap-2">
            <span className="text-[10px] text-muted-foreground">Try:</span>
            {SAMPLE_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                onClick={() => setStimulus(prompt)}
                className="text-[10px] px-2 py-1 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
              >
                {prompt.slice(0, 50)}...
              </button>
            ))}
          </div>

          <Button
            size="lg"
            className="w-full"
            onClick={runDemo}
            disabled={!selectedPersona || !stimulus.trim() || loading}
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Simulating consumer response...</>
            ) : (
              <><Send className="h-4 w-4 mr-2" /> Run Simulation</>
            )}
          </Button>

          {remaining !== null && (
            <p className="text-[10px] text-center text-muted-foreground">
              {remaining} demo runs remaining this hour
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="p-4">
              <p className="text-sm text-red-500">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {result && (
          <Card className="border-primary/30 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                {result.persona}'s Response
                <Badge variant="secondary" className="text-[9px] ml-auto">DEMO</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 text-sm leading-relaxed border-l-2 border-purple-500">
                {result.response}
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-card border rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    {sentimentIcon(result.sentiment)}
                    <span className={`text-lg font-bold ${sentimentColor(result.sentiment)}`}>
                      {result.sentiment > 0 ? "+" : ""}{result.sentiment?.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground uppercase">Sentiment</p>
                </div>

                <div className="bg-card border rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1.5 mb-1">
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                    <span className="text-lg font-bold text-blue-500">
                      {Math.round(result.confidence * 100)}%
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground uppercase">Confidence</p>
                </div>

                <div className="bg-card border rounded-lg p-3 text-center">
                  <div className="text-lg mb-1">{emotionEmoji[result.emotional_reaction] || "😐"}</div>
                  <p className="text-[10px] text-muted-foreground uppercase capitalize">{result.emotional_reaction}</p>
                </div>

                <div className="bg-card border rounded-lg p-3 text-center">
                  <Badge className="text-[10px] mb-1">{intentLabel[result.purchase_intent] || result.purchase_intent}</Badge>
                  <p className="text-[10px] text-muted-foreground uppercase">Intent</p>
                </div>
              </div>

              {/* Key themes */}
              {result.key_themes?.length > 0 && (
                <div>
                  <p className="text-xs font-medium flex items-center gap-1.5 mb-2">
                    <Tag className="h-3 w-3" /> Key Decision Factors
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.key_themes.map((theme: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs">{theme}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Duration */}
              <div className="text-[10px] text-muted-foreground pt-2 border-t">
                Generated in {(result.duration_ms / 1000).toFixed(1)}s • This is a demo — sign up for unlimited simulations with custom personas.
              </div>
            </CardContent>
          </Card>
        )}

        {/* CTA */}
        <div className="text-center py-8 space-y-4">
          <h3 className="text-xl font-bold">Want More?</h3>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            Sign up to create custom personas with 25+ data points, run focus group simulations,
            A/B tests, market predictions, and export branded PDF reports.
          </p>
          <Link to="/signup">
            <Button size="lg" className="px-8">
              <Users2 className="h-4 w-4 mr-2" />
              Start Free — No Credit Card
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
