import { useI18n } from "@/lib/i18n";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Brain,
  Cpu,
  ShieldCheck,
  Info,
  AlertTriangle,
  TrendingUp,
  Users2,
  Sparkles,
  ArrowRight,
  FlaskConical,
  BarChart3,
  RefreshCw,
  Scale,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const aiModels = [
  { feature: "AI Test", model: "Gemini 2.5 Flash", version: "2025-04", purpose: "Customer response generation" },
  { feature: "Panel Discussion", model: "Gemini 2.5 Flash", version: "2025-04", purpose: "Multi-round discussion synthesis" },
  { feature: "Compare Options", model: "Gemini 2.5 Flash", version: "2025-04", purpose: "Option preference scoring" },
  { feature: "Market Forecast", model: "Bass Diffusion + Gemini", version: "—", purpose: "Adoption curve modeling" },
  { feature: "Policy Check", model: "Gemini 2.5 Flash", version: "2025-04", purpose: "Public impact modeling" },
  { feature: "Theme Extraction", model: "Gemini 2.5 Flash", version: "2025-04", purpose: "Transcript analysis" },
  { feature: "Survey Builder", model: "Gemini 2.5 Flash", version: "2025-04", purpose: "Question creation" },
];

const pipelineSteps = [
  {
    step: 1,
    title: "Create AI Profiles",
    description: "Describe the customer types you want to learn from, including who they are, what they care about, and how they behave.",
    icon: Users2,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
  {
    step: 2,
    title: "Ground the Profile",
    description: "Before the AI responds, the profile is grounded in details like location, education, income, and context so the answer is not generic.",
    icon: Brain,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    step: 3,
    title: "Run the Test",
    description: "The model responds from that profile's point of view and returns an answer, a sentiment score, a confidence score, and key themes.",
    icon: Zap,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  {
    step: 4,
    title: "Check Against Real Data",
    description: "Upload survey or interview results to compare AI output with real customer feedback and improve future accuracy.",
    icon: RefreshCw,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
];

export default function Methodology() {
  const { t } = useI18n();

  return (
    <div className="space-y-10 animate-in fade-in duration-500 max-w-5xl mx-auto py-6">

      {/* ═══ Header ═══ */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <BookOpen className="h-8 w-8 text-primary" />
          How InsightForge Works
        </h1>
        <p className="text-muted-foreground mt-2 max-w-3xl">
          See how InsightForge turns a risky decision into a useful signal, how confidence is scored, and when the product recommends an AI test versus a real-customer check.
        </p>
      </div>

      {/* ═══ Section 1: How Digital Twins Work ═══ */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          How AI Profiles Work
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          InsightForge creates AI-powered customer profiles, sometimes called "twins," to estimate how real people may react to products, messages, and policies. Each profile is grounded in the customer details you define, not a generic model response.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {pipelineSteps.map(step => (
            <Card key={step.step} className="relative overflow-hidden">
              <div className={`absolute top-0 left-0 w-1 h-full ${step.bg.replace("/10", "")}`} />
              <CardContent className="pt-6 space-y-3">
                <div className={`w-10 h-10 rounded-xl ${step.bg} flex items-center justify-center`}>
                  <step.icon className={`h-5 w-5 ${step.color}`} />
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">Step {step.step}</Badge>
                  <span className="font-semibold text-sm">{step.title}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ═══ Section 2: AI Models Used ═══ */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Cpu className="h-6 w-6 text-primary" />
          AI Models Used
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          Different product areas use different models. Each one is grounded in the profile context before it generates a result.
        </p>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Feature</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Purpose</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aiModels.map((m, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{m.feature}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-xs">{m.model}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{m.version}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{m.purpose}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      {/* ═══ Section 3: Confidence Intervals ═══ */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          Confidence Scores
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          Every AI test includes a confidence score on a 0 to 1 scale. The score estimates how reliable the result is based on three things.
        </p>

        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <div className="bg-card rounded-lg border p-4 font-mono text-sm text-center mb-6">
              confidence = 0.4 × calibration_score + 0.3 × data_density + 0.3 × demographic_anchoring
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2 p-4 bg-card rounded-lg border">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="font-semibold text-sm">≥ 0.80 — High Confidence</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  The profile has good grounding and enough real-world support. The result is strong enough to act on.
                </p>
              </div>
              <div className="space-y-2 p-4 bg-card rounded-lg border">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="font-semibold text-sm">≥ 0.60 — Medium Confidence</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  The result looks directionally useful, but you should still do a quick real-customer check.
                </p>
              </div>
              <div className="space-y-2 p-4 bg-card rounded-lg border">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="font-semibold text-sm">&lt; 0.60 — Low Confidence</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  There is not enough supporting data yet. Treat the result as an early signal, not a final answer.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ═══ Section 4: Bass Diffusion Model ═══ */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          Bass Diffusion Model (Market Forecasts)
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          Market forecasts use the <strong>Bass Diffusion Model</strong> (Frank Bass, 1969) to predict
          product adoption over time. This is the same model used by Fortune 500 companies for
          market forecasting.
        </p>
        <Card className="bg-muted/30">
          <CardContent className="pt-6 space-y-4">
            <div className="bg-card rounded-lg border p-4 font-mono text-sm text-center">
              F(t) = 1 − e<sup>−(p+q)t</sup> / (1 + (q/p) × e<sup>−(p+q)t</sup>)
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="p-3 bg-card rounded-lg border">
                <span className="font-mono font-bold text-primary">p</span> = Innovation coefficient
                <p className="text-xs text-muted-foreground mt-1">
                  Rate of adoption by innovators (typically 0.01–0.03)
                </p>
              </div>
              <div className="p-3 bg-card rounded-lg border">
                <span className="font-mono font-bold text-primary">q</span> = Imitation coefficient
                <p className="text-xs text-muted-foreground mt-1">
                  Rate of adoption through word-of-mouth (typically 0.3–0.5)
                </p>
              </div>
              <div className="p-3 bg-card rounded-lg border">
                <span className="font-mono font-bold text-primary">m</span> = Market potential
                <p className="text-xs text-muted-foreground mt-1">
                  Total addressable market size based on segment demographics
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ═══ Section 5: Calibration Loop ═══ */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <RefreshCw className="h-6 w-6 text-primary" />
          How accuracy improves over time
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          InsightForge gets better when you compare AI output with real customer data. Each new survey or interview result helps the system score what matched, what missed, and how much trust to place in future results.
        </p>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8 justify-center py-4">
              {[
                { label: "Run AI Test", icon: Zap, color: "text-purple-500" },
                { label: "Collect Real Data", icon: FlaskConical, color: "text-blue-500" },
                { label: "Upload & Compare", icon: Scale, color: "text-amber-500" },
                { label: "Update Accuracy", icon: RefreshCw, color: "text-emerald-500" },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex flex-col items-center gap-2">
                    <div className={`w-12 h-12 rounded-xl bg-muted flex items-center justify-center`}>
                      <step.icon className={`h-6 w-6 ${step.color}`} />
                    </div>
                    <span className="text-xs font-medium text-center">{step.label}</span>
                  </div>
                  {i < 3 && (
                    <ArrowRight className="h-4 w-4 text-muted-foreground hidden md:block" />
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center mt-4">
              Every compare-and-learn cycle makes future confidence scores more useful.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* ═══ Section 6: Limitations & Ethics ═══ */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-amber-500" />
          Limitations & Ethics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-amber-500/20">
            <CardHeader>
              <CardTitle className="text-base">What to keep in mind</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                <p><strong>AI can still be wrong:</strong> Models may give convincing but incorrect answers, especially for niche audiences with little supporting data.</p>
              </div>
              <div className="flex gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                <p><strong>Local context matters:</strong> Region-specific nuances may be missed unless you calibrate with local customer data.</p>
              </div>
              <div className="flex gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                <p><strong>Thin data means lower trust:</strong> Profiles with very little real-world data should be treated as exploratory, not predictive.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-500/20">
            <CardHeader>
              <CardTitle className="text-base">What we commit to</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex gap-2">
                <span className="text-emerald-500 mt-0.5">✓</span>
                <p><strong>Transparency:</strong> Confidence scores come from auditable formulas, not hidden logic.</p>
              </div>
              <div className="flex gap-2">
                <span className="text-emerald-500 mt-0.5">✓</span>
                <p><strong>Clear labeling:</strong> AI-generated content is always marked clearly and never presented as real human feedback.</p>
              </div>
              <div className="flex gap-2">
                <span className="text-emerald-500 mt-0.5">✓</span>
                <p><strong>Your data stays yours:</strong> Calibration data stays inside your workspace and is not used to train other customers' profiles.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA */}
      <Card className="bg-gradient-to-br from-primary/5 to-purple-500/5 border-primary/20">
        <CardContent className="py-8 text-center space-y-3">
          <h3 className="text-xl font-bold">Ready to compare AI with real customers?</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Upload survey or interview results and see how trustworthy each AI profile really is.
          </p>
          <Link to="/validation">
            <Button>
              Go to real-world accuracy <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
