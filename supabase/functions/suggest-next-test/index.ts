import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import {
  validateRequired,
  isValidUUID,
  validateWorkspaceMembership,
  parseBody,
} from "../_shared/validation.ts";
import { checkRateLimit, recordTokenUsage } from "../_shared/rateLimiter.ts";
import { getWorkspaceTier } from "../_shared/tierEnforcement.ts";
import { fetchGemini } from "../_shared/aiClient.ts";

Deno.serve(async (req: any) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse(req, { error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return jsonResponse(req, { error: "Unauthorized" }, 401);

    const { body, error: parseError } = await parseBody(req);
    if (parseError) return parseError;

    const { simulation_id, workspace_id } = body!;
    const reqCheck = validateRequired(body!, ["simulation_id", "workspace_id"]);
    if (reqCheck) return jsonResponse(req, reqCheck, 400);
    if (!isValidUUID(simulation_id)) {
      return jsonResponse(req, { error: "simulation_id must be a valid UUID" }, 400);
    }
    if (!isValidUUID(workspace_id)) {
      return jsonResponse(req, { error: "workspace_id must be a valid UUID" }, 400);
    }

    const memberCheck = await validateWorkspaceMembership(
      supabase,
      req,
      user.id,
      workspace_id as string,
    );
    if (memberCheck) return memberCheck;

    const tier = await getWorkspaceTier(supabase, workspace_id as string);
    const rateLimitCheck = await checkRateLimit(supabase, req, workspace_id as string, tier);
    if (rateLimitCheck) return rateLimitCheck;

    const { data: simulation, error: simError } = await supabase
      .from("simulations")
      .select("id, workspace_id, type, stimulus, results, segment_ids")
      .eq("id", simulation_id)
      .eq("workspace_id", workspace_id)
      .single();

    if (simError || !simulation) {
      return jsonResponse(req, { error: "Simulation not found" }, 404);
    }

    const rawStimulus = simulation.stimulus as unknown;
    const stimulusText =
      rawStimulus && typeof rawStimulus === "object" && "text" in (rawStimulus as Record<string, unknown>)
        ? String((rawStimulus as { text: unknown }).text)
        : typeof rawStimulus === "string"
          ? rawStimulus
          : JSON.stringify(rawStimulus ?? "");
    const results = (simulation.results || {}) as Record<string, any>;
    const aggregate = (results.aggregate || {}) as Record<string, any>;
    const topThemes = (aggregate.top_themes || []) as Array<{ theme: string; count: number }>;

    const summary = simulation.type === "focus_group"
      ? [
          `Focus group with ${aggregate.participant_count || 0} personas across ${aggregate.total_rounds || 1} round(s).`,
          `Consensus score: ${Math.round((aggregate.consensus_score || 0) * 100)}%`,
          `Avg sentiment: ${Number(aggregate.avg_sentiment || 0).toFixed(2)} (-1 negative, +1 positive)`,
          `Avg confidence: ${Math.round((aggregate.avg_confidence || 0) * 100)}%`,
          topThemes.length
            ? `Top themes raised (with mention counts): ${topThemes
                .map((t) => `${t.theme} (${t.count})`)
                .join(", ")}`
            : "",
        ].filter(Boolean).join("\n")
      : [
          `Single twin response.`,
          results.summary ? `Response: ${String(results.summary).slice(0, 600)}` : "",
          `Sentiment: ${Number(results.sentiment || 0).toFixed(2)}`,
          `Purchase intent: ${results.purchase_intent || "unknown"}`,
          `Emotional reaction: ${results.emotional_reaction || "unknown"}`,
          results.key_themes?.length ? `Key themes: ${(results.key_themes as string[]).join(", ")}` : "",
        ].filter(Boolean).join("\n");

    const systemPrompt = `You are a sharp research strategist helping a solo founder decide what to test next.

The founder just ran a simulated study. Based on what the personas said, propose EXACTLY 3 follow-up tests that would most reduce decision risk.

Be opinionated and specific. Avoid generic advice like "test more personas" — name a concrete variant (a price point, a feature, a message, a different segment).

Order the 3 suggestions by which would most resolve the biggest remaining uncertainty.`;

    const userPrompt = `ORIGINAL STIMULUS:
${stimulusText}

WHAT HAPPENED:
${summary}

Generate 3 follow-up tests. For each:
- headline: 8-12 words, action-oriented (e.g. "Test a $5 lower price with the same group")
- rationale: ONE sentence on why this resolves the biggest uncertainty
- stimulus_template: the actual 3-5 sentence stimulus the founder can run as-is (write the full prompt, don't be coy)
- focus_area: one of price | feature | messaging | audience | positioning`;

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) return jsonResponse(req, { error: "AI not configured" }, 500);

    const startTime = Date.now();
    const aiResponse = await fetchGemini(GEMINI_API_KEY, {
      model: "gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "next_tests",
            description: "Return 3 specific follow-up tests for the founder",
            parameters: {
              type: "object",
              properties: {
                suggestions: {
                  type: "array",
                  minItems: 3,
                  maxItems: 3,
                  items: {
                    type: "object",
                    properties: {
                      headline: { type: "string" },
                      rationale: { type: "string" },
                      stimulus_template: { type: "string" },
                      focus_area: {
                        type: "string",
                        enum: ["price", "feature", "messaging", "audience", "positioning"],
                      },
                    },
                    required: ["headline", "rationale", "stimulus_template", "focus_area"],
                  },
                },
              },
              required: ["suggestions"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "next_tests" } },
    });

    const durationMs = Date.now() - startTime;
    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("[suggest-next-test] Gemini error:", errText);
      return jsonResponse(req, { error: "AI generation failed" }, 502);
    }

    const aiData = await aiResponse.json();
    let parsed: {
      suggestions: Array<{
        headline: string;
        rationale: string;
        stimulus_template: string;
        focus_area: string;
      }>;
    } = { suggestions: [] };
    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        parsed = JSON.parse(toolCall.function.arguments);
      }
    } catch (e) {
      console.error("[suggest-next-test] Parse error:", e);
      return jsonResponse(req, { error: "AI response could not be parsed" }, 502);
    }

    const tokensUsed = aiData.usage?.total_tokens || 0;
    await recordTokenUsage(supabase, workspace_id as string, tokensUsed);

    return jsonResponse(req, {
      simulation_id,
      suggestions: parsed.suggestions || [],
      tokens_used: tokensUsed,
      duration_ms: durationMs,
    });
  } catch (err: any) {
    console.error("Suggest next test error:", err);
    return jsonResponse(req, { error: err.message || "Internal error" }, 500);
  }
});
