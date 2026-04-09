import { useI18n } from "@/lib/i18n";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Copy, Quote, TrendingUp, TrendingDown, Minus, Shuffle } from "lucide-react";
import { toast } from "sonner";

interface EvidenceQuote {
  quote: string;
  session_title: string;
}

interface PatternDetail {
  id: string;
  title: string;
  description: string | null;
  sentiment: string;
  session_count: number;
  theme_ids: string[];
  evidence_quotes: EvidenceQuote[];
  created_at: string;
}

interface PatternDetailDialogProps {
  pattern: PatternDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalSessions: number;
}

const sentimentConfig: Record<string, { icon: typeof TrendingUp; label: string; color: string; bg: string }> = {
  positive: { icon: TrendingUp, label: "Positive", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
  negative: { icon: TrendingDown, label: "Negative", color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10" },
  neutral: { icon: Minus, label: "Neutral", color: "text-muted-foreground", bg: "bg-muted" },
  mixed: { icon: Shuffle, label: "Mixed", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
};

export function PatternDetailDialog({ pattern, open, onOpenChange, totalSessions }: PatternDetailDialogProps) {
  const { t } = useI18n();

  if (!pattern) return null;

  const sc = sentimentConfig[pattern.sentiment] || sentimentConfig.neutral;
  const SentimentIcon = sc.icon;
  const quotes = pattern.evidence_quotes || [];

  // Group quotes by session
  const groupedBySession = quotes.reduce<Record<string, EvidenceQuote[]>>((acc, q) => {
    const key = q.session_title || "Unknown Session";
    if (!acc[key]) acc[key] = [];
    acc[key].push(q);
    return acc;
  }, {});

  const sessionNames = Object.keys(groupedBySession);

  const handleCopyPattern = async () => {
    const lines: string[] = [
      `**Pattern: ${pattern.title}**`,
      pattern.description || "",
      "",
      `**Sentiment:** ${pattern.sentiment} | **Sessions:** ${pattern.session_count} of ${totalSessions}`,
      "",
      "**Evidence:**",
    ];

    quotes.forEach((q) => {
      lines.push(`• "${q.quote}" — ${q.session_title}`);
    });

    lines.push("", "---", `*Source: InsightForge*`);

    await navigator.clipboard.writeText(lines.join("\n"));
    toast.success(t("insights.patternCopied"));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <DialogTitle className="text-lg leading-snug">{pattern.title}</DialogTitle>
            <Button variant="outline" size="sm" onClick={handleCopyPattern} className="shrink-0">
              <Copy className="h-3.5 w-3.5 me-1.5" />
              {t("insights.copyPattern")}
            </Button>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className={`text-xs px-2 py-0.5 border-0 ${sc.bg} ${sc.color}`}>
              <SentimentIcon className="h-3 w-3 me-1" />
              {sc.label}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {t("insights.foundInSessions")
                .replace("{count}", String(pattern.session_count))
                .replace("{total}", String(totalSessions))}
            </span>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {pattern.description && (
            <p className="text-sm text-muted-foreground mb-4">{pattern.description}</p>
          )}

          {sessionNames.length > 0 && (
            <>
              <Separator className="mb-4" />
              <h4 className="text-sm font-semibold mb-3">{t("insights.contributingSessions")}</h4>
              <div className="space-y-4">
                {sessionNames.map((sessionTitle) => (
                  <div key={sessionTitle}>
                    <p className="text-xs font-medium text-foreground mb-1.5">{sessionTitle}</p>
                    <div className="space-y-1.5 ps-3 border-s-2 border-primary/20">
                      {groupedBySession[sessionTitle].map((q, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <Quote className="h-3 w-3 text-primary/60 shrink-0 mt-0.5" />
                          <span className="text-muted-foreground italic">"{q.quote}"</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {quotes.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">{t("insights.noEvidence")}</p>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
