interface EarningsStreakBadgeProps {
  streakWeeks: number;
}

const STREAK_TIERS = [
  { weeks: 12, label: "Legend", emoji: "🔥", bonus: 15, color: "from-rose-500 to-orange-500" },
  { weeks: 8,  label: "On Fire", emoji: "⚡", bonus: 10, color: "from-amber-500 to-yellow-400" },
  { weeks: 4,  label: "Streaking", emoji: "🚀", bonus: 5,  color: "from-blue-500 to-cyan-400" },
  { weeks: 2,  label: "Building", emoji: "⭐", bonus: 0,  color: "from-primary to-primary/70" },
  { weeks: 1,  label: "Started", emoji: "🌱", bonus: 0,  color: "from-muted to-muted/70" },
];

export function EarningsStreakBadge({ streakWeeks }: EarningsStreakBadgeProps) {
  if (streakWeeks <= 0) return null;

  const tier = STREAK_TIERS.find((t) => streakWeeks >= t.weeks) || STREAK_TIERS[STREAK_TIERS.length - 1];
  const nextTier = STREAK_TIERS.find((t) => t.weeks > (tier?.weeks ?? 0) && streakWeeks < t.weeks);

  return (
    <div className="flex flex-col gap-2">
      {/* Badge */}
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r ${tier.color} text-white text-sm font-semibold w-fit shadow-sm`}>
        <span className="text-base">{tier.emoji}</span>
        <span>{streakWeeks}-week streak</span>
        {tier.bonus > 0 && (
          <span className="bg-white/20 text-xs px-1.5 py-0.5 rounded-full">+{tier.bonus}% bonus</span>
        )}
      </div>

      {/* Next tier hint */}
      {nextTier && nextTier.weeks > streakWeeks && (
        <p className="text-xs text-muted-foreground">
          {nextTier.weeks - streakWeeks} more week{nextTier.weeks - streakWeeks !== 1 ? "s" : ""} to unlock{" "}
          <span className="font-medium">{nextTier.label} (+{nextTier.bonus}% bonus)</span>
        </p>
      )}
    </div>
  );
}
