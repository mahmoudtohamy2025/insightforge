import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { enforceTierLimit, getWorkspaceTier } from "../_shared/tierEnforcement.ts";
import { validateRequired, isValidUUID, sanitize, validateWorkspaceMembership, parseBody, validateUUIDs, validateNumberRange } from "../_shared/validation.ts";
import { checkRateLimit, recordTokenUsage } from "../_shared/rateLimiter.ts";

// ── Shared: Build persona system prompt from segment ──
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
- Attitudes: ${psycho.attitudes || "Not specified"}
- Interests: ${psycho.interests || "Not specified"}

BEHAVIORAL PATTERNS:
- Purchase behavior: ${behavior.purchase_behavior || "Not specified"}
- Media consumption: ${behavior.media_consumption || "Not specified"}
- Brand preferences: ${behavior.brand_preferences || "Not specified"}
- Decision factors: ${behavior.decision_factors || "Not specified"}

CULTURAL CONTEXT:
- Region: ${culture.region || "Not specified"}
- Language preference: ${culture.language || "English"}
- Cultural norms: ${culture.norms || "Not specified"}

IMPORTANT RULES:
1. Stay in character. Respond as this real person would.
2. Show genuine emotions, hesitations, and opinions.
3. If you disagree with something or with another participant, say so naturally.
4. Reference your lifestyle, experiences, and cultural context.
5. Keep responses concise (2-4 sentences) — this is a focus group discussion, not an essay.
6. You may agree, disagree, or build on what others said.`;
}

// ── Shared: Call Gemini with structured output ──
async function callGemini(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  withStructuredOutput = false
): Promise<{ response: string; sentiment: number; confidence: number; key_themes: string[]; purchase_intent: string; emotional_reaction: string; tokensUsed: number }> {
  const body: any = {
    model: "gemini-2.5-flash",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  };

  if (withStructuredOutput) {
    body.tools = [{
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
    }];
    body.tool_choice = { type: "function", function: { name: "structured_response" } };
  }

  const aiResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!aiResponse.ok) {
    const errText = await aiResponse.text();
    throw new Error(`Gemini API error: ${errText}`);
  }

  const aiData = await aiResponse.json();
  const tokensUsed = aiData.usage?.total_tokens || 0;

  if (withStructuredOutput) {
    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        const parsed = JSON.parse(toolCall.function.arguments);
        return { ...parsed, tokensUsed };
      }
    } catch (_) { /* fallback below */ }
  }

  const content = aiData.choices?.[0]?.message?.content || "";
  return {
    response: content,
    sentiment: 0,
    confidence: 0.5,
    key_themes: [],
    purchase_intent: "neutral",
    emotional_reaction: "neutral",
    tokensUsed,
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

    const { segment_ids, stimulus, title, workspace_id, num_rounds = 2 } = body!;

    const reqCheck = validateRequired(body!, ["segment_ids", "stimulus", "workspace_id"]);
    if (reqCheck) return jsonResponse(req, reqCheck, 400);

    if (!isValidUUID(workspace_id)) return jsonResponse(req, { error: "workspace_id must be a valid UUID" }, 400);
    if (!Array.isArray(segment_ids) || segment_ids.length < 2) return jsonResponse(req, { error: "segment_ids must have at least 2 items" }, 400);
    if (segment_ids.length > 5) return jsonResponse(req, { error: "Maximum 5 segments per focus group" }, 400);

    const uuidCheck = validateUUIDs(segment_ids, "segment_ids");
    if (uuidCheck) return jsonResponse(req, uuidCheck, 400);

    const cleanStimulus = sanitize(stimulus, 10000);
    if (!cleanStimulus) return jsonResponse(req, { error: "stimulus must be a non-empty string" }, 400);

    if (num_rounds !== undefined) {
      const roundsCheck = validateNumberRange(num_rounds, "num_rounds", 1, 3);
      if (roundsCheck) return jsonResponse(req, roundsCheck, 400);
    }
    const rounds = Math.min(Math.max(num_rounds as number, 1), 3);

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
    if (!GEMINI_API_KEY) {
      return jsonResponse(req, { error: "AI not configured (missing GEMINI_API_KEY)" }, 500);
    }

    // Load all segments
    const { data: segments, error: segError } = await supabase
      .from("segment_profiles")
      .select("*")
      .in("id", segment_ids as string[])
      .eq("workspace_id", workspace_id);

    if (segError || !segments?.length) {
      return jsonResponse(req, { error: "Segments not found" }, 404);
    }

    const startTime = Date.now();
    let totalTokens = 0;

    // Create simulation record (status: running)
    const simTitle = title || `Focus Group: ${(typeof stimulus === "string" ? stimulus : JSON.stringify(stimulus)).slice(0, 80)}`;
    const { data: simulation, error: simError } = await supabase
      .from("simulations")
      .insert({
        workspace_id,
        type: "focus_group",
        title: simTitle,
        stimulus: typeof stimulus === "string" ? { text: stimulus } : stimulus,
        segment_ids,
        config: { num_rounds: rounds },
        status: "running",
        created_by: user.id,
      })
      .select()
      .single();

    if (simError) {
      return jsonResponse(req, { error: "Failed to create simulation" }, 500);
    }

    const stimulusText = typeof stimulus === "string" ? stimulus : JSON.stringify(stimulus, null, 2);

    // Store all responses grouped by round
    const allRounds: any[] = [];

    for (let round = 0; round < rounds; round++) {
      const roundResponses: any[] = [];

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const persona = buildPersonaPrompt(seg);

        let userPrompt = "";
        if (round === 0) {
          // First round: respond to the stimulus directly
          userPrompt = `A moderator asks the focus group:\n\n"${stimulusText}"\n\nPlease share your honest reaction and opinion.`;
        } else {
          // Subsequent rounds: see what others said and respond
          const previousRound = allRounds[round - 1];
          const othersResponses = previousRound
            .filter((r: any) => r.segment_id !== seg.id)
            .map((r: any) => `${r.segment_name}: "${r.response}"`)
            .join("\n\n");

          userPrompt = `The moderator asked: "${stimulusText}"\n\nOther participants just said:\n\n${othersResponses}\n\nBased on what you've heard from the other participants, what are your thoughts? Do you agree or disagree? What would you add?`;
        }

        const result = await callGemini(GEMINI_API_KEY, persona, userPrompt, true);
        totalTokens += result.tokensUsed;

        const responseEntry = {
          segment_id: seg.id,
          segment_name: seg.name,
          round,
          response: result.response,
          sentiment: result.sentiment,
          confidence: result.confidence,
          key_themes: result.key_themes,
          purchase_intent: result.purchase_intent,
          emotional_reaction: result.emotional_reaction,
        };

        roundResponses.push(responseEntry);

        // Store twin response
        await supabase.from("twin_responses").insert({
          simulation_id: simulation.id,
          segment_id: seg.id,
          twin_index: round * segments.length + i,
          persona_snapshot: {
            name: seg.name,
            demographics: seg.demographics,
            round,
          },
          stimulus_variant: `round_${round}`,
          response_text: result.response || "",
          sentiment: result.sentiment,
          confidence: result.confidence,
          behavioral_tags: result.key_themes || [],
        });
      }

      allRounds.push(roundResponses);
    }

    const durationMs = Date.now() - startTime;

    // Compute aggregate metrics
    // ── Record Token Usage ───────────────────────────────
    await recordTokenUsage(supabase, workspace_id as string, totalTokens);

    const allResponses = allRounds.flat();
    const avgSentiment = allResponses.reduce((s: number, r: any) => s + (r.sentiment || 0), 0) / allResponses.length;
    const avgConfidence = allResponses.reduce((s: number, r: any) => s + (r.confidence || 0), 0) / allResponses.length;

    // Compute consensus: how close are sentiments to each other?
    const sentiments = allResponses.map((r: any) => r.sentiment || 0);
    const sentimentStdDev = Math.sqrt(sentiments.reduce((sum: number, s: number) => sum + Math.pow(s - avgSentiment, 2), 0) / sentiments.length);
    const consensusScore = Math.max(0, 1 - sentimentStdDev);

    // Aggregate key themes across all responses
    const themeCounts: Record<string, number> = {};
    allResponses.forEach((r: any) => {
      (r.key_themes || []).forEach((t: string) => {
        const normalized = t.toLowerCase().trim();
        themeCounts[normalized] = (themeCounts[normalized] || 0) + 1;
      });
    });
    const topThemes = Object.entries(themeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([theme, count]) => ({ theme, count }));

    // Update simulation with results
    await supabase.from("simulations").update({
      status: "completed",
      results: {
        rounds: allRounds,
        aggregate: {
          avg_sentiment: avgSentiment,
          avg_confidence: avgConfidence,
          consensus_score: consensusScore,
          top_themes: topThemes,
          participant_count: segments.length,
          total_rounds: rounds,
        },
      },
      confidence_score: avgConfidence,
      tokens_used: totalTokens,
      duration_ms: durationMs,
    }).eq("id", simulation.id);

    return jsonResponse(req, {
      simulation_id: simulation.id,
      rounds: allRounds,
      aggregate: {
        avg_sentiment: avgSentiment,
        avg_confidence: avgConfidence,
        consensus_score: consensusScore,
        top_themes: topThemes,
        participant_count: segments.length,
      },
      tokens_used: totalTokens,
      duration_ms: durationMs,
    });
  } catch (err: any) {
    console.error("Focus group error:", err);
    return jsonResponse(req, { error: err.message || "Internal error" }, 500);
  }
});
