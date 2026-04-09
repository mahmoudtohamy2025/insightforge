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
  { feature: "Solo Query / Simulation", model: "Gemini 2.5 Flash", version: "2025-04", purpose: "Consumer response generation" },
  { feature: "Focus Group Discussion", model: "Gemini 2.5 Flash", version: "2025-04", purpose: "Multi-round debate synthesis" },
  { feature: "A/B Test Analysis", model: "Gemini 2.5 Flash", version: "2025-04", purpose: "Variant preference scoring" },
  { feature: "Market Simulation", model: "Bass Diffusion + Gemini", version: "—", purpose: "Adoption curve modeling" },
  { feature: "Policy Impact", model: "Gemini 2.5 Flash", version: "2025-04", purpose: "Societal impact modelling" },
  { feature: "Theme Extraction", model: "Gemini 2.5 Flash", version: "2025-04", purpose: "Transcript analysis" },
  { feature: "Survey Generation", model: "Gemini 2.5 Flash", version: "2025-04", purpose: "Research question creation" },
];

const pipelineSteps = [
  {
    step: 1,
    title: "Create Digital Twins",
    description: "Define consumer personas with demographics, psychographics, cultural context, and behavioral patterns.",
    icon: Users2,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
  {
    step: 2,
    title: "Demographic Anchoring",
    description: "Before any response is generated, the AI is constraint-prompted with intersectional anchors: socioeconomic status, education, location, dialect probabilities.",
    icon: Brain,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    step: 3,
    title: "Simulate & Generate",
    description: "The anchored model generates in-character responses with sentiment, confidence, and behavioral tags. Temperature is dynamically scaled based on question type.",
    icon: Zap,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  {
    step: 4,
    title: "Validate & Calibrate",
    description: "Upload real survey data. The calibration engine computes accuracy scores and adjusts twin parameters for future inference.",
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
          Methodology
        </h1>
        <p className="text-muted-foreground mt-2 max-w-3xl">
          Understanding how InsightForge digital twins work, the AI models powering them, how
          confidence scores are calculated, and the scientific foundations behind our simulations.
        </p>
      </div>

      {/* ═══ Section 1: How Digital Twins Work ═══ */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          How Digital Twins Work
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          InsightForge creates AI-powered consumer personas — "digital twins" — that simulate how
          real people would react to products, campaigns, and policies. Each twin is grounded in
          empirical demographic and psychographic data, not generic AI outputs.
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
          Each simulation feature uses specific models optimized for the task. All models are
          anchored with demographic constraints before inference.
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
          Confidence Scores & Intervals
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          Every simulation result includes a confidence score on a 0–1 scale. This score reflects
          how reliable the twin's response is expected to be based on three factors.
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
                  Twin has been calibrated with real data and has strong demographic anchoring. Results
                  are highly reliable.
                </p>
              </div>
              <div className="space-y-2 p-4 bg-card rounded-lg border">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="font-semibold text-sm">≥ 0.60 — Medium Confidence</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Twin has partial calibration data. Results are directionally accurate but should be
                  validated with additional real data.
                </p>
              </div>
              <div className="space-y-2 p-4 bg-card rounded-lg border">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="font-semibold text-sm">&lt; 0.60 — Low Confidence</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Twin is uncalibrated or has sparse demographic data. Use results as early
                  hypotheses only.
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
          Bass Diffusion Model (Market Simulations)
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          Market simulations use the <strong>Bass Diffusion Model</strong> (Frank Bass, 1969) to predict
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
          Calibration Feedback Loop
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          InsightForge uses an <strong>autoregressive correction loop</strong> to continuously improve
          twin accuracy. When you upload real ground-truth data, the system recalculates calibration
          scores and adjusts twin parameters.
        </p>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8 justify-center py-4">
              {[
                { label: "Run Simulation", icon: Zap, color: "text-purple-500" },
                { label: "Collect Real Data", icon: FlaskConical, color: "text-blue-500" },
                { label: "Upload & Compare", icon: Scale, color: "text-amber-500" },
                { label: "Auto-Calibrate", icon: RefreshCw, color: "text-emerald-500" },
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
              Each calibration cycle improves future predictions. Variables that deviated from
              empirical reality are mathematically weighted downwards.
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
              <CardTitle className="text-base">Known Limitations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                <p><strong>LLM Hallucination Risk:</strong> AI models may generate plausible but
                  factually incorrect responses, especially for niche demographics with limited
                  training data.</p>
              </div>
              <div className="flex gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                <p><strong>Cultural Bias:</strong> MENA-specific cultural nuances may not be fully
                  captured by general-purpose language models. Calibration with local data is
                  strongly recommended.</p>
              </div>
              <div className="flex gap-2">
                <span className="text-amber-500 mt-0.5">•</span>
                <p><strong>Sample Size:</strong> Twins with fewer than 10 calibration entries should
                  be treated as exploratory, not predictive.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-500/20">
            <CardHeader>
              <CardTitle className="text-base">Our Commitments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex gap-2">
                <span className="text-emerald-500 mt-0.5">✓</span>
                <p><strong>Transparency:</strong> All confidence scores are computed from auditable
                  formulas. No black boxes.</p>
              </div>
              <div className="flex gap-2">
                <span className="text-emerald-500 mt-0.5">✓</span>
                <p><strong>Synthetic Label:</strong> All twin-generated content is clearly
                  labeled as synthetic (purple badge). Never passed off as real human data.</p>
              </div>
              <div className="flex gap-2">
                <span className="text-emerald-500 mt-0.5">✓</span>
                <p><strong>Data Sovereignty:</strong> Your calibration data never leaves your
                  workspace. Twins are not cross-trained on other customers' data.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA */}
      <Card className="bg-gradient-to-br from-primary/5 to-purple-500/5 border-primary/20">
        <CardContent className="py-8 text-center space-y-3">
          <h3 className="text-xl font-bold">Ready to validate your twins?</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Upload real survey data and watch your digital twins improve with every calibration cycle.
          </p>
          <Link to="/validation">
            <Button>
              Go to Validation Dashboard <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
