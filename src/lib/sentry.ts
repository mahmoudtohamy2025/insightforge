/**
 * Sentry observability layer.
 *
 * Provides error capture, user identification, and basic performance tracing.
 * All calls are no-ops if VITE_SENTRY_DSN is not set, making it safe for
 * development and for builds that haven't been configured yet.
 *
 * Pattern mirrors src/lib/analytics.ts (PostHog) — same lazy init, same
 * no-op-if-not-configured semantics.
 *
 * Setup (one-time, in your environment):
 *   1. Create a Sentry account + project at sentry.io (free tier: 5K errors/mo).
 *   2. Copy the project's DSN.
 *   3. Set VITE_SENTRY_DSN in Vercel project settings (and locally in .env if you
 *      want to test errors against a real Sentry project before deploy).
 *   4. Redeploy. Sentry starts capturing errors automatically.
 */

import * as Sentry from "@sentry/react";

let initialized = false;

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

/**
 * Initialize Sentry. Should be called once at app startup, BEFORE any React
 * rendering, so unhandled errors during initial render are captured.
 *
 * No-op if VITE_SENTRY_DSN is not set.
 */
export function initSentry(): void {
  if (!SENTRY_DSN) {
    console.debug("[Sentry] DSN not set — error reporting disabled.");
    return;
  }
  if (initialized) return;

  Sentry.init({
    dsn: SENTRY_DSN,

    // Environment tag — uses Vite's MODE so dev/preview/production are
    // distinguishable in the Sentry dashboard. Override via VITE_SENTRY_ENV
    // if you need finer control (e.g. distinguishing pitch-arm previews).
    environment:
      (import.meta.env.VITE_SENTRY_ENV as string | undefined) ??
      import.meta.env.MODE,

    // Release tag — uses the Vercel-injected commit SHA if available so
    // errors can be traced back to a specific deploy. Falls back to "dev".
    release:
      (import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA as string | undefined) ??
      "dev",

    // Performance Monitoring — sample 10% of transactions to stay within
    // the Sentry free-tier monthly quota. Increase if you start digging
    // into perf regressions and need more data points.
    tracesSampleRate: 0.1,

    integrations: [
      // Auto-instrument fetch/XHR + route changes for performance traces.
      Sentry.browserTracingIntegration(),
    ],

    // Only attach distributed-tracing headers to same-origin requests
    // (don't leak trace IDs to third parties like Stripe or Google).
    tracePropagationTargets: [
      "localhost",
      /^\//, // relative URLs (same origin)
    ],

    // We don't ship session replay yet (free tier has a small replay
    // quota and the privacy implications need explicit user consent for
    // any session involving real participants). Add later if needed.

    // P0.5 — Filter out noise that pollutes the dashboard without being
    // actionable. Add to this list as we identify recurring non-bugs.
    ignoreErrors: [
      // Common browser-extension noise
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      // Network errors are expected during offline / weak-connection
      "Network request failed",
    ],

    beforeSend(event) {
      // Drop events that have no usable stack — often third-party
      // script crashes with no actionable info.
      if (!event.exception?.values?.[0]?.stacktrace) {
        return event;
      }
      return event;
    },
  });

  initialized = true;
  console.debug(
    `[Sentry] Initialized for environment="${import.meta.env.MODE}"`
  );
}

/**
 * Tag the current user against future Sentry events. Call this on login
 * so when a user reports a bug we can find their error trail by user ID
 * rather than guessing from timestamps.
 *
 * Privacy: only id + email are tagged. Avoid sending PII beyond what's
 * already in the user's auth record.
 */
export function identifySentryUser(user: { id: string; email?: string | null }): void {
  if (!SENTRY_DSN || !initialized) return;
  Sentry.setUser({
    id: user.id,
    email: user.email ?? undefined,
  });
}

/**
 * Clear the current user context. Call on logout so subsequent errors
 * aren't attributed to the previous user.
 */
export function clearSentryUser(): void {
  if (!SENTRY_DSN || !initialized) return;
  Sentry.setUser(null);
}

/**
 * Manually capture an exception. The React ErrorBoundary already calls
 * this for render-phase errors, but use this anywhere you catch an error
 * that should be surfaced to the dashboard (e.g. mutation failures,
 * async errors outside of React's render tree).
 */
export function captureException(
  err: unknown,
  context?: Record<string, unknown>
): void {
  if (!SENTRY_DSN || !initialized) {
    // Local dev fallback — at least log to console so the developer sees something.
    console.error("[Sentry] (not configured) captured exception:", err, context);
    return;
  }
  if (context) {
    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
      Sentry.captureException(err);
    });
  } else {
    Sentry.captureException(err);
  }
}

/**
 * Capture a non-error message (e.g. an unexpected branch, a billing event
 * that shouldn't have happened). Use sparingly — for real errors use
 * captureException instead.
 */
export function captureMessage(
  message: string,
  level: "info" | "warning" | "error" = "info"
): void {
  if (!SENTRY_DSN || !initialized) return;
  Sentry.captureMessage(message, level);
}

/**
 * Get the underlying Sentry instance for advanced usage (e.g. custom
 * scopes for individual transactions). Returns null if not initialized.
 */
export function getSentry() {
  if (!SENTRY_DSN || !initialized) return null;
  return Sentry;
}
