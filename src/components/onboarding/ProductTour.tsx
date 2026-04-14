import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { X, ArrowRight, ArrowLeft, HelpCircle } from "lucide-react";

export interface TourStep {
  target: string;
  title: string;
  description: string;
  icon?: string;
  position?: "top" | "bottom" | "left" | "right";
}

interface ProductTourProps {
  tourId: string;
  steps: TourStep[];
  onComplete?: () => void;
}

function getPosition(rect: DOMRect, pos: string, tooltipW: number, tooltipH: number) {
  const gap = 14;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let top = 0, left = 0;
  
  switch (pos) {
    case "bottom":
      top = rect.bottom + gap;
      left = rect.left + rect.width / 2 - tooltipW / 2;
      break;
    case "top":
      top = rect.top - tooltipH - gap;
      left = rect.left + rect.width / 2 - tooltipW / 2;
      break;
    case "left":
      top = rect.top + rect.height / 2 - tooltipH / 2;
      left = rect.left - tooltipW - gap;
      break;
    case "right":
      top = rect.top + rect.height / 2 - tooltipH / 2;
      left = rect.right + gap;
      break;
    default:
      top = rect.bottom + gap;
      left = rect.left + rect.width / 2 - tooltipW / 2;
  }
  // Clamp to viewport
  if (left < 12) left = 12;
  if (left + tooltipW > vw - 12) left = vw - tooltipW - 12;
  if (top < 12) top = 12;
  if (top + tooltipH > vh - 12) top = vh - tooltipH - 12;
  return { top, left };
}

export function ProductTour({ tourId, steps, onComplete }: ProductTourProps) {
  const storageKey = `tour_completed_${tourId}`;
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Auto-start on first visit
  useEffect(() => {
    if (localStorage.getItem(storageKey) === "true") return;
    const timer = setTimeout(() => {
      setActive(true);
      setStep(0);
    }, 800);
    return () => clearTimeout(timer);
  }, [storageKey]);

  // Find target element
  useEffect(() => {
    if (!active || !steps[step]) return;
    const find = () => {
      const el = document.querySelector(steps[step].target);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => {
          setRect(el.getBoundingClientRect());
        }, 350);
      } else {
        setRect(null);
      }
    };
    find();
    window.addEventListener("resize", find);
    return () => window.removeEventListener("resize", find);
  }, [active, step, steps]);

  const finish = useCallback(() => {
    localStorage.setItem(storageKey, "true");
    setActive(false);
    setStep(0);
    onComplete?.();
  }, [storageKey, onComplete]);

  const next = useCallback(() => {
    if (step < steps.length - 1) setStep(s => s + 1);
    else finish();
  }, [step, steps.length, finish]);

  const prev = useCallback(() => {
    if (step > 0) setStep(s => s - 1);
  }, [step]);

  // Keyboard
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight" || e.key === "Enter") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, next, prev, finish]);

  if (!active || !steps[step]) return null;

  const current = steps[step];
  const pos = current.position || "bottom";
  const tooltipW = 340;
  const tooltipH = 180;
  const coords = rect ? getPosition(rect, pos, tooltipW, tooltipH) : { top: window.innerHeight / 2 - 90, left: window.innerWidth / 2 - 170 };

  return createPortal(
    <div className="fixed inset-0 z-[9999]" style={{ pointerEvents: "auto" }}>
      {/* Overlay */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
        <defs>
          <mask id={`tour-mask-${tourId}`}>
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={rect.left - 6}
                y={rect.top - 6}
                width={rect.width + 12}
                height={rect.height + 12}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0" y="0" width="100%" height="100%"
          fill="rgba(0,0,0,0.55)"
          mask={`url(#tour-mask-${tourId})`}
          style={{ pointerEvents: "auto" }}
          onClick={finish}
        />
      </svg>

      {/* Spotlight ring */}
      {rect && (
        <div
          className="absolute border-2 border-primary rounded-lg animate-pulse pointer-events-none"
          style={{
            left: rect.left - 6,
            top: rect.top - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: "0 0 0 4px rgba(var(--primary-rgb, 99,102,241), 0.25)",
          }}
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="absolute bg-card border border-border rounded-xl shadow-2xl p-0 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300"
        style={{
          top: coords.top,
          left: coords.left,
          width: tooltipW,
          zIndex: 10000,
          pointerEvents: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-2 flex items-start justify-between">
          <div className="flex items-center gap-2">
            {current.icon && <span className="text-lg">{current.icon}</span>}
            <h3 className="font-bold text-sm text-foreground">{current.title}</h3>
          </div>
          <button
            onClick={finish}
            className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 pb-3">
          <p className="text-xs text-muted-foreground leading-relaxed">{current.description}</p>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-muted/30 border-t border-border flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground font-medium">
            {step + 1} of {steps.length}
          </span>
          <div className="flex items-center gap-1.5">
            {step > 0 && (
              <button
                onClick={prev}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-background border border-border rounded-md transition-colors"
              >
                <ArrowLeft className="h-3 w-3" /> Back
              </button>
            )}
            <button
              onClick={next}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-md transition-colors"
            >
              {step < steps.length - 1 ? (
                <>Next <ArrowRight className="h-3 w-3" /></>
              ) : (
                "Got it!"
              )}
            </button>
          </div>
        </div>

        {/* Step dots */}
        <div className="flex justify-center gap-1 pb-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === step ? "w-4 bg-primary" : i < step ? "w-1.5 bg-primary/40" : "w-1.5 bg-border"
              }`}
            />
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Small help button that lets users replay a tour */
export function TourReplayButton({ tourId, steps, label }: { tourId: string; steps: TourStep[]; label?: string }) {
  const [showTour, setShowTour] = useState(false);

  const replay = () => {
    localStorage.removeItem(`tour_completed_${tourId}`);
    setShowTour(true);
  };

  return (
    <>
      <button
        onClick={replay}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
        title={label || "Replay tour"}
      >
        <HelpCircle className="h-3.5 w-3.5" />
        {label || "How to use this page"}
      </button>
      {showTour && (
        <ProductTour
          tourId={tourId}
          steps={steps}
          onComplete={() => setShowTour(false)}
        />
      )}
    </>
  );
}
