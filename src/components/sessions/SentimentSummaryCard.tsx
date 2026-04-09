import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, Shuffle } from "lucide-react";

interface SentimentSummary {
  overall: string;
  score: number;
  distribution: {
    positive: number;
    negative: number;
    neutral: number;
    mixed: number;
  };
  interpretation: string;
}

const sentimentConfig = {
  positive: { icon: TrendingUp, color: "text-emerald-600 dark:text-emerald-400", barColor: "bg-emerald-500" },
  negative: { icon: TrendingDown, color: "text-red-600 dark:text-red-400", barColor: "bg-red-500" },
  neutral: { icon: Minus, color: "text-muted-foreground", barColor: "bg-muted-foreground" },
  mixed: { icon: Shuffle, color: "text-amber-600 dark:text-amber-400", barColor: "bg-amber-500" },
};

export function SentimentSummaryCard({ sentiment }: { sentiment: SentimentSummary }) {
  const { t } = useI18n();
  const sc = sentimentConfig[sentiment.overall as keyof typeof sentimentConfig] || sentimentConfig.neutral;
  const Icon = sc.icon;

  const bars = [
    { key: "positive", pct: sentiment.distribution.positive, color: "bg-emerald-500" },
    { key: "negative", pct: sentiment.distribution.negative, color: "bg-red-500" },
    { key: "neutral", pct: sentiment.distribution.neutral, color: "bg-muted-foreground/50" },
    { key: "mixed", pct: sentiment.distribution.mixed, color: "bg-amber-500" },
  ].filter((b) => b.pct > 0);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${sc.color}`} />
          <span className={`text-sm font-semibold ${sc.color}`}>
            {t(`sessionDetail.sentiment.${sentiment.overall}`)}
          </span>
          <span className="text-xs text-muted-foreground ms-auto">
            {t("sessionDetail.sentimentScore")}: {Math.round(sentiment.score * 100)}%
          </span>
        </div>

        {/* Distribution bar */}
        <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
          {bars.map((b) => (
            <div
              key={b.key}
              className={`${b.color} rounded-full`}
              style={{ width: `${Math.max(b.pct * 100, 2)}%` }}
              title={`${t(`sessionDetail.sentiment.${b.key}`)}: ${Math.round(b.pct * 100)}%`}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
          {bars.map((b) => (
            <span key={b.key} className="flex items-center gap-1">
              <span className={`h-2 w-2 rounded-full ${b.color}`} />
              {t(`sessionDetail.sentiment.${b.key}`)} {Math.round(b.pct * 100)}%
            </span>
          ))}
        </div>

        {/* Interpretation */}
        {sentiment.interpretation && (
          <p className="text-xs text-muted-foreground italic">{sentiment.interpretation}</p>
        )}
      </CardContent>
    </Card>
  );
}
