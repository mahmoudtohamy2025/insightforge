import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Activity, Loader2, Upload, CheckCircle2 } from "lucide-react";

interface CalibrationPanelProps {
  segmentId: string;
  workspaceId: string;
  calibrationScore: number | null;
}

export const CalibrationPanel = ({ segmentId, workspaceId, calibrationScore }: CalibrationPanelProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [sourceType, setSourceType] = useState("manual");
  const [responseText, setResponseText] = useState("");
  const [sentiment, setSentiment] = useState("0");

  // Fetch calibration data count
  const { data: calCount = 0 } = useQuery({
    queryKey: ["calibration-count", segmentId],
    queryFn: async () => {
      const { count } = await supabase
        .from("calibration_data")
        .select("*", { count: "exact", head: true })
        .eq("segment_id", segmentId);
      return count || 0;
    },
    enabled: !!segmentId,
  });

  const calibrateMutation = useMutation({
    mutationFn: async () => {
      const response = await supabase.functions.invoke("calibrate-segment", {
        body: {
          segment_id: segmentId,
          workspace_id: workspaceId,
          real_responses: [{
            text: responseText,
            sentiment: parseFloat(sentiment),
            source_type: sourceType,
            themes: [],
          }],
        },
      });
      if (response.error) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["segment-profiles", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["calibration-count", segmentId] });
      setOpen(false);
      setResponseText("");
      setSentiment("0");
      toast({
        title: "Calibration updated",
        description: `Accuracy: ${Math.round((data.calibration_score || 0) * 100)}% (${data.total_calibration_entries} samples)`,
      });
    },
    onError: (e) => toast({ title: "Calibration failed", description: e.message, variant: "destructive" }),
  });

  const score = calibrationScore || 0;
  const scorePercent = Math.round(score * 100);
  const scoreColor = score < 0.3 ? "text-red-400" : score < 0.6 ? "text-amber-400" : "text-emerald-400";
  const barColor = score < 0.3 ? "bg-red-500" : score < 0.6 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="flex items-center gap-2 pt-1.5">
      {/* Mini gauge */}
      <div className="flex items-center gap-1.5 flex-1">
        <Activity className={`h-3 w-3 ${scoreColor}`} />
        <div className="flex-1 bg-muted rounded-full h-1.5">
          <div className={`${barColor} rounded-full h-1.5 transition-all`} style={{ width: `${Math.max(scorePercent, 3)}%` }} />
        </div>
        <span className={`text-[9px] font-mono ${scoreColor}`}>{scorePercent}%</span>
      </div>

      {/* Calibrate button */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]">
            <Upload className="h-3 w-3 mr-1" />
            Calibrate
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Calibrate Segment</DialogTitle>
            <DialogDescription>
              Feed real consumer response data to improve twin accuracy. {calCount > 0 && `(${calCount} samples so far)`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Source Type</Label>
              <Select value={sourceType} onValueChange={setSourceType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual Entry</SelectItem>
                  <SelectItem value="survey">Survey Response</SelectItem>
                  <SelectItem value="session">Session Transcript</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Real Consumer Response</Label>
              <Textarea
                rows={3}
                placeholder="Paste a real consumer response here..."
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Real Sentiment (-1 to 1)</Label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.1"
                  value={sentiment}
                  onChange={(e) => setSentiment(e.target.value)}
                  className="flex-1"
                />
                <span className="text-xs font-mono w-8 text-right">{parseFloat(sentiment).toFixed(1)}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => calibrateMutation.mutate()} disabled={!responseText.trim() || calibrateMutation.isPending}>
              {calibrateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Submit Calibration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {calCount > 0 && (
        <Badge variant="secondary" className="text-[8px] h-4 px-1">{calCount} pts</Badge>
      )}
    </div>
  );
};
