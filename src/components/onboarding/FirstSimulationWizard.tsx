import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Loader2, PlayCircle, CheckCircle2, ArrowRight } from "lucide-react";

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
}

export function FirstSimulationWizard() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [mockLoading, setMockLoading] = useState(false);
  const [query, setQuery] = useState("Would you use an AI-assisted focus group tool?");

  useEffect(() => {
    // Only show if logged in, hasn't seen it, and is NOT on participant portal
    if (user && !localStorage.getItem("has_seen_first_sim") && !window.location.pathname.startsWith('/participate')) {
      // Small delay so they see the dashboard first
      const timer = setTimeout(() => setOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const handleClose = () => {
    setOpen(false);
    localStorage.setItem("has_seen_first_sim", "true");
  };

  const handleRunSimulation = () => {
    setMockLoading(true);
    setTimeout(async () => {
      setMockLoading(false);
      setStep(3);
      await fireConfetti();
    }, 2000);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden border-border bg-card">
        <div className="bg-gradient-to-r from-primary/10 via-purple-500/10 to-primary/10 border-b border-border p-6 flex items-start justify-between">
          <div>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              Your First AI Simulation
            </DialogTitle>
            <DialogDescription className="mt-2 text-base text-foreground/80">
              Let's run your first focus group in 60 seconds.
            </DialogDescription>
          </div>
        </div>

        <div className="p-6 relative min-h-[300px] flex flex-col justify-center">
          {step === 1 && (
            <div className="space-y-6 animate-fade-in text-center">
              <h3 className="text-xl font-bold">Step 1: Auto-creating a Persona</h3>
              <p className="text-muted-foreground">We've generated a sample digital twin for you based on typical B2B SaaS buyers.</p>
              
              <div className="mx-auto bg-primary/5 border border-primary/20 rounded-xl p-4 max-w-sm text-left">
                <p className="text-sm font-semibold mb-1 flex items-center gap-2 text-primary">
                  <span className="text-lg">👩🏼‍💼</span> Sarah M. (32, London)
                </p>
                <p className="text-xs text-muted-foreground">Product Manager, tech-savvy, evaluates new software tools weekly.</p>
              </div>
              <Button size="lg" className="w-full mt-4" onClick={() => setStep(2)}>
                Continue to Question <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-fade-in">
              <h3 className="text-xl font-bold flex items-center gap-2">
                Step 2: Ask the Persona
              </h3>
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Prompt input (Ask Sarah about your product idea)</label>
                <Input 
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="text-base h-12"
                />
              </div>
              
              {mockLoading ? (
                <div className="flex flex-col items-center justify-center py-6 space-y-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-primary font-medium animate-pulse">Running neural calibration...</p>
                </div>
              ) : (
                <Button size="lg" className="w-full h-12 text-base" onClick={handleRunSimulation}>
                  <PlayCircle className="mr-2 h-5 w-5" />
                  Run Simulation
                </Button>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center gap-2 text-emerald-500 font-bold mb-4">
                <CheckCircle2 className="h-6 w-6" />
                Done! You just replaced 2 weeks of user research.
              </div>
              
              <div className="bg-muted border border-border rounded-xl p-5 relative">
                <h4 className="font-semibold text-sm mb-2 text-primary">Sarah's Simulated Output:</h4>
                <p className="text-sm leading-relaxed text-foreground/90 italic">
                  "Yes, absolutely. If it integrates with Jira and reduces my meeting time by even 10%, I'd happily pay $49/month for a starter plan. The key barrier for me is setup time."
                </p>
              </div>

              <div className="pt-4 text-center space-y-4">
                <p className="text-sm text-muted-foreground">Imagine generating this instantly across 1,000 personas.</p>
                <Button size="lg" variant="default" className="w-full" onClick={handleClose}>
                  Go to Dashboard
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
