/**
 * Rate Limiter for Edge Functions
 * 
 * Uses the `workspace_token_usage` table to track per-workspace:
 *   - Monthly token budget (based on tier)
 *   - Per-minute request limit (based on tier)
 *
 * Usage:
 *   const rateLimitResp = await checkRateLimit(supabase, req, workspaceId, tier);
 *   if (rateLimitResp) return rateLimitResp; // 429 response
 *
 *   // ... run LLM call ...
 *
 *   await recordTokenUsage(supabase, workspaceId, tokensUsed);
 */

import { jsonResponse } from "./cors.ts";

// ── Tier Budgets ────────────────────────────────────

const TIER_TOKEN_BUDGETS: Record<string, number> = {
  free: 0,
  starter: 500_000,
  professional: 2_000_000,
  enterprise: 10_000_000,
};

const TIER_RATE_LIMITS: Record<string, number> = {
  free: 0,      // AI is disabled for free
  starter: 10,  // 10 req/min
  professional: 30,
  enterprise: 100,
};

// ── Helper: Get current period start (first of month) ──

function getCurrentPeriodStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

// ── Check Rate Limit ────────────────────────────────

/**
 * Check if the workspace has exceeded its rate limit or token budget.
 * Returns a 429 Response if exceeded, or null if OK.
 */
export async function checkRateLimit(
  supabase: any,
  req: Request,
  workspaceId: string,
  tier: string,
): Promise<Response | null> {
  const budget = TIER_TOKEN_BUDGETS[tier] ?? 0;
  const rateLimit = TIER_RATE_LIMITS[tier] ?? 0;

  // If tier has 0 budget, AI is disabled (handled separately by tier enforcement)
  if (budget === 0) {
    return jsonResponse(req, {
      error: "AI features are not available on your current plan",
      code: "TIER_LIMIT",
      tier,
      upgrade_url: "/settings?tab=billing",
    }, 403);
  }

  try {
    const periodStart = getCurrentPeriodStart();

    // Get or create the current period's usage record
    const { data: usage } = await supabase
      .from("workspace_token_usage")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("period_start", periodStart)
      .maybeSingle();

    // Check monthly token budget
    if (usage && usage.tokens_used >= budget) {
      return jsonResponse(req, {
        error: "Monthly token budget exceeded",
        code: "RATE_LIMITED",
        monthly_tokens_used: usage.tokens_used,
        monthly_tokens_limit: budget,
        period_start: periodStart,
        retry_after_seconds: getSecondsUntilNextMonth(),
        message: `Your ${tier} plan allows ${budget.toLocaleString()} tokens/month. You've used ${usage.tokens_used.toLocaleString()}. Upgrade for more capacity.`,
        upgrade_url: "/settings?tab=billing",
      }, 429);
    }

    // Check per-minute rate limit
    if (usage && rateLimit > 0) {
      const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();

      // Count recent requests using the last_request_at + request_count
      // For simplicity, if the last request was within 1 minute and count is high
      if (usage.last_request_at && usage.last_request_at > oneMinuteAgo) {
        // Count requests in this minute window
        const { count } = await supabase
          .from("workspace_token_usage_log")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .gte("created_at", oneMinuteAgo);

        if (count && count >= rateLimit) {
          return jsonResponse(req, {
            error: "Rate limit exceeded",
            code: "RATE_LIMITED",
            requests_per_minute: rateLimit,
            retry_after_seconds: 60,
            message: `Your ${tier} plan allows ${rateLimit} AI requests per minute. Please wait before trying again.`,
          }, 429);
        }
      }
    }

    return null;
  } catch (err) {
    // On error, fail open but log
    console.error("[RATE_LIMITER] Error:", err);
    return null;
  }
}

// ── Record Token Usage ──────────────────────────────

/**
 * Record token usage after a successful LLM call.
 * Upserts the monthly usage counter.
 */
export async function recordTokenUsage(
  supabase: any,
  workspaceId: string,
  tokensUsed: number,
): Promise<void> {
  try {
    const periodStart = getCurrentPeriodStart();

    // Upsert the monthly usage record
    const { data: existing } = await supabase
      .from("workspace_token_usage")
      .select("id, tokens_used, request_count")
      .eq("workspace_id", workspaceId)
      .eq("period_start", periodStart)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("workspace_token_usage")
        .update({
          tokens_used: (existing.tokens_used || 0) + tokensUsed,
          request_count: (existing.request_count || 0) + 1,
          last_request_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("workspace_token_usage")
        .insert({
          workspace_id: workspaceId,
          period_start: periodStart,
          tokens_used: tokensUsed,
          request_count: 1,
          last_request_at: new Date().toISOString(),
        });
    }

    // Also log individual requests for per-minute tracking
    await supabase
      .from("workspace_token_usage_log")
      .insert({
        workspace_id: workspaceId,
        tokens_used: tokensUsed,
      });
  } catch (err) {
    console.error("[RATE_LIMITER] Failed to record usage:", err);
  }
}

// ── Helpers ─────────────────────────────────────────

function getSecondsUntilNextMonth(): number {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return Math.ceil((nextMonth.getTime() - now.getTime()) / 1000);
}
