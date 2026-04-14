import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { enforceTierLimit, getWorkspaceTier } from "../_shared/tierEnforcement.ts";
import { validateRequired, isValidUUID, sanitize, validateWorkspaceMembership, parseBody, validateUUIDs } from "../_shared/validation.ts";
import { checkRateLimit, recordTokenUsage } from "../_shared/rateLimiter.ts";
import { fetchGemini } from "../_shared/aiClient.ts";

// ── Build persona system prompt from segment ──
function buildPersonaPrompt(segment: any): string {
  const demo = segment.demographics || {};
  const psycho = segment.psychographics || {};
  const behavior = segment.behavioral_data || {};
  const culture = segment.cultural_context || {};

  return `You are a simulated consumer named "${segment.name}". You must respond ONLY from this persona — never break character.

DEMOGRAPHIC PROFILE:
- Age range: ${demo.age_range || "25-35"}
- Gender: ${demo.gender || "Mixed"}
- Location: ${demo.location || "Not specified"}
- Income level: ${demo.income_level || "Middle income"}
- Education: ${demo.education || "College educated"}
- Occupation: ${demo.occupation || "Professional"}

PSYCHOGRAPHIC PROFILE:
- Values: ${psycho.values || "Not specified"}
- Lifestyle: ${psycho.lifestyle || "Not specified"}
- Interests: ${psycho.interests || "Not specified"}

BEHAVIORAL PATTERNS:
- Purchase behavior: ${behavior.purchase_behavior || "Not specified"}
- Brand preferences: ${behavior.brand_preferences || "Not specified"}
- Decision factors: ${behavior.decision_factors || "Not specified"}

CULTURAL CONTEXT:
- Region: ${culture.region || "Not specified"}
- Language preference: ${culture.language || "English"}

RULES:
1. Stay in character. Respond as this real person would.
2. Show genuine emotions and opinions.
3. Keep responses concise (2-4 sentences).
4. Be specific, not generic.`;
}

// ── Call Gemini with structured output ──
async function callGemini(apiKey: string, systemPrompt: string, userPrompt: string) {
  const aiResponse = await fetchGemini(apiKey, {
    model: "gemini-2.5-flash",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    tools: [{
      type: "function",
      function: {
        name: "structured_response",
        description: "Return the twin's response with structured metadata",
        parameters: {
          type: "object",
          properties: {
            response: { type: "string", description: "The twin's natural language response" },
            sentiment: { type: "number", description: "Sentiment from -1.0 to 1.0" },
            confidence: { type: "number", description: "Confidence from 0.0 to 1.0" },
            key_themes: { type: "array", items: { type: "string" }, description: "2-4 key themes" },
            purchase_intent: { type: "string", enum: ["definitely_yes", "probably_yes", "neutral", "probably_no", "definitely_no"] },
            emotional_reaction: { type: "string", enum: ["excited", "interested", "neutral", "skeptical", "concerned", "opposed"] },
          },
          required: ["response", "sentiment", "confidence", "key_themes", "purchase_intent", "emotional_reaction"],
        },
      },
    }],
    tool_choice: { type: "function", function: { name: "structured_response" } },
  });

  if (!aiResponse.ok) {
    const errText = await aiResponse.text();
    throw new Error(`Gemini API error: ${errText}`);
  }

  const aiData = await aiResponse.json();
  const tokensUsed = aiData.usage?.total_tokens || 0;

  try {
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      return { ...JSON.parse(toolCall.function.arguments), tokensUsed };
    }
  } catch (_) { /* fallback */ }

  return {
    response: aiData.choices?.[0]?.message?.content || "",
    sentiment: 0, confidence: 0.5, key_themes: [], purchase_intent: "neutral", emotional_reaction: "neutral", tokensUsed,
  };
}

// ── Main Handler ──────────────────────────────────────
Deno.serve(async (req: any) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse(req, { error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse(req, { error: "Unauthorized" }, 401);
    }

    // ── Parse & Validate Input ───────────────────────────
    const { body, error: parseError } = await parseBody(req);
    if (parseError) return parseError;

    const { segment_ids, variant_a, variant_b, title, workspace_id } = body!;

    const reqCheck = validateRequired(body!, ["segment_ids", "variant_a", "variant_b", "workspace_id"]);
    if (reqCheck) return jsonResponse(req, reqCheck, 400);

    if (!isValidUUID(workspace_id)) return jsonResponse(req, { error: "workspace_id must be a valid UUID" }, 400);
    if (!Array.isArray(segment_ids) || segment_ids.length < 1) return jsonResponse(req, { error: "segment_ids must have at least 1 item" }, 400);

    const uuidCheck = validateUUIDs(segment_ids, "segment_ids");
    if (uuidCheck) return jsonResponse(req, uuidCheck, 400);

    const cleanA = sanitize(variant_a, 5000);
    const cleanB = sanitize(variant_b, 5000);
    if (!cleanA || !cleanB) return jsonResponse(req, { error: "variant_a and variant_b must be non-empty strings (max 5,000 chars)" }, 400);

    // ── Workspace Membership Check ───────────────────────
    const memberCheck = await validateWorkspaceMembership(supabase, req, user.id, workspace_id as string);
    if (memberCheck) return memberCheck;

    // ── Tier Enforcement ────────────────────────────────
    const tierCheck = await enforceTierLimit(supabase, req, workspace_id as string, "aiAnalysis");
    if (tierCheck) return tierCheck;

    // ── Rate Limit Check ────────────────────────────────
    const tier = await getWorkspaceTier(supabase, workspace_id as string);
    const rateLimitCheck = await checkRateLimit(supabase, req, workspace_id as string, tier);
    if (rateLimitCheck) return rateLimitCheck;

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) return jsonResponse(req, { error: "AI not configured" }, 500);

    // Load segments
    const { data: segments, error: segError } = await supabase
      .from("segment_profiles")
      .select("*")
      .in("id", segment_ids as string[])
      .eq("workspace_id", workspace_id);

    if (segError || !segments?.length) return jsonResponse(req, { error: "Segments not found" }, 404);

    const startTime = Date.now();
    let totalTokens = 0;

    // Create simulation record
    const variantAText = typeof variant_a === "string" ? variant_a : JSON.stringify(variant_a);
    const variantBText = typeof variant_b === "string" ? variant_b : JSON.stringify(variant_b);
    const simTitle = title || `A/B Test: "${variantAText.slice(0, 40)}" vs "${variantBText.slice(0, 40)}"`;

    const { data: simulation, error: simError } = await supabase
      .from("simulations")
      .insert({
        workspace_id,
        type: "ab_test",
        title: simTitle,
        stimulus: { variant_a: typeof variant_a === "string" ? { text: variant_a } : variant_a, variant_b: typeof variant_b === "string" ? { text: variant_b } : variant_b },
        segment_ids,
        status: "running",
        created_by: user.id,
      })
      .select()
      .single();

    if (simError) {
      return jsonResponse(req, { error: "Failed to create simulation" }, 500);
    }

    // Run each segment through both variants
    const resultsA: any[] = [];
    const resultsB: any[] = [];

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const persona = buildPersonaPrompt(seg);

      const promptA = `Please evaluate the following product/campaign/concept and share your honest reaction:\n\n"${variantAText}"`;
      const promptB = `Please evaluate the following product/campaign/concept and share your honest reaction:\n\n"${variantBText}"`;

      // Parallelize A and B calls — they're independent
      const [resA, resB] = await Promise.all([
        callGemini(GEMINI_API_KEY, persona, promptA),
        callGemini(GEMINI_API_KEY, persona, promptB),
      ]);
      totalTokens += resA.tokensUsed + resB.tokensUsed;

      resultsA.push({ segment_id: seg.id, segment_name: seg.name, ...resA });
      resultsB.push({ segment_id: seg.id, segment_name: seg.name, ...resB });

      await Promise.all([
        supabase.from("twin_responses").insert({
          simulation_id: simulation.id, segment_id: seg.id, twin_index: i,
          stimulus_variant: "A", persona_snapshot: { name: seg.name, demographics: seg.demographics },
          response_text: resA.response || "", sentiment: resA.sentiment,
          confidence: resA.confidence, behavioral_tags: resA.key_themes || [],
        }),
        supabase.from("twin_responses").insert({
          simulation_id: simulation.id, segment_id: seg.id, twin_index: i + segments.length,
          stimulus_variant: "B", persona_snapshot: { name: seg.name, demographics: seg.demographics },
          response_text: resB.response || "", sentiment: resB.sentiment,
          confidence: resB.confidence, behavioral_tags: resB.key_themes || [],
        }),
      ]);
    }

    const durationMs = Date.now() - startTime;

    // ── Record Token Usage ───────────────────────────────
    await recordTokenUsage(supabase, workspace_id as string, totalTokens);

    // Compute comparative metrics
    const avgSentimentA = resultsA.reduce((s, r) => s + (r.sentiment || 0), 0) / resultsA.length;
    const avgSentimentB = resultsB.reduce((s, r) => s + (r.sentiment || 0), 0) / resultsB.length;
    const avgConfA = resultsA.reduce((s, r) => s + (r.confidence || 0), 0) / resultsA.length;
    const avgConfB = resultsB.reduce((s, r) => s + (r.confidence || 0), 0) / resultsB.length;

    // Count purchase intent preferences
    const intentScores: Record<string, number> = {
      definitely_yes: 5, probably_yes: 4, neutral: 3, probably_no: 2, definitely_no: 1,
    };
    const avgIntentA = resultsA.reduce((s, r) => s + (intentScores[r.purchase_intent] || 3), 0) / resultsA.length;
    const avgIntentB = resultsB.reduce((s, r) => s + (intentScores[r.purchase_intent] || 3), 0) / resultsB.length;

    const sentimentDelta = avgSentimentA - avgSentimentB;
    const winner = avgSentimentA > avgSentimentB + 0.05 ? "A" : avgSentimentB > avgSentimentA + 0.05 ? "B" : "tie";

    // Theme analysis per variant
    function getTopThemes(results: any[]) {
      const counts: Record<string, number> = {};
      results.forEach(r => (r.key_themes || []).forEach((t: string) => {
        const n = t.toLowerCase().trim();
        counts[n] = (counts[n] || 0) + 1;
      }));
      return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([theme, count]) => ({ theme, count }));
    }

    const comparison = {
      variant_a: {
        avg_sentiment: avgSentimentA,
        avg_confidence: avgConfA,
        avg_intent: avgIntentA,
        top_themes: getTopThemes(resultsA),
        responses: resultsA,
      },
      variant_b: {
        avg_sentiment: avgSentimentB,
        avg_confidence: avgConfB,
        avg_intent: avgIntentB,
        top_themes: getTopThemes(resultsB),
        responses: resultsB,
      },
      sentiment_delta: sentimentDelta,
      winner,
      participant_count: segments.length,
    };

    // Update simulation
    await supabase.from("simulations").update({
      status: "completed",
      results: comparison,
      confidence_score: (avgConfA + avgConfB) / 2,
      tokens_used: totalTokens,
      duration_ms: durationMs,
    }).eq("id", simulation.id);

    return jsonResponse(req, {
      simulation_id: simulation.id,
      comparison,
      tokens_used: totalTokens,
      duration_ms: durationMs,
    });
  } catch (err: any) {
    console.error("A/B test error:", err);
    return jsonResponse(req, { error: err.message || "Internal error" }, 500);
  }
});
