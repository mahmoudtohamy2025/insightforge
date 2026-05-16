/**
 * Sentry observability helper for Supabase Edge Functions (Deno).
 *
 * P0.5 — Surfaces edge-function errors to a Sentry dashboard so they're
 * actionable instead of buried in Supabase function logs.
 *
 * Why HTTP instead of @sentry/deno SDK:
 *   - Supabase pins a specific Deno version that doesn't always match the
 *     SDK's expected runtime. The Sentry envelope HTTP API is stable and
 *     dependency-free, and the entire client fits in ~50 lines.
 *   - One less import-resolve cost on every cold start.
 *
 * No-op if SENTRY_DSN env var isn't set (same pattern as the frontend
 * src/lib/sentry.ts). This means existing functions can `import` and use
 * captureEdgeException without breaking anything before the env var is
 * configured in production.
 *
 * Setup (one-time, in Supabase Functions Secrets):
 *   1. Create a Sentry account + project at sentry.io (free tier: 5K/mo).
 *   2. Copy the project's DSN (the same DSN used in VITE_SENTRY_DSN).
 *   3. Set SENTRY_DSN in Supabase project settings → Edge Functions → Secrets.
 *   4. Redeploy edge functions. Captures start flowing.
 */

interface ParsedDsn {
  key: string;
  host: string;
  projectId: string;
}

function parseDsn(dsn: string): ParsedDsn | null {
  // DSN format: https://<key>@<host>/<project_id>
  const match = dsn.match(/^https?:\/\/([^@]+)@([^/]+)\/(.+)$/);
  if (!match) return null;
  return { key: match[1], host: match[2], projectId: match[3] };
}

let cachedDsn: ParsedDsn | null | undefined = undefined;

function getDsn(): ParsedDsn | null {
  if (cachedDsn !== undefined) return cachedDsn;
  const raw = Deno.env.get("SENTRY_DSN");
  if (!raw) {
    cachedDsn = null;
    return null;
  }
  cachedDsn = parseDsn(raw);
  if (!cachedDsn) {
    console.error("[SENTRY] SENTRY_DSN is set but malformed; ignoring.");
  }
  return cachedDsn;
}

interface CaptureContext {
  /** Function name — e.g. "stripe-webhook", "public-demo-simulate". */
  function?: string;
  /** Workspace ID if known — useful for filtering errors per tenant. */
  workspaceId?: string;
  /** Arbitrary extra context (e.g. request body, stripe event type). */
  extras?: Record<string, unknown>;
  /** Severity. Defaults to "error". */
  level?: "fatal" | "error" | "warning" | "info" | "debug";
  /** Optional explicit tags. */
  tags?: Record<string, string>;
}

/**
 * Capture an exception (or any thrown value). Logs to console regardless so
 * Supabase function logs still have the error; if SENTRY_DSN is set, also
 * POSTs the event to Sentry.
 *
 * Never throws — Sentry capture failures are swallowed silently so they
 * can't take down the function whose error we were trying to report.
 */
export async function captureEdgeException(
  err: unknown,
  context: CaptureContext = {},
): Promise<void> {
  // Always log so Supabase function logs retain the error trail.
  console.error(
    `[SENTRY][${context.function ?? "unknown"}] ${context.level ?? "error"}:`,
    err,
    context.extras ?? {},
  );

  const dsn = getDsn();
  if (!dsn) return;

  const error = err instanceof Error ? err : new Error(String(err));

  const event = {
    event_id: crypto.randomUUID().replace(/-/g, ""),
    timestamp: Date.now() / 1000,
    level: context.level ?? "error",
    platform: "javascript",
    environment: Deno.env.get("ENVIRONMENT") ?? "production",
    server_name: context.function ?? "edge-function",
    tags: {
      function: context.function ?? "unknown",
      ...(context.tags ?? {}),
    },
    extra: {
      ...(context.extras ?? {}),
      ...(context.workspaceId ? { workspace_id: context.workspaceId } : {}),
    },
    exception: {
      values: [
        {
          type: error.name,
          value: error.message,
          stacktrace: error.stack
            ? {
                frames: error.stack
                  .split("\n")
                  .slice(1) // skip the "Error: foo" line
                  .map((line) => ({ filename: line.trim() }))
                  .reverse(), // Sentry expects oldest → newest
              }
            : undefined,
        },
      ],
    },
  };

  try {
    const endpoint = `https://${dsn.host}/api/${dsn.projectId}/store/`;
    const auth = `Sentry sentry_version=7, sentry_key=${dsn.key}, sentry_client=insightforge-edge/1.0`;

    await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": auth,
      },
      body: JSON.stringify(event),
    });
  } catch (sendErr) {
    // Swallow — never let Sentry instrumentation break the actual function.
    console.error("[SENTRY] Failed to send event:", sendErr);
  }
}

/**
 * Capture a structured message (not an exception). Use sparingly for events
 * you want to alert on but that aren't errors per se (e.g. unexpected
 * branches, security-relevant events).
 *
 * Currently logs only; the HTTP capture path is reserved for exceptions
 * to keep within Sentry free-tier limits. Add a `messages` path here if
 * you decide to surface non-error events to the dashboard.
 */
export function captureEdgeMessage(
  message: string,
  level: "fatal" | "error" | "warning" | "info" = "info",
  context: Omit<CaptureContext, "level"> = {},
): void {
  console[level === "fatal" || level === "error" ? "error" : "log"](
    `[SENTRY][${context.function ?? "unknown"}] ${level}: ${message}`,
    context.extras ?? {},
  );
}
