/**
 * useFeatureFlag — minimal React hook for PostHog feature flags.
 *
 * P1.5 from Plan v2. Foundational infrastructure for A/B testing landing-page
 * variants (and any future feature toggle) without engineering involvement
 * per experiment.
 *
 * Usage:
 *   const { variant, isLoading } = useFeatureFlag("landing_hero_variant");
 *   if (variant === "control") return <HeroControl />;
 *   if (variant === "variant_a") return <HeroVariantA />;
 *   return <HeroDefault />;
 *
 * Notes:
 *   - Returns `{ variant: undefined, isLoading: true }` until PostHog has
 *     loaded its flag payload (typically <500ms after initAnalytics).
 *   - Returns `{ variant: undefined, isLoading: false }` if PostHog is not
 *     configured (no VITE_POSTHOG_KEY in env), which makes the hook safe
 *     to use everywhere — components can render their default when no flag
 *     system is wired up.
 *   - Subscribes to the `onFeatureFlags` listener so variants update live
 *     if PostHog pushes a config change mid-session (rare but useful for
 *     instant kill-switch rollback).
 */

import { useEffect, useState } from "react";
import { getPostHog } from "@/lib/analytics";

export interface FeatureFlagResult {
  /**
   * The active variant for this flag.
   *   - For boolean flags: `true` (enabled) | `false` (disabled) | `undefined` (not loaded yet)
   *   - For multivariate flags: the variant key (e.g. "control", "variant_a") | `undefined`
   */
  variant: string | boolean | undefined;

  /**
   * `true` until PostHog has loaded flag definitions for the current user.
   * Use this to avoid rendering one variant briefly before switching to another
   * once flags arrive ("flicker").
   */
  isLoading: boolean;
}

export function useFeatureFlag(flagKey: string): FeatureFlagResult {
  const [variant, setVariant] = useState<string | boolean | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const posthog = getPostHog();

    // PostHog not configured — return immediately with no variant so callers
    // render their default branch.
    if (!posthog) {
      setIsLoading(false);
      return;
    }

    // PostHog may already have flags loaded by the time this effect runs.
    const initial = posthog.getFeatureFlag(flagKey);
    if (initial !== undefined) {
      setVariant(initial as string | boolean);
      setIsLoading(false);
    }

    // Subscribe to flag updates. The handler fires whenever PostHog
    // reloads flags (initial load + subsequent refreshes).
    const unsubscribe = posthog.onFeatureFlags(() => {
      const next = posthog.getFeatureFlag(flagKey);
      setVariant(next as string | boolean);
      setIsLoading(false);
    });

    // PostHog's onFeatureFlags returns an unsubscribe function in recent
    // versions; older versions return void. Guard either way.
    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [flagKey]);

  return { variant, isLoading };
}

/**
 * Convenience: boolean-only feature flag.
 *
 * Returns `true` if the flag is enabled for the current user, `false`
 * otherwise (including "not loaded yet" — fail-closed so a half-loaded
 * page never shows experimental UI).
 */
export function useFeatureEnabled(flagKey: string): boolean {
  const { variant } = useFeatureFlag(flagKey);
  return variant === true || variant === "true";
}
