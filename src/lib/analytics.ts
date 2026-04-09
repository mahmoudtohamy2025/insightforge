/**
 * Analytics abstraction layer.
 *
 * Uses PostHog under the hood. All calls are no-ops if
 * VITE_POSTHOG_KEY is not set, making it safe for development.
 */
import posthog from "posthog-js";

let initialized = false;

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const POSTHOG_HOST = (import.meta.env.VITE_POSTHOG_HOST as string) || "https://us.i.posthog.com";

/**
 * Initialize PostHog. Should be called once at app startup.
 * No-op if VITE_POSTHOG_KEY is not set.
 */
export function initAnalytics(): void {
  if (!POSTHOG_KEY) {
    console.debug("[Analytics] PostHog key not set — analytics disabled.");
    return;
  }
  if (initialized) return;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false, // We handle this manually via router
    capture_pageleave: true,
    autocapture: false, // Only track explicit events
    persistence: "localStorage",
    loaded: () => {
      console.debug("[Analytics] PostHog initialized.");
    },
  });

  initialized = true;
}

/**
 * Identify the current user. Call on login.
 */
export function identifyUser(
  userId: string,
  traits?: Record<string, any>
): void {
  if (!POSTHOG_KEY || !initialized) return;
  posthog.identify(userId, traits);
}

/**
 * Track a named event with optional properties.
 */
export function trackEvent(
  event: string,
  properties?: Record<string, any>
): void {
  if (!POSTHOG_KEY || !initialized) return;
  posthog.capture(event, properties);
}

/**
 * Track a page view. Call on route changes.
 */
export function trackPageView(path: string): void {
  if (!POSTHOG_KEY || !initialized) return;
  posthog.capture("$pageview", { $current_url: path });
}

/**
 * Reset analytics identity. Call on logout.
 */
export function resetAnalytics(): void {
  if (!POSTHOG_KEY || !initialized) return;
  posthog.reset();
}

/**
 * Get the PostHog instance for advanced usage.
 * Returns null if not initialized.
 */
export function getPostHog() {
  if (!POSTHOG_KEY || !initialized) return null;
  return posthog;
}
