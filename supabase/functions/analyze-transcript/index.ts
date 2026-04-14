import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, getCorsHeaders } from "../_shared/cors.ts";
import { requireWorkspaceMember } from "../_shared/validation.ts";
import { checkRateLimit, recordTokenUsage } from "../_shared/rateLimiter.ts";
import { getWorkspaceTier } from "../_shared/tierEnforcement.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const userId = user.id as string;
    const { session_id, workspace_id } = await req.json();

    if (!session_id || !workspace_id) {
      return new Response(JSON.stringify({ error: "Missing session_id or workspace_id" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const { data: transcript, error: txError } = await supabase
      .from("session_transcripts")
      .select("raw_text, language")
      .eq("session_id", session_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (txError || !transcript) {
      return new Response(JSON.stringify({ error: "Transcript not found" }), {
        status: 404,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    if (!transcript.raw_text || transcript.raw_text.trim().length < 50) {
      return new Response(JSON.stringify({ error: "Transcript too short to analyze" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const maxChars = 30000;
    const rawText = transcript.raw_text.length > maxChars
      ? transcript.raw_text.slice(0, maxChars) + "\n\n[Transcript truncated for analysis]"
      : transcript.raw_text;

    const systemPrompt = `You are an expert qualitative research analyst. Analyze the following research session transcript and extract:

1. KEY THEMES (3-8 themes):
For each theme:
- Provide a clear, concise title (3-8 words)
- Write a description explaining the theme (1-3 sentences)
- Assign a confidence score between 0 and 1
- Classify the sentiment as positive, negative, neutral, or mixed
- Extract 1-4 direct quotes from the transcript that support this theme

2. SESSION-LEVEL SENTIMENT SUMMARY:
- overall: the dominant sentiment of the entire session (positive, negative, neutral, or mixed)
- score: a number between 0 and 1 (0 = very negative, 0.5 = neutral, 1 = very positive)
- distribution: percentage breakdown as decimals that sum to 1.0 (e.g. { positive: 0.4, negative: 0.3, neutral: 0.2, mixed: 0.1 })
- interpretation: a single sentence summarizing the emotional tone of the session

Order themes by confidence (highest first). Focus on actionable research insights.`;

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analyze this transcript (language: ${transcript.language || "en"}):\n\n${rawText}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_analysis",
              description: "Extract structured themes and session-level sentiment from a research session transcript.",
              parameters: {
                type: "object",
                properties: {
                  themes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", description: "Theme title (3-8 words)" },
                        description: { type: "string", description: "Theme description (1-3 sentences)" },
                        confidence: { type: "number", description: "Confidence score 0-1" },
                        sentiment: {
                          type: "string",
                          enum: ["positive", "negative", "neutral", "mixed"],
                        },
                        quotes: {
                          type: "array",
                          items: { type: "string" },
                          description: "1-4 direct quotes supporting this theme",
                        },
                      },
                      required: ["title", "description", "confidence", "sentiment", "quotes"],
                      additionalProperties: false,
                    },
                  },
                  session_sentiment: {
                    type: "object",
                    properties: {
                      overall: {
                        type: "string",
                        enum: ["positive", "negative", "neutral", "mixed"],
                      },
                      score: { type: "number", description: "0-1 sentiment score" },
                      distribution: {
                        type: "object",
                        properties: {
                          positive: { type: "number" },
                          negative: { type: "number" },
                          neutral: { type: "number" },
                          mixed: { type: "number" },
                        },
                        required: ["positive", "negative", "neutral", "mixed"],
                        additionalProperties: false,
                      },
                      interpretation: { type: "string", description: "One sentence summarizing the emotional tone" },
                    },
                    required: ["overall", "score", "distribution", "interpretation"],
                    additionalProperties: false,
                  },
                },
                required: ["themes", "session_sentiment"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_analysis" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings." }), {
          status: 402,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", status, text);
      return new Response(JSON.stringify({ error: "Failed to analyze transcript" }), {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response:", JSON.stringify(result));
      return new Response(JSON.stringify({ error: "AI did not return structured analysis" }), {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const themes = parsed.themes || [];
    const sessionSentiment = parsed.session_sentiment || null;

    // Delete existing themes for this session (re-analysis replaces old themes)
    await supabase
      .from("session_themes")
      .delete()
      .eq("session_id", session_id);

    // Insert new themes
    const themesToInsert = themes.map((t: any) => ({
      session_id,
      workspace_id,
      created_by: userId,
      title: t.title,
      description: t.description || "",
      confidence_score: Math.min(1, Math.max(0, t.confidence || 0)),
      evidence: {
        sentiment: t.sentiment || "neutral",
        quotes: t.quotes || [],
      },
    }));

    if (themesToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("session_themes")
        .insert(themesToInsert);

      if (insertError) {
        console.error("Insert themes error:", insertError);
        return new Response(JSON.stringify({ error: "Failed to save themes" }), {
          status: 500,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
    }

    // Save session-level sentiment summary
    if (sessionSentiment) {
      const { error: sentimentError } = await supabase
        .from("sessions")
        .update({ sentiment_summary: sessionSentiment })
        .eq("id", session_id);

      if (sentimentError) {
        console.error("Save sentiment error:", sentimentError);
        // Non-fatal: themes are already saved
      }
    }

    return new Response(JSON.stringify({
      themes: themesToInsert,
      count: themesToInsert.length,
      sentiment: sessionSentiment,
    }), {
      status: 200,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("analyze-transcript error:", err);
    await recordTokenUsage(supabase, workspace_id, 2000); // Estimated 2K tokens
    return new Response(JSON.stringify({ error: (err instanceof Error ? err.message : "Unknown error") }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
