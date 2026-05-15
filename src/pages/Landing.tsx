import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { trackEvent, trackPageView } from "@/lib/analytics";
import {
  Sparkles,
  Users2,
  FlaskConical,
  BarChart3,
  Shield,
  Zap,
  ArrowRight,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Globe,
  MessageSquare,
  TrendingUp,
  Scale,
  ChevronRight,
  Play
} from "lucide-react";
import { InlineDemo } from "@/components/marketing/InlineDemo";

// Variant identifier — used to disambiguate analytics events for the 3-arm ICP positioning test.
const LANDING_VARIANT = "founders" as const;

// P1.3 — vs ChatGPT comparison data.
// Each cell is one of: "yes" | "no" | "partial" — rendered as a colored icon
// with an optional caption explaining the "partial" case.
type Cell = { state: "yes" | "no" | "partial"; note?: string };
type ComparisonRow = { feature: string; free: Cell; plus: Cell; insightforge: Cell };

const COMPARISON_ROWS: ComparisonRow[] = [
  {
    feature: "Knows your target customer profile",
    free: { state: "no" },
    plus: { state: "partial", note: "with manual prompting" },
    insightforge: { state: "yes" },
  },
  {
    feature: "Returns calibrated sentiment & confidence scores",
    free: { state: "no" },
    plus: { state: "no" },
    insightforge: { state: "yes" },
  },
  {
    feature: "Multi-persona debate (focus group)",
    free: { state: "no" },
    plus: { state: "partial", note: "one at a time" },
    insightforge: { state: "yes" },
  },
  {
    feature: "Stays in character across rounds",
    free: { state: "partial", note: "drifts" },
    plus: { state: "partial", note: "drifts" },
    insightforge: { state: "yes" },
  },
  {
    feature: "Cultural calibration (dialect, region, traditions)",
    free: { state: "no" },
    plus: { state: "no" },
    insightforge: { state: "yes" },
  },
  {
    feature: "Side-by-side with real participants",
    free: { state: "no" },
    plus: { state: "no" },
    insightforge: { state: "yes" },
  },
  {
    feature: "Exportable stakeholder PDF",
    free: { state: "no" },
    plus: { state: "no" },
    insightforge: { state: "yes" },
  },
];

// P1.2 — Six FAQs answering the predictable founder objections.
// Order is intentional: accuracy → ChatGPT differentiation → fit-for-my-product
// → "I don't know my customer yet" → privacy → "what do I get out".
const FAQS: { q: string; a: string }[] = [
  {
    q: "How accurate is this vs. talking to real customers?",
    a: "Calibrated synthetic consumers reach 85–92% parity with real-survey data on concept and pricing studies (per independent research). For directional 'should I build this?' decisions, that's plenty. For high-stakes spend decisions, use InsightForge to pre-screen ideas synthetically, then validate the winners with real participants — both happen side-by-side in one workflow.",
  },
  {
    q: "How is this different from just asking ChatGPT?",
    a: "ChatGPT is a great writer. It's not a focus group. Asking ChatGPT 'what would a 28-year-old Dubai professional think of my coffee idea' gets you a generic answer that drifts out of character after two messages, with no calibrated confidence or sentiment score. InsightForge uses a 6-layer persona prompt with cultural context, returns structured output (sentiment, confidence, purchase intent, themes), and lets multiple personas debate each other across rounds. See the comparison table above.",
  },
  {
    q: "Can I use it for B2B or non-consumer products?",
    a: "Yes. The persona system is configurable — you describe the role (e.g. 'VP Engineering at a 50-person SaaS who currently uses Datadog'), and the AI plays that role. Works for B2B SaaS, enterprise tools, internal apps, even policy decisions. The pre-built consumer personas are templates; you can clone and customize them in seconds.",
  },
  {
    q: "What if I don't know my target customer yet?",
    a: "That's actually the most valuable first session. You describe what you do know ('busy parents who care about health'), and the AI helps you sharpen that into a real persona by asking the right questions. Most founders say the persona-discovery loop is more useful than the simulation itself.",
  },
  {
    q: "Is my idea data private?",
    a: "Yes. Every workspace is isolated by Postgres row-level security — your data is invisible to other workspaces. We do not train AI on your inputs (Gemini is called via API, not in training mode). GDPR-compliant. You can export everything and delete your workspace at any time. No screenshots of your ideas leave our infrastructure unless you explicitly share a snapshot link.",
  },
  {
    q: "What does the AI actually return?",
    a: "Every simulation returns structured data, not just a paragraph. For each persona response you get: (1) the in-character response text, (2) a sentiment score from -1 to +1, (3) a confidence score from 0 to 1 based on how well the stimulus matches the persona, (4) a purchase-intent label across 5 levels, (5) an emotional reaction across 6 levels, and (6) 3–5 key themes extracted from the response. Export the full report as a PDF you can send to your co-founder or investor.",
  },
];

// Helper to render one cell in the comparison table.
function CompareCell({ cell }: { cell: Cell }) {
  if (cell.state === "yes") {
    return <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto" aria-label="Yes" />;
  }
  if (cell.state === "no") {
    return <XCircle className="h-5 w-5 text-red-500/70 mx-auto" aria-label="No" />;
  }
  return (
    <div className="flex flex-col items-center gap-1">
      <MinusCircle className="h-5 w-5 text-amber-500 mx-auto" aria-label="Partial" />
      {cell.note && (
        <span className="text-[10px] text-muted-foreground italic leading-tight">
          {cell.note}
        </span>
      )}
    </div>
  );
}

const Landing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useI18n();

  // P0.1 — Fire a page-view event on mount so the founders landing arm is measurable.
  useEffect(() => {
    trackPageView("/");
    trackEvent("landing_page_view", { variant: LANDING_VARIANT });
  }, []);

  // P0.2 — Route directly to /signup for unauthed users (was /auth — removed one click).
  // Also fires a CTA-click event so we can see which CTA drove the conversion.
  const goToApp = (ctaId: string, section: string) => {
    trackEvent("landing_cta_click", { cta: ctaId, section, variant: LANDING_VARIANT });
    navigate(user ? "/dashboard" : "/signup");
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ═══════════════ HERO ═══════════════ */}
      <section className="relative py-20 lg:py-32 px-4">
        {/* Gradient orbs */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative max-w-6xl mx-auto text-center space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-sm font-medium animate-pulse">
            <Sparkles className="h-3.5 w-3.5" />
            Built for founders validating ideas
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
            <span className="bg-gradient-to-r from-primary via-purple-500 to-primary bg-clip-text text-transparent">
              Find out if your idea has legs — in an afternoon, not three weeks.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Stress-test your pitch, your pricing, or your next feature against 5 simulated customers and get a real sentiment answer — before you spend a dollar on focus groups.
          </p>

          {/* CTAs */}
          <div className="flex flex-col items-center justify-center gap-2 pt-4">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                onClick={() => goToApp("hero_primary", "hero")}
                className="text-base px-8 py-6 rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all"
              >
                Run my first simulation — free
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => {
                  trackEvent("landing_watch_demo_click", { variant: LANDING_VARIANT });
                  document.getElementById("interactive-demo")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="text-base px-8 py-6 rounded-xl"
              >
                <Play className="h-4 w-4 mr-2" />
                Watch Demo
              </Button>
            </div>
            {/* P0.3 — Risk-reversal micro-copy: removes the "is this going to cost me?" friction at the moment of intent. */}
            <p className="text-xs text-muted-foreground mt-1">
              Free forever · No credit card · 30-second sign-up
            </p>
          </div>

          {/* Social Proof Bar */}
          <div className="pt-6 animate-fade-in text-sm font-medium text-muted-foreground flex items-center justify-center gap-2">
            <span className="flex items-center">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className={`w-6 h-6 rounded-full border-2 border-background bg-muted -ml-2 first:ml-0 flex items-center justify-center overflow-hidden z-[${10-i}]`}>
                  <Users2 className="h-3 w-3" />
                </div>
              ))}
            </span>
            <span className="ml-2">Built by founders, for founders · <strong className="text-foreground">Kill bad ideas in a weekend</strong></span>
          </div>

          {/* Trust Badges */}
          <div className="flex flex-wrap items-center justify-center gap-6 pt-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-primary" />
              {t("landing.trustSimulations")}
            </span>
            <span className="flex items-center gap-1.5">
              <Globe className="h-4 w-4 text-primary" />
              Confidence scores in 90 seconds
            </span>
            <span className="flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-primary" />
              {t("landing.trustGDPR")}
            </span>
          </div>

          {/* Animated Twin Persona Cards */}
          {/* P1.4 — TODO (user action required): Capture a real screenshot of the
              simulation-results UI (the sentiment + confidence + themes panel that users
              see after running a sim). Save to public/screenshots/sim-result-founder.png.
              Then replace this persona-card row on desktop with the screenshot — keep the
              cards on mobile where a screenshot would be unreadable. This is the single
              biggest credibility lever the page is missing: zero images of the actual
              product is a major UX/UI smell for a B2B tool. */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto pt-12">
            {[
              { name: "Sarah M.", age: "28-34", loc: "Dubai, UAE", emoji: "👩🏽‍💼", trait: "Health-conscious professional", anim: "animate-float-slow" },
              { name: "Ahmed K.", age: "22-28", loc: "Cairo, Egypt", emoji: "👨🏻‍🎓", trait: "Tech-savvy student", anim: "animate-float-medium" },
              { name: "Lisa R.", age: "35-45", loc: "London, UK", emoji: "👩🏼‍🔬", trait: "Sustainability advocate", anim: "animate-float-fast" },
            ].map((twin) => (
              <div
                key={twin.name}
                className={`group relative bg-card/80 backdrop-blur-lg border border-primary/20 rounded-2xl p-5 text-left hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 ${twin.anim}`}
              >
                {/* Synthetic badge */}
                <div className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-400 text-[9px] font-bold uppercase">
                  AI Twin
                </div>
                <div className="text-3xl mb-3">{twin.emoji}</div>
                <p className="font-semibold text-sm">{twin.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{twin.age} · {twin.loc}</p>
                <div className="mt-2 px-2 py-1 rounded-md bg-muted/50 text-[10px] text-muted-foreground italic">
                  "{twin.trait}"
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ INTERACTIVE DEMO ═══════════════ */}
      <section id="interactive-demo" className="py-12 px-4 relative z-10 -mt-8">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Try it right now. No signup required.</h2>
            <p className="text-sm text-muted-foreground">Run a mock AI simulation and see the results instantly.</p>
          </div>
          <InlineDemo />
        </div>
      </section>

      {/* P0.4 — VIDEO TESTIMONIAL SECTION REMOVED.
          Previously displayed a placeholder testimonial with literal "[Real founder name and company]"
          text. Shipping fake social proof on a founder pitch is brand-damaging — better to ship nothing
          than placeholder. Re-add once one real founder has agreed to be quoted (see Plan v2, P3.6). */}

      {/* ═══════════════ VS CHATGPT COMPARISON (P1.3) ═══════════════ */}
      {/* This is the strongest single visual argument for paying $19+/mo for InsightForge
          instead of using ChatGPT-Plus at $20. ChatGPT-Plus is the floor competitor for
          the founder ICP — without this block, the founder thinks "I can just use Claude
          Projects" and bounces. With this block, the differentiation becomes concrete. */}
      <section id="vs-chatgpt" className="py-24 px-4 bg-muted/30">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-3xl sm:text-4xl font-bold">Why not just ask ChatGPT?</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              ChatGPT is a great writer. It's not a focus group. Here's what changes when you use a tool built for consumer simulation.
            </p>
          </div>

          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full min-w-[640px] sm:min-w-0 border-collapse text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 font-semibold text-muted-foreground w-2/5"></th>
                  <th className="text-center p-4 font-semibold text-muted-foreground">
                    <div>ChatGPT Free</div>
                  </th>
                  <th className="text-center p-4 font-semibold text-muted-foreground">
                    <div>ChatGPT Plus</div>
                    <div className="text-xs font-normal text-muted-foreground/70">$20/mo</div>
                  </th>
                  <th className="text-center p-4 font-bold border-l-2 border-primary/40 bg-primary/5">
                    <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                      InsightForge
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, idx) => (
                  <tr
                    key={row.feature}
                    className={`border-b border-border/40 ${idx % 2 ? "bg-card/40" : ""}`}
                  >
                    <td className="p-4 font-medium">{row.feature}</td>
                    <td className="p-4 text-center"><CompareCell cell={row.free} /></td>
                    <td className="p-4 text-center"><CompareCell cell={row.plus} /></td>
                    <td className="p-4 text-center border-l-2 border-primary/40 bg-primary/5">
                      <CompareCell cell={row.insightforge} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-center text-sm text-muted-foreground italic">
            ChatGPT is fantastic at writing for an idea. InsightForge is built to test it.
          </p>
        </div>
      </section>

      {/* ═══════════════ HOW IT WORKS ═══════════════ */}
      <section id="how-it-works" className="py-24 px-4 bg-muted/30">
        <div className="max-w-5xl mx-auto text-center space-y-16">
          <div className="space-y-3">
            <h2 className="text-3xl sm:text-4xl font-bold">{t("landing.howItWorksTitle")}</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">Three simple steps from persona creation to actionable insights.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: "01", icon: Users2, title: t("landing.step1Title"), desc: t("landing.step1Desc"), color: "from-primary to-blue-500" },
              { step: "02", icon: FlaskConical, title: t("landing.step2Title"), desc: t("landing.step2Desc"), color: "from-purple-500 to-pink-500" },
              { step: "03", icon: BarChart3, title: t("landing.step3Title"), desc: t("landing.step3Desc"), color: "from-amber-500 to-orange-500" },
            ].map((s) => (
              <div key={s.step} className="relative group">
                <div className="bg-card border border-border rounded-2xl p-8 h-full text-left space-y-4 hover:border-primary/40 transition-all hover:shadow-lg">
                  {/* Step number */}
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${s.color} text-white text-lg font-bold`}>
                    {s.step}
                  </div>
                  <h3 className="text-lg font-bold">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
                {/* Connector arrow (hidden on mobile) */}
                {s.step !== "03" && (
                  <div className="hidden md:flex absolute top-1/2 -right-5 transform -translate-y-1/2 text-muted-foreground/30">
                    <ChevronRight className="h-8 w-8" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ SIMULATION STUDIOS ═══════════════ */}
      <section className="py-24 px-4">
        <div className="max-w-6xl mx-auto space-y-16">
          <div className="text-center space-y-3">
            <h2 className="text-3xl sm:text-4xl font-bold">{t("landing.studiosTitle")}</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Sparkles,
                title: t("landing.soloQueryTitle"),
                desc: t("landing.soloQueryDesc"),
                gradient: "from-blue-500/10 to-cyan-500/10",
                iconColor: "text-blue-500",
                border: "hover:border-blue-500/40",
              },
              {
                icon: Users2,
                title: t("landing.focusGroupTitle"),
                desc: t("landing.focusGroupDesc"),
                gradient: "from-purple-500/10 to-pink-500/10",
                iconColor: "text-purple-500",
                border: "hover:border-purple-500/40",
              },
              {
                icon: FlaskConical,
                title: t("landing.abTestTitle"),
                desc: t("landing.abTestDesc"),
                gradient: "from-emerald-500/10 to-teal-500/10",
                iconColor: "text-emerald-500",
                border: "hover:border-emerald-500/40",
              },
              {
                icon: TrendingUp,
                title: t("landing.marketSimTitle"),
                desc: t("landing.marketSimDesc"),
                gradient: "from-amber-500/10 to-orange-500/10",
                iconColor: "text-amber-500",
                border: "hover:border-amber-500/40",
              },
              {
                icon: Scale,
                title: t("landing.policyImpactTitle"),
                desc: t("landing.policyImpactDesc"),
                gradient: "from-red-500/10 to-rose-500/10",
                iconColor: "text-red-500",
                border: "hover:border-red-500/40",
              },
            ].map((studio) => (
              <div
                key={studio.title}
                className={`group bg-card border border-border rounded-2xl p-6 space-y-4 transition-all duration-300 hover:shadow-lg ${studio.border}`}
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${studio.gradient} flex items-center justify-center`}>
                  <studio.icon className={`h-6 w-6 ${studio.iconColor}`} />
                </div>
                <h3 className="text-lg font-bold">{studio.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{studio.desc}</p>
              </div>
            ))}

            {/* Traditional Research Card */}
            <div className="group bg-card/50 border border-dashed border-border rounded-2xl p-6 space-y-4 transition-all hover:border-muted-foreground/40">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-bold">{t("landing.traditionalTitle")}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{t("landing.traditionalDesc")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ FAQ (P1.2) ═══════════════ */}
      {/* Six objections every founder asks before paying. Handled inline so they don't
          bounce to a help-center page or just close the tab. Honest answers — no
          dodging the accuracy question or the ChatGPT question. */}
      <section id="faq" className="py-24 px-4">
        <div className="max-w-3xl mx-auto space-y-10">
          <div className="text-center space-y-3">
            <h2 className="text-3xl sm:text-4xl font-bold">Common questions from founders</h2>
            <p className="text-muted-foreground">
              The first 6 questions every founder asks. Honest answers.
            </p>
          </div>
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((faq, idx) => (
              <AccordionItem key={faq.q} value={`q${idx + 1}`}>
                <AccordionTrigger
                  className="text-left text-base font-semibold"
                  onClick={() =>
                    trackEvent("faq_question_opened", {
                      question_index: idx,
                      variant: LANDING_VARIANT,
                    })
                  }
                >
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed text-sm pb-4">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ═══════════════ PRICING ═══════════════ */}
      <section className="py-24 px-4 bg-muted/30">
        <div className="max-w-7xl mx-auto text-center space-y-12">
          <div className="space-y-3">
            <h2 className="text-3xl sm:text-4xl font-bold">{t("landing.pricingTitle")}</h2>
            <p className="text-muted-foreground">{t("landing.pricingSubtitle")}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              {
                name: "Free",
                price: "$0",
                period: "/mo",
                popular: false,
                features: ["1 seat", "10 simulations/mo"],
                cta: "Get Started",
              },
              {
                name: "Solo",
                price: "$19",
                period: "/mo",
                popular: false,
                features: ["1 seat", "100 simulations", "Basic AI Models"],
                cta: "Start Solo",
              },
              {
                name: "Starter",
                price: "$49",
                period: "/mo",
                popular: true,
                features: ["5 seats", "500K Tokens", "Custom Studies"],
                cta: "Start Starter",
              },
              {
                name: "Professional",
                price: "$149",
                period: "/mo",
                popular: false,
                features: ["15 seats", "2M Tokens", "Priority support"],
                cta: "Start Pro",
              },
              {
                name: "Enterprise",
                price: "Custom",
                period: "",
                popular: false,
                features: ["SSO & SCIM", "Custom Models", "Dedicated Manager", "SLA"],
                cta: "Contact Sales",
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`relative bg-card border rounded-2xl p-8 text-left space-y-6 transition-all hover:shadow-lg ${
                  plan.popular ? "border-primary shadow-lg shadow-primary/10 scale-[1.02]" : "border-border"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                    Most Popular
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{plan.name}</p>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-4xl font-extrabold">{plan.price}</span>
                    <span className="text-muted-foreground text-sm">{plan.period}</span>
                  </div>
                </div>
                <ul className="space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                  onClick={() => goToApp(`pricing_${plan.name.toLowerCase()}`, "pricing")}
                >
                  {plan.cta}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ FINAL CTA ═══════════════ */}
      <section className="py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="relative bg-gradient-to-r from-primary/10 via-purple-500/10 to-primary/10 border border-primary/20 rounded-3xl p-12 sm:p-16 space-y-6">
            {/* Glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-purple-500/5 rounded-3xl blur-xl" />

            <div className="relative space-y-6">
              <h2 className="text-3xl sm:text-4xl font-bold">
                {t("landing.ctaTitle")}
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                {t("landing.ctaSubtitle")}
              </p>
              <Button
                size="lg"
                onClick={() => goToApp("final_cta_primary", "final_cta")}
                className="text-base px-10 py-6 rounded-xl shadow-lg shadow-primary/20"
              >
                {t("landing.ctaButton")}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              {/* P0.3 — Risk-reversal micro-copy at the final CTA too — last chance to nudge intent over the line. */}
              <p className="text-xs text-muted-foreground mt-3">
                Free forever · No credit card · 30-second sign-up
              </p>
            </div>
          </div>
        </div>
      </section>
      {/* ═══════════════ FOR PARTICIPANTS CTA ═══════════════ */}
      <section className="py-20 px-4 bg-muted/20 border-t border-border">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 bg-card border border-primary/20 rounded-2xl p-8 sm:p-12 shadow-lg shadow-primary/5">
          <div className="space-y-4 flex-1 text-center md:text-left">
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-purple-500/10 text-purple-500 text-xs font-bold uppercase tracking-wider mb-2">
              For Participants
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold">Earn money shaping the future.</h2>
            <p className="text-muted-foreground leading-relaxed max-w-lg">
              Join thousands of participants globally. Calibrate your AI twin, answer questions securely, and get paid instantly for your impact.
            </p>
          </div>
          <Button
            size="lg"
            className="shrink-0 bg-purple-600 hover:bg-purple-700 w-full md:w-auto h-14 px-8 text-base shadow-lg shadow-purple-500/20"
            onClick={() => {
              trackEvent("landing_cta_click", { cta: "participant_signup", section: "participant_cta", variant: LANDING_VARIANT });
              navigate('/participate/signup');
            }}
          >
            Join as Participant
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </section>
      {/* ═══════════════ FOOTER ═══════════════ */}
      <footer className="border-t py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="font-bold">InsightForge</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} InsightForge. All rights reserved.
          </p>
        </div>
      </footer>

      {/* ═══════════════ CSS ANIMATIONS ═══════════════ */}
      <style>{`
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes float-medium {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        @keyframes float-fast {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        .animate-float-slow { animation: float-slow 4s ease-in-out infinite; }
        .animate-float-medium { animation: float-medium 3.5s ease-in-out infinite 0.5s; }
        .animate-float-fast { animation: float-fast 3s ease-in-out infinite 1s; }
      `}</style>
    </div>
  );
};

export default Landing;
