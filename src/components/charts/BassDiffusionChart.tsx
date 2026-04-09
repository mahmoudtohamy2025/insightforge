/**
 * BassDiffusionChart — Extracted from MarketSimStudio.
 * Renders an SVG adoption S-curve (cumulative) with a dashed bell curve (new adopters per month).
 */
interface AdoptionDataPoint {
  month: number;
  new_adopters: number;
  cumulative_adopters: number;
}

interface Props {
  data: AdoptionDataPoint[];
  width?: number;
  height?: number;
}

export function BassDiffusionChart({ data, width = 640, height = 280 }: Props) {
  if (!data?.length) return null;

  const padding = { top: 24, right: 16, bottom: 40, left: 56 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const maxVal = Math.max(...data.map(d => d.cumulative_adopters));
  const maxNew = Math.max(...data.map(d => d.new_adopters));

  const cx = (i: number) => padding.left + (i / (data.length - 1)) * chartW;
  const cy = (v: number) => padding.top + chartH - (v / maxVal) * chartH;
  const cyNew = (v: number) => padding.top + chartH - (v / (maxNew * 1.5)) * chartH;

  // S-curve path (cumulative)
  const curvePath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${cx(i).toFixed(1)} ${cy(d.cumulative_adopters).toFixed(1)}`).join(" ");
  // Bell curve path (new adopters)
  const bellPath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${cx(i).toFixed(1)} ${cyNew(d.new_adopters).toFixed(1)}`).join(" ");

  // Y-axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(pct => ({
    val: Math.round(maxVal * pct),
    y: cy(maxVal * pct),
  }));

  // X-axis ticks (every 3-6 months)
  const step = data.length <= 12 ? 3 : data.length <= 24 ? 6 : 12;
  const xTicks = data.filter((_, i) => i % step === 0 || i === data.length - 1);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ maxHeight: height }}>
      {/* Grid lines */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={padding.left} y1={t.y} x2={width - padding.right} y2={t.y} stroke="currentColor" strokeOpacity="0.07" />
          <text x={padding.left - 8} y={t.y + 4} textAnchor="end" className="fill-muted-foreground" style={{ fontSize: 9 }}>
            {t.val >= 1000000 ? `${(t.val / 1000000).toFixed(1)}M` : t.val >= 1000 ? `${(t.val / 1000).toFixed(0)}K` : t.val}
          </text>
        </g>
      ))}

      {/* X-axis labels */}
      {xTicks.map((d, i) => (
        <text key={i} x={cx(d.month - 1)} y={height - 8} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 9 }}>
          M{d.month}
        </text>
      ))}

      {/* Bell curve (new adopters) — dashed, muted */}
      <path d={bellPath} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeDasharray="4 3" strokeOpacity="0.4" />

      {/* S-curve (cumulative) — solid, bold */}
      <path d={curvePath} fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round" />

      {/* Legend */}
      <line x1={padding.left + 8} y1={14} x2={padding.left + 30} y2={14} stroke="hsl(var(--primary))" strokeWidth="2.5" />
      <text x={padding.left + 34} y={17} className="fill-foreground" style={{ fontSize: 9 }}>Cumulative</text>
      <line x1={padding.left + 108} y1={14} x2={padding.left + 130} y2={14} stroke="hsl(var(--primary))" strokeWidth="1.5" strokeDasharray="4 3" strokeOpacity="0.5" />
      <text x={padding.left + 134} y={17} className="fill-muted-foreground" style={{ fontSize: 9 }}>New/month</text>
    </svg>
  );
}
