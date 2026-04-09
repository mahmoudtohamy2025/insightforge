import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Upload, Loader2, Plus, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CalibrationUploaderProps {
  onCalibrated?: () => void;
}

export function CalibrationUploader({ onCalibrated }: CalibrationUploaderProps) {
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const workspaceId = currentWorkspace?.id;

  const [selectedSegmentId, setSelectedSegmentId] = useState("");
  const [responseText, setResponseText] = useState("");
  const [sentiment, setSentiment] = useState([0]);
  const [themes, setThemes] = useState("");
  const [sourceType, setSourceType] = useState<"survey" | "session" | "manual">("manual");

  // Load segments
  const { data: segments = [] } = useQuery({
    queryKey: ["segment-profiles", workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("segment_profiles")
        .select("id, name")
        .eq("workspace_id", workspaceId!)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!workspaceId,
  });

  const calibrateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("calibrate-segment", {
        body: {
          segment_id: selectedSegmentId,
          workspace_id: workspaceId,
          real_responses: [
            {
              text: responseText,
              sentiment: sentiment[0],
              themes: themes.split(",").map(t => t.trim()).filter(Boolean),
              source_type: sourceType,
            },
          ],
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Calibration recorded",
        description: `Accuracy score: ${Math.round((data.calibration_score || 0) * 100)}%`,
      });
      setResponseText("");
      setSentiment([0]);
      setThemes("");
      queryClient.invalidateQueries({ queryKey: ["validation-report"] });
      queryClient.invalidateQueries({ queryKey: ["segment-profiles"] });
      onCalibrated?.();
    },
    onError: (e) => {
      toast({
        title: "Calibration failed",
        description: e.message,
        variant: "destructive",
      });
    },
  });

  const sentimentLabel = sentiment[0] > 0.2 ? "Positive" : sentiment[0] < -0.2 ? "Negative" : "Neutral";
  const sentimentColor = sentiment[0] > 0.2 ? "text-emerald-500" : sentiment[0] < -0.2 ? "text-red-500" : "text-amber-500";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Upload className="h-4 w-4 text-primary" />
          Upload Real Data for Calibration
        </CardTitle>
        <CardDescription>
          Compare real survey or focus group responses against twin predictions to improve accuracy.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Segment Selection */}
        <div className="space-y-2">
          <Label className="text-sm">Target Segment</Label>
          <Select value={selectedSegmentId} onValueChange={setSelectedSegmentId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a segment to calibrate..." />
            </SelectTrigger>
            <SelectContent>
              {segments.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Source Type */}
        <div className="space-y-2">
          <Label className="text-sm">Data Source</Label>
          <div className="flex gap-2">
            {(["manual", "survey", "session"] as const).map((type) => (
              <Badge
                key={type}
                variant={sourceType === type ? "default" : "outline"}
                className="cursor-pointer capitalize"
                onClick={() => setSourceType(type)}
              >
                {type}
              </Badge>
            ))}
          </div>
        </div>

        {/* Response Text */}
        <div className="space-y-2">
          <Label className="text-sm">Real Response Text</Label>
          <Textarea
            rows={4}
            placeholder="Paste the actual consumer response from your survey or focus group..."
            value={responseText}
            onChange={(e) => setResponseText(e.target.value)}
            className="resize-none"
          />
        </div>

        {/* Sentiment Slider */}
        <div className="space-y-2">
          <Label className="text-sm">
            Real Sentiment{" "}
            <span className={`font-mono ${sentimentColor}`}>
              ({sentiment[0] > 0 ? "+" : ""}{sentiment[0].toFixed(2)} — {sentimentLabel})
            </span>
          </Label>
          <Slider
            value={sentiment}
            onValueChange={setSentiment}
            min={-1}
            max={1}
            step={0.05}
            className="py-2"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Very Negative</span>
            <span>Neutral</span>
            <span>Very Positive</span>
          </div>
        </div>

        {/* Themes */}
        <div className="space-y-2">
          <Label className="text-sm">Key Themes (comma-separated)</Label>
          <Textarea
            rows={2}
            placeholder="e.g., price sensitivity, brand loyalty, health concerns"
            value={themes}
            onChange={(e) => setThemes(e.target.value)}
            className="resize-none"
          />
        </div>

        {/* Submit */}
        <Button
          className="w-full"
          onClick={() => calibrateMutation.mutate()}
          disabled={!selectedSegmentId || !responseText.trim() || calibrateMutation.isPending}
        >
          {calibrateMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Calibrating...
            </>
          ) : calibrateMutation.isSuccess ? (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Recorded! Add Another
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Submit Calibration Entry
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
