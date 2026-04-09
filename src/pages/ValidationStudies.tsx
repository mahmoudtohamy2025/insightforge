import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useI18n } from "@/lib/i18n";
import { Link } from "react-router-dom";
import {
  GraduationCap,
  TrendingUp,
  Target,
  Database,
  BarChart3,
  Layers,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Info,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AccuracyChart, AccuracyTrendChart } from "@/components/validation/AccuracyChart";
import { CalibrationUploader } from "@/components/validation/CalibrationUploader";

const confidenceConfig = (score: number) => {
  if (score >= 0.8) return { color: "text-emerald-500", bg: "bg-emerald-500/10", label: "High", icon: ShieldCheck };
  if (score >= 0.6) return { color: "text-amber-500", bg: "bg-amber-500/10", label: "Medium", icon: Info };
  return { color: "text-red-500", bg: "bg-red-500/10", label: "Low", icon: AlertTriangle };
};

export default function ValidationStudies() {
  const { t } = useI18n();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const [showUploader, setShowUploader] = useState(false);

  const { data: report, isLoading, refetch } = useQuery({
    queryKey: ["validation-report", workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("validation-report", {
        body: { workspace_id: workspaceId },
      });
      if (error) throw error;
      return data;
    },
    enabled: !!workspaceId,
  });

  const globalAccuracy = report?.global_accuracy ?? 0;
  const totalEntries = report?.total_calibration_entries ?? 0;
  const totalSegments = report?.total_segments ?? 0;
  const segments = report?.segments ?? [];
  const trend = report?.trend ?? [];
  const dimensions = report?.dimensions ?? { sentiment: 0, themes: 0 };
  const comparisonPairs = report?.comparison_pairs ?? [];

  const conf = confidenceConfig(globalAccuracy);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto py-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <GraduationCap className="h-8 w-8 text-primary" />
            Validation Dashboard
          </h1>
          <p className="text-muted-foreground mt-2 max-w-3xl">
            Compare twin predictions against real survey and focus group data. Upload ground truth to
            continuously improve twin accuracy.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={showUploader ? "default" : "outline"}
            onClick={() => setShowUploader(!showUploader)}
          >
            <Database className="h-4 w-4 mr-2" />
            {showUploader ? "Hide Uploader" : "Upload Real Data"}
          </Button>
          <Link to="/methodology">
            <Button variant="ghost" size="sm">
              Methodology <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Uploader (collapsible) */}
      {showUploader && (
        <CalibrationUploader onCalibrated={() => refetch()} />
      )}

      {/* Empty State */}
      {!isLoading && totalEntries === 0 && (
        <Card className="border-dashed border-2 border-primary/20">
          <CardContent className="py-16 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold">No Calibration Data Yet</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Upload your first real survey or focus group response to start validating your digital
              twins. The more real data you provide, the more accurate your twins become.
            </p>
            <Button onClick={() => setShowUploader(true)}>
              <Database className="h-4 w-4 mr-2" />
              Upload First Calibration Entry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-10 w-24" /></CardHeader>
              <CardContent><Skeleton className="h-4 w-full" /></CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Metrics Cards */}
      {!isLoading && totalEntries > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Global Accuracy */}
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader className="pb-2">
                <CardDescription className="text-foreground font-medium flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5" />
                  Global Accuracy
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-2">
                  <span className={`text-4xl font-bold ${conf.color}`}>
                    {Math.round(globalAccuracy * 100)}%
                  </span>
                  <Badge className={`${conf.bg} ${conf.color} border-none mb-1`}>
                    {conf.label}
                  </Badge>
                </div>
                <Progress
                  value={globalAccuracy * 100}
                  className="h-1.5 mt-3"
                />
              </CardContent>
            </Card>

            {/* Total Entries */}
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="font-medium flex items-center gap-1.5">
                  <Database className="h-3.5 w-3.5" />
                  Calibration Entries
                </CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-4xl font-bold">{totalEntries}</span>
                <p className="text-xs text-muted-foreground mt-1">
                  Across {totalSegments} segments
                </p>
              </CardContent>
            </Card>

            {/* Sentiment Accuracy */}
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="font-medium flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Sentiment Accuracy
                </CardDescription>
              </CardHeader>
              <CardContent>
                <span className={`text-4xl font-bold ${confidenceConfig(dimensions.sentiment).color}`}>
                  {Math.round(dimensions.sentiment * 100)}%
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  How well twins match real sentiment
                </p>
              </CardContent>
            </Card>

            {/* Theme Accuracy */}
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="font-medium flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" />
                  Theme Accuracy
                </CardDescription>
              </CardHeader>
              <CardContent>
                <span className={`text-4xl font-bold ${confidenceConfig(dimensions.themes).color}`}>
                  {Math.round(dimensions.themes * 100)}%
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  How well twins identify real themes
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Comparison Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Twin vs. Real Sentiment
                </CardTitle>
                <CardDescription>
                  Side-by-side sentiment comparison per segment
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AccuracyChart data={comparisonPairs} />
              </CardContent>
            </Card>

            {/* Trend Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Accuracy Over Time
                </CardTitle>
                <CardDescription>
                  Monthly calibration accuracy trend
                </CardDescription>
              </CardHeader>
              <CardContent>
                {trend.length > 0 ? (
                  <AccuracyTrendChart data={trend} />
                ) : (
                  <div className="flex items-center justify-center h-60 text-muted-foreground text-sm">
                    Not enough data points for trend analysis yet.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Per-Segment Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Per-Segment Accuracy</CardTitle>
              <CardDescription>
                Calibration scores and entry counts for each digital twin segment.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Segment</TableHead>
                    <TableHead className="text-center">Calibration Score</TableHead>
                    <TableHead className="text-center">Avg Accuracy</TableHead>
                    <TableHead className="text-center">Entries</TableHead>
                    <TableHead className="text-center">Confidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {segments.map((seg: any) => {
                    const segConf = confidenceConfig(seg.avg_accuracy);
                    return (
                      <TableRow key={seg.segment_id}>
                        <TableCell className="font-medium">{seg.segment_name}</TableCell>
                        <TableCell className="text-center">
                          <span className="font-mono text-sm">
                            {Math.round(seg.calibration_score * 100)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`font-mono text-sm font-bold ${segConf.color}`}>
                            {Math.round(seg.avg_accuracy * 100)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{seg.entry_count}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={`${segConf.bg} ${segConf.color} border-none`}>
                            <segConf.icon className="h-3 w-3 mr-1" />
                            {segConf.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {segments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                        No segments with calibration data.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
