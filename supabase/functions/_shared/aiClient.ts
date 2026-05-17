/**
 * Shared AI Client for InsightForge Edge Functions
 *
 * Provides:
 *  - 25s timeout (fail gracefully before Deno kills process at 30s)
 *  - Single automatic retry with 2s backoff for transient failures (5xx, 429)
 *  - Native Gemini API transport while preserving the OpenAI-like response
 *    shape used across the existing edge functions.
 */

const TIMEOUT_MS = 25_000;
const RETRY_BACKOFF_MS = 2_000;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

type OpenAIMessage = {
  role?: string;
  content?: unknown;
};

type OpenAITool = {
  type?: string;
  function?: {
    name?: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

function normalizeTextContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function sanitizeSchema(schema: unknown): unknown {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return schema;

  const input = schema as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;

    switch (key) {
      case "type":
        sanitized[key] = typeof value === "string" ? value.toUpperCase() : value;
        break;
      case "description":
      case "enum":
      case "required":
      case "format":
      case "nullable":
      case "minimum":
      case "maximum":
      case "minItems":
      case "maxItems":
      case "minLength":
      case "maxLength":
        sanitized[key] = value;
        break;
      case "properties": {
        const rawProperties = value && typeof value === "object" && !Array.isArray(value)
          ? value as Record<string, unknown>
          : {};
        sanitized.properties = Object.fromEntries(
          Object.entries(rawProperties).map(([propKey, propValue]) => [propKey, sanitizeSchema(propValue)])
        );
        break;
      }
      case "items":
        sanitized.items = sanitizeSchema(value);
        break;
      default:
        break;
    }
  }

  return sanitized;
}

function buildGeminiRequest(body: Record<string, unknown>, apiKey: string) {
  const model = typeof body.model === "string" && body.model.length > 0 ? body.model : "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const rawMessages = Array.isArray(body.messages) ? body.messages as OpenAIMessage[] : [];
  const systemInstruction = rawMessages
    .filter((message) => message.role === "system")
    .map((message) => normalizeTextContent(message.content))
    .filter(Boolean)
    .join("\n\n");

  const contents = rawMessages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: normalizeTextContent(message.content) }],
    }))
    .filter((message) => message.parts[0].text.length > 0);

  const openAITools = Array.isArray(body.tools) ? body.tools as OpenAITool[] : [];
  const functionDeclarations = openAITools
    .filter((tool) => tool.type === "function" && tool.function?.name)
    .map((tool) => ({
      name: tool.function!.name!,
      description: tool.function?.description || "",
      parameters: sanitizeSchema(tool.function?.parameters || {}),
    }));

  const requestBody: Record<string, unknown> = {
    contents,
  };

  if (systemInstruction) {
    requestBody.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  if (functionDeclarations.length > 0) {
    requestBody.tools = [{ functionDeclarations }];
  }

  const toolChoice = body.tool_choice as { type?: string; function?: { name?: string } } | undefined;
  if (toolChoice?.type === "function" && toolChoice.function?.name) {
    requestBody.toolConfig = {
      functionCallingConfig: {
        mode: "ANY",
        allowedFunctionNames: [toolChoice.function.name],
      },
    };
  }

  return { url, requestBody };
}

function transformGeminiResponse(data: any): Record<string, unknown> {
  const candidate = data?.candidates?.[0];
  const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
  const functionPart = parts.find((part: any) => part?.functionCall);

  if (functionPart?.functionCall) {
    return {
      id: data?.responseId || crypto.randomUUID(),
      object: "chat.completion",
      choices: [{
        index: 0,
        finish_reason: candidate?.finishReason || "stop",
        message: {
          role: "assistant",
          content: null,
          tool_calls: [{
            id: crypto.randomUUID(),
            type: "function",
            function: {
              name: functionPart.functionCall.name,
              arguments: JSON.stringify(functionPart.functionCall.args || {}),
            },
          }],
        },
      }],
      usage: {
        total_tokens: data?.usageMetadata?.totalTokenCount || 0,
        prompt_tokens: data?.usageMetadata?.promptTokenCount || 0,
        completion_tokens: data?.usageMetadata?.candidatesTokenCount || 0,
      },
    };
  }

  const textContent = parts
    .map((part: any) => typeof part?.text === "string" ? part.text : "")
    .filter(Boolean)
    .join("\n");

  return {
    id: data?.responseId || crypto.randomUUID(),
    object: "chat.completion",
    choices: [{
      index: 0,
      finish_reason: candidate?.finishReason || "stop",
      message: {
        role: "assistant",
        content: textContent,
      },
    }],
    usage: {
      total_tokens: data?.usageMetadata?.totalTokenCount || 0,
      prompt_tokens: data?.usageMetadata?.promptTokenCount || 0,
      completion_tokens: data?.usageMetadata?.candidatesTokenCount || 0,
    },
  };
}

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
      const { url, requestBody } = buildGeminiRequest(body, apiKey);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // If the response is retryable and we have retries left, wait and retry
      if (!response.ok && RETRYABLE_STATUS.has(response.status) && attempt < maxRetries) {
        console.warn(`[AI_CLIENT] Gemini returned ${response.status}, retrying in ${RETRY_BACKOFF_MS}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
        await new Promise(resolve => setTimeout(resolve, RETRY_BACKOFF_MS));
        continue;
      }

      if (!response.ok) {
        return response;
      }

      const data = await response.json();
      const transformed = transformGeminiResponse(data);

      return new Response(JSON.stringify(transformed), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });
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
