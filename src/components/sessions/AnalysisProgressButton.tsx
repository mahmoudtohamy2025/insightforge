import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const STAGES = [
  { key: "sessionDetail.analysisStage1", duration: 3000 },
  { key: "sessionDetail.analysisStage2", duration: 4000 },
  { key: "sessionDetail.analysisStage3", duration: 3000 },
];

const TOTAL_DURATION = STAGES.reduce((sum, s) => sum + s.duration, 0);

interface AnalysisProgressButtonProps {
  isPending: boolean;
  hasThemes: boolean;
  onAnalyze: () => void;
}

export function AnalysisProgressButton({ isPending, hasThemes, onAnalyze }: AnalysisProgressButtonProps) {
  const { t } = useI18n();
  const [stageIndex, setStageIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isPending) {
      setStageIndex(0);
      setProgress(0);
      return;
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      // Progress caps at 90% — the last 10% fills on completion
      const pct = Math.min((elapsed / TOTAL_DURATION) * 90, 90);
      setProgress(pct);

      let accumulated = 0;
      for (let i = 0; i < STAGES.length; i++) {
        accumulated += STAGES[i].duration;
        if (elapsed < accumulated) {
          setStageIndex(i);
          break;
        }
        if (i === STAGES.length - 1) setStageIndex(i);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [isPending]);

  if (isPending) {
    return (
      <div className="flex flex-col gap-1.5 min-w-[200px]">
        <Button size="sm" disabled className="w-full">
          <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />
          {t(STAGES[stageIndex].key)}
        </Button>
        <Progress value={progress} className="h-1.5" />
      </div>
    );
  }

  return (
    <Button size="sm" onClick={onAnalyze}>
      <Sparkles className="h-3.5 w-3.5 me-1.5" />
      {hasThemes ? t("sessionDetail.reanalyze") : t("sessionDetail.analyzeWithAI")}
    </Button>
  );
}
