import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import { BarChart3, Clock, CheckCircle2, PauseCircle } from "lucide-react";

const statusConfig = {
  draft: { label: "surveys.draft", variant: "secondary" as const, icon: Clock },
  live: { label: "surveys.live", variant: "default" as const, icon: BarChart3 },
  paused: { label: "surveys.paused", variant: "outline" as const, icon: PauseCircle },
  completed: { label: "surveys.completed", variant: "outline" as const, icon: CheckCircle2 },
  archived: { label: "surveys.completed", variant: "outline" as const, icon: CheckCircle2 },
};

export interface Survey {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  status: string;
  target_responses: number;
  response_count: number;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  launched_at: string | null;
  completed_at: string | null;
  paused_at: string | null;
}

export function SurveyCard({ survey }: { survey: Survey }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const config = statusConfig[survey.status as keyof typeof statusConfig] ?? statusConfig.draft;
  const StatusIcon = config.icon;
  const progress = survey.target_responses > 0
    ? (survey.response_count / survey.target_responses) * 100
    : 0;

  return (
    <Card className="hover:shadow-card-hover transition-shadow cursor-pointer" onClick={() => navigate(`/surveys/${survey.id}`)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-sm font-medium leading-snug">{survey.title}</CardTitle>
          <Badge variant={config.variant} className="shrink-0 ms-2">
            <StatusIcon className="h-3 w-3 me-1" />
            {t(config.label)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{survey.response_count} / {survey.target_responses} {t("surveys.responses")}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {survey.created_at ? new Date(survey.created_at).toLocaleDateString() : ""}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
