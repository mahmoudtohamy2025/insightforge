import { handleCors, jsonResponse } from "../_shared/cors.ts";

/**
 * Public Demo Simulate — Rate-limited, no-auth endpoint for the public playground.
 * Uses IP-based rate limiting (max 3 requests per hour per IP).
 * Does NOT save results to the database.
 */

// Simple in-memory rate limiter (resets when the function cold-starts)
const ipRequests = new Map<string, { count: number; resetAt: number }>();
const MAX_REQUESTS = 3;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkIPRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipRequests.get(ip);
  if (!entry || now > entry.resetAt) {
    ipRequests.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_REQUESTS) return false;
  entry.count++;
  return true;
}

// Pre-built demo personas
const DEMO_PERSONAS: Record<string, any> = {
  "health-millennials": {
    name: "Health-Conscious Millennials",
    demographics: { age_range: "25-34", gender: "Mixed", location: "Urban USA", income_level: "Middle-Upper" },
    psychographics: { values: "Wellness, sustainability, authenticity", lifestyle: "Active, gym-goer, meal-prepper" },
  },
  "gen-z-tech": {
    name: "Gen-Z Tech Enthusiasts",
    demographics: { age_range: "18-24", gender: "Mixed", location: "Global", income_level: "Entry-level" },
    psychographics: { values: "Innovation, social impact, individuality", lifestyle: "Digital-native, social media heavy" },
  },
  "mena-professionals": {
    name: "MENA Working Professionals",
    demographics: { age_range: "30-45", gender: "Mixed", location: "GCC Countries", income_level: "Upper-Middle" },
    psychographics: { values: "Family, career growth, tradition", lifestyle: "Career-driven, community-oriented" },
  },
};

Deno.serve(async (req: any) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  try {
    // Rate limit by IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
               req.headers.get("cf-connecting-ip") ||
               "unknown";

    if (!checkIPRateLimit(ip)) {
      return jsonResponse(req, {
        error: "Rate limit exceeded. Maximum 3 demo simulations per hour.",
        retry_after_seconds: 3600,
      }, 429);
    }

    // Parse body
    const body = await req.json();
    const { persona_key, stimulus } = body;

    if (!persona_key || !stimulus) {
      return jsonResponse(req, { error: "persona_key and stimulus are required" }, 400);
    }

    const persona = DEMO_PERSONAS[persona_key];
    if (!persona) {
      return jsonResponse(req, { error: "Invalid persona_key. Use: health-millennials, gen-z-tech, or mena-professionals" }, 400);
    }

    const cleanStimulus = typeof stimulus === "string" ? stimulus.slice(0, 2000) : "";
    if (!cleanStimulus) {
      return jsonResponse(req, { error: "stimulus must be a non-empty string (max 2000 chars)" }, 400);
    }

    // Build prompt
    const demo = persona.demographics;
    const psycho = persona.psychographics;

    const personaPrompt = `You are a simulated consumer for a DEMO showcase. Respond ONLY from this persona:
PERSONA: ${persona.name}
AGE: ${demo.age_range}, GENDER: ${demo.gender}, LOCATION: ${demo.location}, INCOME: ${demo.income_level}
VALUES: ${psycho.values}
LIFESTYLE: ${psycho.lifestyle}

Rules: Stay in character. Be specific and natural. Show genuine emotions.`;

    // Call Gemini API
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return jsonResponse(req, { error: "AI not configured" }, 500);
    }

    const startTime = Date.now();

    const aiResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: personaPrompt },
          { role: "user", content: cleanStimulus },
        ],
        tools: [{
          type: "function",
          function: {
            name: "demo_response",
            description: "Return structured demo response",
            parameters: {
              type: "object",
              properties: {
                response: { type: "string", description: "The persona's natural language response" },
                sentiment: { type: "number", description: "Sentiment -1.0 to 1.0" },
                confidence: { type: "number", description: "Confidence 0.0 to 1.0" },
                key_themes: { type: "array", items: { type: "string" }, description: "3-5 key themes" },
                purchase_intent: { type: "string", enum: ["definitely_yes", "probably_yes", "neutral", "probably_no", "definitely_no"] },
                emotional_reaction: { type: "string", enum: ["excited", "interested", "neutral", "skeptical", "concerned", "opposed"] },
              },
              required: ["response", "sentiment", "confidence", "key_themes", "purchase_intent", "emotional_reaction"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "demo_response" } },
      }),
    });

    const durationMs = Date.now() - startTime;

    if (!aiResponse.ok) {
      return jsonResponse(req, { error: "AI generation failed" }, 502);
    }

    const aiData = await aiResponse.json();

    let parsed: any = {};
    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        parsed = JSON.parse(toolCall.function.arguments);
      }
    } catch {
      parsed = {
        response: aiData.choices?.[0]?.message?.content || "Demo response unavailable.",
        sentiment: 0, confidence: 0.5, key_themes: [], purchase_intent: "neutral", emotional_reaction: "neutral",
      };
    }

    return jsonResponse(req, {
      persona: persona.name,
      response: parsed.response,
      sentiment: parsed.sentiment,
      confidence: parsed.confidence,
      key_themes: parsed.key_themes,
      purchase_intent: parsed.purchase_intent,
      emotional_reaction: parsed.emotional_reaction,
      duration_ms: durationMs,
      demo: true,
      remaining_requests: Math.max(0, MAX_REQUESTS - (ipRequests.get(ip)?.count || 0)),
    });
  } catch (err: any) {
    console.error("Public demo error:", err);
    return jsonResponse(req, { error: err.message || "Internal error" }, 500);
  }
});
