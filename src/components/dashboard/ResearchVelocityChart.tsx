import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import { TrendingUp, Loader2 } from "lucide-react";

interface ResearchVelocityChartProps {
  days: number;
}

const chartConfig = {
  sessions: { label: "Sessions", color: "hsl(var(--primary))" },
  surveys: { label: "Surveys", color: "hsl(262, 83%, 58%)" },
};

export function ResearchVelocityChart({ days }: ResearchVelocityChartProps) {
  const { currentWorkspace } = useWorkspace();
  const { t } = useI18n();
  const workspaceId = currentWorkspace?.id;

  const cutoff = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
  }, [days]);

  const { data: sessionsData } = useQuery({
    queryKey: ["velocity-sessions", workspaceId, days],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("created_at")
        .eq("workspace_id", workspaceId!)
        .gte("created_at", cutoff)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!workspaceId,
  });

  const { data: surveysData } = useQuery({
    queryKey: ["velocity-surveys", workspaceId, days],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("surveys")
        .select("created_at")
        .eq("workspace_id", workspaceId!)
        .gte("created_at", cutoff)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!workspaceId,
  });

  const chartData = useMemo(() => {
    // Group by week
    const weeks = new Map<string, { sessions: number; surveys: number }>();
    const now = new Date();
    const totalWeeks = Math.ceil(days / 7);

    for (let i = totalWeeks - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      weeks.set(key, { sessions: 0, surveys: 0 });
    }

    const getWeekKey = (dateStr: string) => {
      const d = new Date(dateStr);
      const diffDays = Math.floor((now.getTime() - d.getTime()) / (86400000));
      const weekIndex = totalWeeks - 1 - Math.floor(diffDays / 7);
      const keys = Array.from(weeks.keys());
      return keys[Math.max(0, Math.min(weekIndex, keys.length - 1))];
    };

    sessionsData?.forEach((s) => {
      const key = getWeekKey(s.created_at);
      if (key) {
        const entry = weeks.get(key);
        if (entry) entry.sessions++;
      }
    });

    surveysData?.forEach((s) => {
      const key = getWeekKey(s.created_at);
      if (key) {
        const entry = weeks.get(key);
        if (entry) entry.surveys++;
      }
    });

    return Array.from(weeks.entries()).map(([week, counts]) => ({
      week,
      ...counts,
    }));
  }, [sessionsData, surveysData, days]);

  const hasData = chartData.some((d) => d.sessions > 0 || d.surveys > 0);

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          {t("dashboard.researchVelocity") || "Research Velocity"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
            {t("dashboard.noActivityYet") || "No activity in this period"}
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[200px] w-full">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="fillSessions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-sessions)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-sessions)" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="fillSurveys" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-surveys)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-surveys)" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="week" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="sessions"
                stroke="var(--color-sessions)"
                fill="url(#fillSessions)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="surveys"
                stroke="var(--color-surveys)"
                fill="url(#fillSurveys)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
