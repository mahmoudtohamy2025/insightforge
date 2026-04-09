interface EarningsSparklineProps {
  data: { date: string; amount_cents: number }[];
  height?: number;
}

export function EarningsSparkline({ data, height = 40 }: EarningsSparklineProps) {
  if (!data || data.length < 2) {
    return (
      <div className="flex items-center justify-center h-10 text-xs text-muted-foreground/50">
        No earnings history yet
      </div>
    );
  }

  const width = 200;
  const padding = 4;
  const values = data.map((d) => d.amount_cents);
  const max = Math.max(...values, 1);
  const min = Math.min(...values);

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = padding + ((max - d.amount_cents) / (max - min + 1)) * (height - padding * 2);
    return `${x},${y}`;
  });

  const polyline = points.join(" ");
  const lastPoint = points[points.length - 1].split(",");

  // Total earned last 30 days
  const totalCents = values.reduce((s, v) => s + v, 0);
  const totalDollars = (totalCents / 100).toFixed(2);

  return (
    <div className="flex items-center gap-3">
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          <linearGradient id="sparkGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Filled area */}
        <polyline
          points={`${points[0].split(",")[0]},${height} ${polyline} ${lastPoint[0]},${height}`}
          fill="url(#sparkGrad)"
          stroke="none"
        />
        {/* Line */}
        <polyline
          points={polyline}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Last point dot */}
        <circle
          cx={Number(lastPoint[0])}
          cy={Number(lastPoint[1])}
          r="3"
          fill="hsl(var(--primary))"
        />
      </svg>
      <div className="text-right shrink-0">
        <p className="text-xs font-semibold text-foreground">${totalDollars}</p>
        <p className="text-[10px] text-muted-foreground">30 days</p>
      </div>
    </div>
  );
}
