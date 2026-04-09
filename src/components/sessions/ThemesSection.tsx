import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Quote, TrendingUp, TrendingDown, Minus, Shuffle, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Theme {
  id: string;
  title: string;
  description: string | null;
  confidence_score: number | null;
  evidence: any;
}

const sentimentConfig = {
  positive: { icon: TrendingUp, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
  negative: { icon: TrendingDown, color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10" },
  neutral: { icon: Minus, color: "text-muted-foreground", bg: "bg-muted" },
  mixed: { icon: Shuffle, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
};

function useCopyFeedback() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copy = (text: string, id: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success(label);
    setTimeout(() => setCopiedId(null), 2000);
  };
  return { copiedId, copy };
}

export function ThemesSection({ themes }: { themes: Theme[] }) {
  const { t } = useI18n();

  if (themes.length === 0) return null;

  return (
    <div className="space-y-3 mt-6">
      <h3 className="text-sm font-semibold text-foreground">
        {t("sessionDetail.themes")} ({themes.length})
      </h3>
      <div className="space-y-2">
        {themes.map((theme) => (
          <ThemeCard key={theme.id} theme={theme} />
        ))}
      </div>
    </div>
  );
}

function ThemeCard({ theme }: { theme: Theme }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const { copiedId, copy } = useCopyFeedback();
  const confidence = Math.round((theme.confidence_score || 0) * 100);
  const evidence = theme.evidence as { sentiment?: string; quotes?: string[] } | null;
  const sentiment = evidence?.sentiment || "neutral";
  const quotes = evidence?.quotes || [];
  const sc = sentimentConfig[sentiment as keyof typeof sentimentConfig] || sentimentConfig.neutral;
  const SentimentIcon = sc.icon;

  const buildThemeMarkdown = () => {
    const lines = [`**${theme.title}**`];
    if (theme.description) lines.push(theme.description);
    lines.push(`Sentiment: ${t(`sessionDetail.sentiment.${sentiment}`)} · Confidence: ${confidence}%`);
    if (quotes.length > 0) {
      lines.push("");
      quotes.slice(0, 3).forEach((q) => lines.push(`> "${q}"`));
    }
    return lines.join("\n");
  };

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <CardContent className="p-3 cursor-pointer hover:bg-accent/50 transition-colors">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{theme.title}</span>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${sc.bg} ${sc.color} border-0`}>
                    <SentimentIcon className="h-2.5 w-2.5 me-0.5" />
                    {t(`sessionDetail.sentiment.${sentiment}`)}
                  </Badge>
                </div>
                {theme.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{theme.description}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <Progress value={confidence} className="h-1.5 flex-1 max-w-[120px]" />
                  <span className="text-[10px] text-muted-foreground">{confidence}%</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    copy(buildThemeMarkdown(), `theme-${theme.id}`, t("sessionDetail.themeCopied"));
                  }}
                >
                  {copiedId === `theme-${theme.id}` ? (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
                {quotes.length > 0 && (
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
                )}
              </div>
            </div>
          </CardContent>
        </CollapsibleTrigger>
        {quotes.length > 0 && (
          <CollapsibleContent>
            <div className="px-3 pb-3 space-y-2 border-t pt-2">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                {t("sessionDetail.keyQuotes")}
              </p>
              {quotes.map((q, i) => (
                <div key={i} className="flex gap-2 items-start group">
                  <Quote className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground italic flex-1">"{q}"</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={() => copy(`"${q}"`, `quote-${i}`, t("sessionDetail.quoteCopied"))}
                  >
                    {copiedId === `quote-${i}` ? (
                      <Check className="h-3 w-3 text-primary" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        )}
      </Collapsible>
    </Card>
  );
}
