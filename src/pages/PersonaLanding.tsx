import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Info, Sparkles } from "lucide-react";
import {
  PERSONA_LANDING,
  DOOR_STORAGE_KEY,
  type DoorKey,
} from "@/lib/personaLandingCopy";
import { trackEvent } from "@/lib/analytics";

// One component, three doors (/for-founders, /for-product-teams, /for-brands).
// Doors differ in copy only — same engine, same /signup. The visited door is
// persisted so signup_completed can attribute which framing converted.
export default function PersonaLanding({ persona }: { persona: DoorKey }) {
  const navigate = useNavigate();
  const copy = PERSONA_LANDING[persona];

  useEffect(() => {
    localStorage.setItem(DOOR_STORAGE_KEY, persona);
    trackEvent("door_viewed", { door: persona });
  }, [persona]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Minimal public nav */}
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-bold text-lg">
            InsightForge
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>
              Sign in
            </Button>
            <Button size="sm" onClick={() => navigate("/signup")}>
              Start free
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6">
        {/* Hero */}
        <section className="py-16 sm:py-24 text-center space-y-6">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary bg-primary/10 rounded-full px-3 py-1">
            <Sparkles className="h-3.5 w-3.5" />
            {copy.badge}
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight max-w-3xl mx-auto">
            {copy.headline}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {copy.subheadline}
          </p>
          <div className="pt-2">
            <Button size="lg" onClick={() => navigate("/signup")}>
              {copy.cta}
              <ArrowRight className="h-4 w-4 ms-2" />
            </Button>
          </div>
          <ul className="pt-6 flex flex-col sm:flex-row gap-3 sm:gap-8 justify-center text-sm text-muted-foreground">
            {copy.pains.map((pain) => (
              <li key={pain} className="flex items-center gap-2 justify-center">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                {pain}
              </li>
            ))}
          </ul>
        </section>

        {/* How it works */}
        <section className="py-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {copy.steps.map((step, i) => (
            <div key={step.title} className="bg-card border border-border rounded-2xl p-6 space-y-3">
              <span className="text-sm font-mono text-primary">0{i + 1}</span>
              <h3 className="text-lg font-bold">{step.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </section>

        {/* Persona features */}
        <section className="py-12 grid grid-cols-1 sm:grid-cols-2 gap-6">
          {copy.features.map((feature) => (
            <div key={feature.title} className="bg-card border border-border rounded-2xl p-6 space-y-2">
              <h3 className="font-semibold">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </section>

        {/* Honest-signal note */}
        <section className="py-6">
          <div className="border border-amber-500/30 bg-amber-500/5 rounded-2xl p-5 flex gap-3 text-sm text-muted-foreground">
            <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p>{copy.honestNote}</p>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-16 text-center space-y-4">
          <h2 className="text-2xl sm:text-3xl font-bold">{copy.headline}</h2>
          <Button size="lg" onClick={() => navigate("/signup")}>
            {copy.cta}
            <ArrowRight className="h-4 w-4 ms-2" />
          </Button>
          <p className="text-xs text-muted-foreground">
            No credit card required · <Link to="/demo" className="underline hover:text-foreground">try the live demo first</Link>
          </p>
        </section>
      </main>
    </div>
  );
}
