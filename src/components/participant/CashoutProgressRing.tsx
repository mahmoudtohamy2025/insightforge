interface CashoutProgressRingProps {
  available: number;  // cents
  threshold?: number; // cents, default 500
}

export function CashoutProgressRing({ available, threshold = 500 }: CashoutProgressRingProps) {
  const size = 120;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(available / threshold, 1);
  const offset = circumference * (1 - pct);
  const dollarsAvailable = (available / 100).toFixed(2);
  const dollarsThreshold = (threshold / 100).toFixed(2);
  const remaining = Math.max(0, threshold - available);
  const remainingDollars = (remaining / 100).toFixed(2);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted/40"
          />
          {/* Progress arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={pct >= 1 ? "text-emerald-500" : "text-primary"}
            style={{ transition: "stroke-dashoffset 0.8s ease" }}
          />
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold leading-none">${dollarsAvailable}</span>
          <span className="text-[9px] text-muted-foreground uppercase tracking-wide mt-0.5">available</span>
        </div>
      </div>

      {pct < 1 ? (
        <p className="text-xs text-center text-muted-foreground">
          <span className="font-semibold text-foreground">${remainingDollars}</span> more to cash out
        </p>
      ) : (
        <p className="text-xs text-center text-emerald-600 dark:text-emerald-400 font-semibold">
          🎉 Ready to cash out!
        </p>
      )}
    </div>
  );
}
