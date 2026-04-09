import { TIER_ORDER } from "@/lib/tierLimits";

/**
 * Checks if an error is a tier limit error and returns upgrade info.
 * Returns null if not a tier limit error.
 */
export function parseTierLimitError(error: Error | string): { resource: string; currentTier: string; nextTier: string | null } | null {
  const msg = typeof error === "string" ? error : error.message;
  const match = msg.match(/tier_limit_reached:(\w+) limit reached \((\d+) for (\w+) tier\)/);
  if (!match) return null;

  const [, resource, , currentTier] = match;
  const currentIndex = (TIER_ORDER as readonly string[]).indexOf(currentTier);
  const nextTier = currentIndex >= 0 && currentIndex < TIER_ORDER.length - 1
    ? TIER_ORDER[currentIndex + 1]
    : null;

  return { resource, currentTier, nextTier };
}
