import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Loader2, PlayCircle, CheckCircle2 } from "lucide-react";

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
  const [mockLoading, setMockLoading] = useState(false);
  const [query, setQuery] = useState("Would you use a subscription service for specialized coffee delivered monthly?");

  const handleRunSimulation = () => {
    setMockLoading(true);
    setTimeout(async () => {
      setMockLoading(false);
      setStep(3);
      await fireConfetti();
    }, 2000);
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
          Interactive Demo
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-6 relative flex flex-col justify-center">
        {step === 1 && (
          <div className="space-y-6 animate-fade-in text-center">
            <Sparkles className="h-10 w-10 text-primary mx-auto opacity-80" />
            <h3 className="text-2xl font-bold">Meet Sarah</h3>
            <div className="mx-auto bg-primary/10 border border-primary/20 rounded-xl p-4 max-w-xs text-left">
              <p className="text-sm font-semibold mb-1">👩🏽‍💼 Sarah M. (28, Dubai)</p>
              <p className="text-xs text-muted-foreground">Marketing Professional, high disposable income, values convenience and premium brands.</p>
            </div>
            <Button size="lg" className="px-8 mt-4" onClick={() => setStep(2)}>
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
              <label className="text-sm font-medium text-muted-foreground">What would you like to ask her?</label>
              <Input 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="text-base h-12"
              />
            </div>
            
            {mockLoading ? (
              <div className="flex flex-col items-center justify-center p-8 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-primary font-medium animate-pulse">Running neural calibration...</p>
              </div>
            ) : (
              <Button size="lg" className="w-full h-12 text-base" onClick={handleRunSimulation}>
                <Sparkles className="mr-2 h-4 w-4" />
                Simulate Response
              </Button>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-2 text-emerald-500 font-bold mb-4">
              <CheckCircle2 className="h-5 w-5" />
              Simulation Complete (1.8s)
            </div>
            
            <div className="bg-muted border border-border rounded-xl p-5 relative">
              <div className="absolute -top-3 -left-3 text-3xl">👩🏽‍💼</div>
              <h4 className="font-semibold text-sm mb-2 pl-4">Sarah's Simulated Response:</h4>
              <p className="text-sm leading-relaxed text-foreground/90 pl-4">
                "I love this idea! With my schedule, I don't always have time to discover new roasts, but I appreciate high-quality coffee. I'd definitely pay a premium ($20-30/mo) if the curation is excellent and the packaging looks great on my counter."
              </p>
              
              <div className="mt-4 pt-4 border-t border-border/50 flex gap-4 pl-4">
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Interest Level</span>
                  <span className="text-sm font-semibold text-emerald-500">Very High (92%)</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Price Barrier</span>
                  <span className="text-sm font-semibold text-amber-500">Low</span>
                </div>
              </div>
            </div>

            <Button size="lg" variant="default" className="w-full bg-gradient-to-r from-primary to-purple-600 hover:opacity-90" onClick={() => window.location.href = '/auth'}>
              Try with 1,000 Personas
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
