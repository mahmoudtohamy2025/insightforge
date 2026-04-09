import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";

interface ComparisonPair {
  segment_name: string;
  real_sentiment: number | null;
  twin_sentiment: number | null;
  accuracy: number;
}

interface AccuracyChartProps {
  data: ComparisonPair[];
}

export function AccuracyChart({ data }: AccuracyChartProps) {
  if (!data.length) return null;

  const chartData = data
    .filter(d => d.real_sentiment !== null || d.twin_sentiment !== null)
    .map(d => ({
      name: d.segment_name.length > 15 ? d.segment_name.substring(0, 15) + "…" : d.segment_name,
      "Real Data": d.real_sentiment !== null ? Math.round(d.real_sentiment * 100) / 100 : 0,
      "Twin Prediction": d.twin_sentiment !== null ? Math.round(d.twin_sentiment * 100) / 100 : 0,
      accuracy: Math.round(d.accuracy * 100),
    }));

  if (!chartData.length) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        No sentiment comparison data available yet. Upload real survey data to see a comparison.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} barGap={4} barCategoryGap="20%">
        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11 }}
          className="text-muted-foreground"
        />
        <YAxis
          domain={[-1, 1]}
          tick={{ fontSize: 11 }}
          label={{ value: "Sentiment", angle: -90, position: "insideLeft", style: { fontSize: 11 } }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            fontSize: 12,
          }}
          formatter={(value: number, name: string) => [
            value.toFixed(2),
            name,
          ]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
        <Bar
          dataKey="Real Data"
          fill="hsl(var(--primary))"
          radius={[4, 4, 0, 0]}
          opacity={0.8}
        />
        <Bar
          dataKey="Twin Prediction"
          fill="hsl(280 80% 60%)"
          radius={[4, 4, 0, 0]}
          opacity={0.8}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Trend Chart ──

interface TrendPoint {
  month: string;
  avg_accuracy: number;
  entry_count: number;
}

interface AccuracyTrendChartProps {
  data: TrendPoint[];
}

export function AccuracyTrendChart({ data }: AccuracyTrendChartProps) {
  if (!data.length) return null;

  const chartData = data.map(d => ({
    month: d.month,
    "Accuracy %": Math.round(d.avg_accuracy * 100),
    Entries: d.entry_count,
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            fontSize: 12,
          }}
        />
        <Bar
          dataKey="Accuracy %"
          fill="hsl(var(--primary))"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
