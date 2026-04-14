/**
 * Shared AI Client for InsightForge Edge Functions
 *
 * Provides:
 *  - 25s timeout (fail gracefully before Deno kills process at 30s)
 *  - Single automatic retry with 2s backoff for transient failures (5xx, 429)
 *  - Centralized Gemini API URL and auth
 */

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const TIMEOUT_MS = 25_000;
const RETRY_BACKOFF_MS = 2_000;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

/**
 * Call Gemini API with timeout and automatic retry.
 * Throws on non-retryable errors or after exhausting retries.
 */
export async function fetchGemini(
  apiKey: string,
  body: Record<string, unknown>,
  maxRetries = 1,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(GEMINI_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // If the response is retryable and we have retries left, wait and retry
      if (!response.ok && RETRYABLE_STATUS.has(response.status) && attempt < maxRetries) {
        console.warn(`[AI_CLIENT] Gemini returned ${response.status}, retrying in ${RETRY_BACKOFF_MS}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
        await new Promise(resolve => setTimeout(resolve, RETRY_BACKOFF_MS));
        continue;
      }

      return response;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // AbortError means timeout
      if (lastError.name === "AbortError") {
        lastError = new Error(`AI request timed out after ${TIMEOUT_MS / 1000}s. The service may be experiencing high load — please try again.`);
      }

      if (attempt < maxRetries) {
        console.warn(`[AI_CLIENT] Fetch error, retrying: ${lastError.message}`);
        await new Promise(resolve => setTimeout(resolve, RETRY_BACKOFF_MS));
        continue;
      }
    }
  }

  throw lastError || new Error("AI request failed after retries");
}

/**
 * Parse a structured tool-call response from Gemini.
 * Returns the parsed arguments object, or the fallback if parsing fails.
 */
export function parseToolCallResponse<T>(
  aiData: any,
  fallback: T,
): { parsed: T; tokensUsed: number } {
  const tokensUsed = aiData.usage?.total_tokens || 0;

  try {
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      return { parsed: JSON.parse(toolCall.function.arguments) as T, tokensUsed };
    }
  } catch (_) {
    // Fall through to fallback
  }

  // If no tool call, try to use the raw content
  const content = aiData.choices?.[0]?.message?.content;
  if (content) {
    try {
      return { parsed: JSON.parse(content) as T, tokensUsed };
    } catch (_) {
      // Fall through
    }
  }

  return { parsed: fallback, tokensUsed };
}
