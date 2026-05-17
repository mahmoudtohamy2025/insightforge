import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  FlaskConical,
  FolderKanban,
  LineChart,
  ShieldCheck,
  Sparkles,
  Users2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { InlineDemo } from "@/components/marketing/InlineDemo";
import { useAuth } from "@/hooks/useAuth";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { FOUNDER_DECISION_TEMPLATES } from "@/lib/founderDecision";

const validationLadder = [
  {
    title: "Test direction fast",
    description: "Run an AI test to pressure-test messaging, pricing, and onboarding before you spend research time.",
    icon: Sparkles,
  },
  {
    title: "Validate with real users",
    description: "Escalate only the bets that matter into surveys, participant studies, and moderated sessions.",
    icon: Users2,
  },
  {
    title: "Act with confidence",
    description: "Use clear confidence levels to know when to move forward, run a quick customer check, or keep learning.",
    icon: ShieldCheck,
  },
];

const founderJobs = [
  {
    title: "Pricing",
    description: "Find the plan structure founders will actually trust and buy.",
    route: "/simulate",
  },
  {
    title: "Messaging",
    description: "Compare value props before rewriting your homepage or pitch.",
    route: "/focus-group",
  },
  {
    title: "Onboarding",
    description: "Catch activation friction before your next launch or signup push.",
    route: "/surveys",
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isSuperAdmin } = useSuperAdmin();

  const goToApp = () => navigate(user ? (isSuperAdmin ? "/admin" : "/dashboard") : "/signup");

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <section className="relative min-h-[100svh] isolate overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(22,163,74,0.16),_transparent_40%),radial-gradient(circle_at_80%_20%,_rgba(14,165,233,0.18),_transparent_28%),linear-gradient(180deg,_rgba(10,16,23,0.96),_rgba(10,16,23,0.85)_45%,_rgba(248,250,252,0.98)_100%)]" />
        <div className="absolute inset-y-0 right-0 w-[44vw] min-w-[320px] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0))] opacity-80 [clip-path:polygon(22%_0,100%_0,100%_100%,0_100%)]" />

        <div className="relative mx-auto flex min-h-[100svh] max-w-7xl flex-col justify-between px-4 py-6 sm:px-6 lg:px-8">
          <header className="flex items-center justify-between">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-3 text-left"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400 text-slate-950 shadow-[0_18px_60px_-24px_rgba(74,222,128,0.9)]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-300/90">
                  InsightForge
                </div>
                <div className="text-xs text-slate-300/70">Founder Decision OS</div>
              </div>
            </button>

            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                className="text-slate-100 hover:bg-white/10 hover:text-white"
                onClick={() => navigate("/demo")}
              >
                Try Demo
              </Button>
              <Button
                className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                onClick={goToApp}
              >
                Test a founder decision
              </Button>
            </div>
          </header>

          <div className="grid gap-16 pb-10 pt-12 lg:grid-cols-[minmax(0,1.1fr)_420px] lg:items-end lg:pt-16">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2 text-xs font-medium text-slate-200 backdrop-blur">
                <Compass className="h-3.5 w-3.5 text-emerald-300" />
                Decide in days, not weeks
              </div>

              <h1 className="mt-8 max-w-4xl text-balance text-5xl font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl">
                Test pricing, messaging, and onboarding bets before your team ships them.
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-200/78">
                Capture a risky founder decision, test it with AI customer profiles, validate it with real users when confidence is low, and turn the result into a summary your cofounders and investors can act on.
              </p>

              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <Button
                  size="lg"
                  className="h-14 rounded-full bg-emerald-400 px-8 text-base text-slate-950 hover:bg-emerald-300"
                  onClick={goToApp}
                >
                  Test a founder decision
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 rounded-full border-white/15 bg-white/5 px-8 text-base text-white hover:bg-white/10"
                  onClick={() => navigate("/demo")}
                >
                  See the founder demo
                </Button>
              </div>

              <div className="mt-10 flex flex-wrap gap-6 text-sm text-slate-300/78">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  AI tests first, real customer checks when needed
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  Clear confidence levels on every decision
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  Shareable decision summaries for your team
                </div>
              </div>
            </div>

            <div className="rounded-[32px] border border-white/10 bg-white/7 p-6 text-slate-50 shadow-[0_42px_120px_-52px_rgba(8,145,178,0.7)] backdrop-blur-xl">
              <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-emerald-300/80">Founder workspace</p>
                  <h2 className="mt-2 text-2xl font-semibold">Decision stack</h2>
                </div>
                <div className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-medium text-emerald-200">
                  v1 focus
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {founderJobs.map((job) => (
                  <button
                    key={job.title}
                    onClick={() => navigate(job.route)}
                    className="w-full rounded-2xl border border-white/10 bg-black/15 px-4 py-4 text-left transition hover:border-emerald-300/30 hover:bg-white/[0.08]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{job.title}</div>
                        <div className="mt-1 text-sm text-slate-300/70">{job.description}</div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-300/60" />
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-300/70">Validation ladder</p>
                    <h3 className="mt-2 text-lg font-medium">Move only when the evidence is strong enough</h3>
                  </div>
                  <LineChart className="h-5 w-5 text-emerald-300" />
                </div>
                <div className="mt-4 space-y-3 text-sm text-slate-300/78">
                  <div className="flex items-center justify-between rounded-xl bg-emerald-400/10 px-3 py-2">
                    <span>AI test</span>
                    <span className="font-medium text-emerald-200">Directional</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-amber-400/10 px-3 py-2">
                    <span>Quick customer check</span>
                    <span className="font-medium text-amber-100">Confirm</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-sky-400/10 px-3 py-2">
                    <span>Decision summary</span>
                    <span className="font-medium text-sky-100">Act</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border/60 bg-background py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-600">Simple flow</p>
            <h2 className="mt-4 max-w-lg text-3xl font-semibold tracking-tight">
              Use one operating system for the founder decisions that actually move the company.
            </h2>
            <p className="mt-4 max-w-lg text-base leading-7 text-muted-foreground">
              The product already has AI tests, participant flows, surveys, and insights. This turns them into one clear founder workflow instead of a loose research toolkit.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {validationLadder.map((item) => (
              <div key={item.title} className="border-l border-border/80 pl-5">
                <item.icon className="h-5 w-5 text-emerald-600" />
                <h3 className="mt-4 text-lg font-medium">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-600">Founder jobs</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight">Start with the three decisions founders feel every week.</h2>
            </div>
            <Button variant="outline" onClick={() => navigate("/requirements")}>
              Open decisions
            </Button>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {FOUNDER_DECISION_TEMPLATES.map((template) => (
              <div key={template.id} className="rounded-[28px] border border-border/70 p-7 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-600">
                  {template.category}
                </div>
                <h3 className="mt-4 text-2xl font-semibold">{template.title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{template.description}</p>
                <p className="mt-5 text-sm text-foreground/80">{template.hypothesis}</p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {template.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="interactive-demo" className="border-y border-border/60 bg-muted/20 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-600">Founder demo</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">Run a mock founder decision and get a mini scorecard in seconds.</h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              The public demo is now oriented around actual startup choices instead of generic persona theater.
            </p>
          </div>
          <div className="mt-12">
            <InlineDemo />
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:px-8">
          <div className="rounded-[28px] border border-border/70 bg-muted/20 p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">Decision summary</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">Every study should end with a recommendation, not another pile of notes.</h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Wrap each decision in a memo that explains what to do, how confident the system is, which evidence supports it, and what risk remains.
            </p>
            <Button className="mt-8" onClick={() => navigate("/requirements")}>
              Review your decisions
              <FolderKanban className="ml-2 h-4 w-4" />
            </Button>
          </div>

          <div className="rounded-[28px] border border-border/70 p-8">
            <div className="flex items-center justify-between gap-4 border-b border-border/70 pb-4">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Example memo</div>
                <div className="mt-2 text-xl font-semibold">Homepage Messaging Test</div>
              </div>
              <div className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                Medium confidence
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Recommendation</div>
                <p className="mt-2 text-sm leading-6">Lead with the "decide faster" message, then validate with a lightweight founder survey before updating paid acquisition creative.</p>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Risk</div>
                <p className="mt-2 text-sm leading-6">Could over-index on speed if trust and evidence are not visible enough in the first session.</p>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Evidence</div>
                <p className="mt-2 text-sm leading-6">AI message test, decision context, and a medium confidence level that points to a quick customer check.</p>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Next step</div>
                <p className="mt-2 text-sm leading-6">Run a 5-question survey with startup founders and compare conversion on the public demo.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-muted/20 py-16">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-purple-600">Participant engine</p>
            <h2 className="mt-3 text-2xl font-semibold">Real participants still matter because they make the system smarter over time.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              The participant side stays strategic because it helps the system learn, improves accuracy, and makes founder decisions more defensible over time.
            </p>
          </div>
          <Button
            size="lg"
            variant="outline"
            className="h-12 rounded-full px-6"
            onClick={() => navigate("/participate/signup")}
          >
            Join as participant
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-foreground">
            <Sparkles className="h-4 w-4 text-emerald-600" />
            InsightForge
          </div>
          <div>Founder Decision OS for early-stage SaaS teams.</div>
          <div>&copy; {new Date().getFullYear()} InsightForge</div>
        </div>
      </footer>
    </div>
  );
}
