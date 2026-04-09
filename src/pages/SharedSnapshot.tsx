import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, Quote, TrendingUp, TrendingDown, Minus, Shuffle, Clock, Calendar, Sparkles, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SnapshotTheme {
  title: string;
  description: string | null;
  confidence_score: number | null;
  evidence: { sentiment?: string; quotes?: string[] } | null;
}

interface SnapshotData {
  title: string;
  summary: string | null;
  type: string;
  duration_minutes: number | null;
  scheduled_date: string | null;
  created_at: string;
  share_views: number;
  workspace: {
    name: string;
    logo_url: string | null;
    brand_primary_color: string | null;
    brand_accent_color: string | null;
  };
  themes: SnapshotTheme[];
}

const sentimentConfig = {
  positive: { icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-500/10" },
  negative: { icon: TrendingDown, color: "text-red-600", bg: "bg-red-500/10" },
  neutral: { icon: Minus, color: "text-muted-foreground", bg: "bg-muted" },
  mixed: { icon: Shuffle, color: "text-amber-600", bg: "bg-amber-500/10" },
};

export default function SharedSnapshot() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<SnapshotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) return;
    supabase
      .rpc("get_shared_snapshot", { token })
      .then(({ data: result, error: err }) => {
        if (err || !result) {
          setError(true);
        } else {
          setData(result as unknown as SnapshotData);
        }
        setLoading(false);
      });
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-full max-w-3xl mx-auto p-6 space-y-6">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <h1 className="text-2xl font-bold text-foreground">Snapshot Not Found</h1>
          <p className="text-muted-foreground">This shared link may have expired or is invalid.</p>
        </div>
      </div>
    );
  }

  const primaryColor = data.workspace.brand_primary_color || "#6366f1";

  return (
    <div className="min-h-screen bg-background print:bg-white">
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        {/* Header */}
        <header className="space-y-4">
          <div className="flex items-center gap-3">
            {data.workspace.logo_url ? (
              <img
                src={data.workspace.logo_url}
                alt={data.workspace.name}
                className="h-8 w-auto max-w-[120px] object-contain"
              />
            ) : (
              <div
                className="h-8 w-8 rounded-md flex items-center justify-center text-sm font-bold text-white"
                style={{ backgroundColor: primaryColor }}
              >
                {data.workspace.name.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-sm font-medium text-muted-foreground">{data.workspace.name}</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">{data.title}</h1>

          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
            {data.scheduled_date && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {data.scheduled_date}
              </span>
            )}
            {data.duration_minutes && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {data.duration_minutes} min
              </span>
            )}
            <Badge variant="outline" className="text-xs capitalize">{data.type.replace("_", " ")}</Badge>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="print:hidden"
            onClick={() => window.print()}
          >
            <Printer className="h-3.5 w-3.5 me-1.5" />
            Export PDF
          </Button>
        </header>

        {/* Summary */}
        {data.summary && (
          <section>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-3">
              <Sparkles className="h-4.5 w-4.5" style={{ color: primaryColor }} />
              Executive Summary
            </h2>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {data.summary}
                </p>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Themes */}
        {data.themes.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-foreground mb-3">
              Key Themes ({data.themes.length})
            </h2>
            <div className="space-y-3">
              {data.themes.map((theme, idx) => (
                <ThemeCard key={idx} theme={theme} primaryColor={primaryColor} />
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="border-t pt-6 text-center print:mt-12">
          <p className="text-xs text-muted-foreground">
            Research snapshot powered by{" "}
            <a
              href="/"
              className="font-semibold hover:underline"
              style={{ color: primaryColor }}
              target="_blank"
              rel="noopener noreferrer"
            >
              InsightForge
            </a>
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            {data.share_views} view{data.share_views !== 1 ? "s" : ""}
          </p>
        </footer>
      </div>
    </div>
  );
}

function ThemeCard({ theme, primaryColor }: { theme: SnapshotTheme; primaryColor: string }) {
  const [open, setOpen] = useState(false);
  const confidence = Math.round((theme.confidence_score || 0) * 100);
  const sentiment = theme.evidence?.sentiment || "neutral";
  const quotes = theme.evidence?.quotes || [];
  const sc = sentimentConfig[sentiment as keyof typeof sentimentConfig] || sentimentConfig.neutral;
  const SentimentIcon = sc.icon;

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <CardContent className="p-4 cursor-pointer hover:bg-accent/50 transition-colors">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold">{theme.title}</span>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${sc.bg} ${sc.color} border-0`}>
                    <SentimentIcon className="h-2.5 w-2.5 me-0.5" />
                    {sentiment}
                  </Badge>
                </div>
                {theme.description && (
                  <p className="text-xs text-muted-foreground mt-1.5 line-clamp-3">{theme.description}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <Progress value={confidence} className="h-1.5 flex-1 max-w-[120px]" />
                  <span className="text-[10px] text-muted-foreground">{confidence}% confidence</span>
                </div>
              </div>
              {quotes.length > 0 && (
                <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
              )}
            </div>
          </CardContent>
        </CollapsibleTrigger>
        {quotes.length > 0 && (
          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-2 border-t pt-3">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Supporting Quotes
              </p>
              {quotes.map((q, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <Quote className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground italic">"{q}"</p>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        )}
      </Collapsible>
    </Card>
  );
}
