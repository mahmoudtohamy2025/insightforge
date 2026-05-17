import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Brain, Sparkles, Share2, Twitter, Linkedin, Zap, User,
  RefreshCw, MessageSquare, ChevronRight, Loader2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface TwinProfile {
  archetype: string;
  archetype_description: string;
  traits: { name: string; score: number; description: string }[];
  calibration_score: number;
  last_updated: string;
  insights: string[];
}

// Simulated "Ask Your Twin" responses based on query + traits
function generateTwinResponse(query: string, traits: { name: string; score: number }[]): string {
  const dominant = [...traits].sort((a, b) => b.score - a.score)[0];
  const responses: Record<string, string[]> = {
    default: [
      `Based on your personality profile, your twin would likely approach "${query}" with careful consideration and a balanced perspective.`,
      `Your AI twin, given its current calibration, would respond to "${query}" by weighing multiple factors before forming an opinion.`,
      `Your twin would engage with "${query}" based on its dominant traits — exploring different angles before settling on a view.`,
    ],
    Analytical: [
      `Your twin would approach "${query}" very analytically — gathering data, evaluating evidence, and forming a logical conclusion before committing to any view.`,
    ],
    Creative: [
      `Your creative twin would approach "${query}" with imaginative thinking — looking for unconventional angles and novel solutions others might miss.`,
    ],
    Empathetic: [
      `Your empathetic twin would consider "${query}" from the human perspective first — thinking about how different people are affected before forming a view.`,
    ],
    Pragmatic: [
      `Your pragmatic twin would cut through the noise on "${query}" and focus on what's practical, actionable, and realistic given current constraints.`,
    ],
  };

  const pool = dominant ? (responses[dominant.name] || responses.default) : responses.default;
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function MyTwin() {
  const { user } = useAuth();
  const [question, setQuestion] = useState("");
  const [twinResponse, setTwinResponse] = useState<string | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const shareText = "Check out my InsightForge AI Twin! I've helped shape the future of products through digital twin simulations. 🧬🚀 #InsightForge";
  const shareUrl = "https://insightforge.app/participate";

  const { data, isLoading } = useQuery({
    queryKey: ["participant-twin-preview", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("participant-twin-preview");
      if (error) throw error;
      return data as { twin: TwinProfile | null };
    },
    enabled: !!user,
  });

  const twin = data?.twin;

  const handleAsk = () => {
    if (!question.trim()) {
      toast({ title: "Enter a question first", variant: "destructive" });
      return;
    }
    setIsAsking(true);
    setTwinResponse(null);
    // Simulate AI thinking
    setTimeout(() => {
      const response = twin?.traits
        ? generateTwinResponse(question, twin.traits)
        : `Your twin would approach "${question}" with its unique perspective based on your calibration profile.`;
      setTwinResponse(response);
      setIsAsking(false);
    }, 1500);
  };

  const openTwitter = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, "_blank");
  };
  const openLinkedIn = () => {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, "_blank");
  };
  const handleNativeShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: "My InsightForge AI Twin", text: shareText, url: shareUrl });
    } else {
      navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      toast({ title: "Copied to clipboard!" });
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" />
          My AI Twin
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your digital twin is calibrated from your study responses and profile. It evolves with each study you complete.
        </p>
      </div>

      {!twin ? (
        <Card className="border-primary/20">
          <CardContent className="py-12 text-center space-y-4">
            <div className="h-20 w-20 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
              <Brain className="h-10 w-10 text-primary/60" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Your Twin is Being Calibrated</h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">
                Complete your first study to start building your AI Twin. Each study you complete makes it more accurate.
              </p>
            </div>
            <Button variant="outline" asChild>
              <a href="/participate/studies">Browse Studies <ChevronRight className="h-4 w-4 ms-1" /></a>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Archetype Card */}
          <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.04] to-purple-500/[0.03]">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center shrink-0">
                  <User className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your Archetype</p>
                  <h2 className="text-xl font-bold mt-1">{twin.archetype}</h2>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{twin.archetype_description}</p>
                </div>
              </div>

              {/* Calibration score */}
              <div className="flex items-center gap-3 pt-1">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-purple-500 rounded-full"
                    style={{ width: `${twin.calibration_score}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-primary">{twin.calibration_score}%</span>
                <span className="text-xs text-muted-foreground">Calibrated</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Complete more studies to increase your twin's accuracy. Last updated:{" "}
                {new Date(twin.last_updated).toLocaleDateString()}.
              </p>
            </CardContent>
          </Card>

          {/* Personality Traits */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Personality Traits
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {twin.traits.map(trait => (
                <div key={trait.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{trait.name}</span>
                    <span className="text-xs text-muted-foreground">{trait.score}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60"
                      style={{ width: `${trait.score}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{trait.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* 🆕 Ask Your Twin */}
          <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.04] to-transparent">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                Ask Your Twin
                <Badge className="ml-auto text-xs bg-primary/10 text-primary border-primary/20">New ✨</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Curious how your digital twin would respond to a product or idea? Ask it a question.
              </p>
              <Textarea
                placeholder="e.g. Would you buy a $30/month AI assistant subscription?"
                value={question}
                onChange={e => setQuestion(e.target.value)}
                rows={3}
                className="resize-none"
              />
              <Button onClick={handleAsk} disabled={isAsking} className="w-full">
                {isAsking ? (
                  <><Loader2 className="h-4 w-4 me-2 animate-spin" /> Consulting your twin...</>
                ) : (
                  <><Zap className="h-4 w-4 me-2" /> Ask My Twin</>
                )}
              </Button>

              {twinResponse && (
                <div className="rounded-lg border border-primary/20 bg-primary/[0.04] p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                    <Brain className="h-3.5 w-3.5" /> Your Twin says:
                  </div>
                  <p className="text-sm leading-relaxed">{twinResponse}</p>
                  <p className="text-xs text-muted-foreground italic">
                    This is a simulation based on your calibration profile. Complete more studies for higher accuracy.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Insights */}
          {twin.insights && twin.insights.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  Twin Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {twin.insights.map((insight, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                      {insight}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Recalibrate & Share */}
          <Card>
            <CardContent className="py-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Recalibrate Your Twin</p>
                  <p className="text-xs text-muted-foreground">Complete more studies to update your twin's model</p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a href="/participate/studies">
                    <RefreshCw className="h-3.5 w-3.5 me-1.5" /> Find Studies
                  </a>
                </Button>
              </div>
              <div className="h-px bg-border" />
              <div>
                <p className="text-sm font-medium mb-3">Share Your Twin</p>
                <div className="flex flex-wrap gap-2">
                  {navigator.share && (
                    <Button variant="default" size="sm" onClick={handleNativeShare}>
                      <Share2 className="h-3.5 w-3.5 me-1.5" /> Share
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={openTwitter} className="hover:text-blue-400">
                    <Twitter className="h-3.5 w-3.5 me-1.5" /> Twitter / X
                  </Button>
                  <Button variant="outline" size="sm" onClick={openLinkedIn} className="hover:text-blue-700">
                    <Linkedin className="h-3.5 w-3.5 me-1.5" /> LinkedIn
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
