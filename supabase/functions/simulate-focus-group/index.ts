import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { enforceTierLimit, getWorkspaceTier } from "../_shared/tierEnforcement.ts";
import { validateRequired, isValidUUID, sanitize, validateWorkspaceMembership, parseBody, validateUUIDs, validateNumberRange } from "../_shared/validation.ts";
import { checkRateLimit, recordTokenUsage } from "../_shared/rateLimiter.ts";
import { fetchGemini } from "../_shared/aiClient.ts";
import {
  effectiveTwinCount,
  samplingModeForTier,
  variedPersonaSuffix,
  arrayResponseToolSchema,
  parseArrayReactions,
  aggregateDistribution,
  mapWithConcurrency,
  MAX_CONCURRENCY,
} from "../_shared/multiTwin.ts";

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

  const aiResponse = await fetchGemini(apiKey, body);

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

// ── Free-tier path: one call returns N reactions for a segment ──
async function callGeminiArray(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  n: number,
): Promise<{ reactions: any[]; tokensUsed: number }> {
  const body: any = {
    model: "gemini-2.5-flash",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    tools: [arrayResponseToolSchema(n)],
    tool_choice: { type: "function", function: { name: "structured_responses" } },
  };

  const aiResponse = await fetchGemini(apiKey, body);
  if (!aiResponse.ok) {
    const errText = await aiResponse.text();
    throw new Error(`Gemini API error: ${errText}`);
  }
  const aiData = await aiResponse.json();
  const tokensUsed = aiData.usage?.total_tokens || 0;

  let reactions: any[] = [];
  try {
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      reactions = parseArrayReactions(JSON.parse(toolCall.function.arguments), n);
    }
  } catch (_) { /* fall through to fallback */ }

  if (reactions.length === 0) {
    // Never let a parse miss kill the run — degrade to one neutral reaction.
    const content = aiData.choices?.[0]?.message?.content || "";
    reactions = [{ response: content, sentiment: 0, confidence: 0.5, key_themes: [], purchase_intent: "neutral", emotional_reaction: "neutral" }];
  }
  return { reactions, tokensUsed };
}

function toEntry(seg: any, round: number, r: any) {
  return {
    segment_id: seg.id, segment_name: seg.name, demographics: seg.demographics, round,
    response: r.response, sentiment: r.sentiment, confidence: r.confidence,
    key_themes: r.key_themes, purchase_intent: r.purchase_intent, emotional_reaction: r.emotional_reaction,
  };
}

// Compact per-segment summary of the previous round — fed to later rounds INSTEAD
// of every raw response, so discussion-round input tokens stay bounded as N grows.
function summarizePriorRound(prevRound: any[], excludeSegmentId: string): string {
  const bySeg: Record<string, { name: string; sentiments: number[]; themes: Record<string, number> }> = {};
  for (const r of prevRound) {
    if (r.segment_id === excludeSegmentId) continue;
    let g = bySeg[r.segment_id];
    if (!g) { g = { name: r.segment_name, sentiments: [], themes: {} }; bySeg[r.segment_id] = g; }
    g.sentiments.push(r.sentiment || 0);
    for (const t of (r.key_themes || [])) {
      const n = String(t).toLowerCase().trim();
      if (n) g.themes[n] = (g.themes[n] || 0) + 1;
    }
  }
  const lines = Object.values(bySeg).map((g) => {
    const avg = g.sentiments.reduce((s, x) => s + x, 0) / (g.sentiments.length || 1);
    const mood = avg > 0.2 ? "positive" : avg < -0.2 ? "negative" : "mixed";
    const top = Object.entries(g.themes).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([t]) => t);
    return `- ${g.name}: ${mood} overall${top.length ? `, raising ${top.join(" and ")}` : ""}.`;
  });
  return lines.join("\n") || "(no other segments yet)";
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

    // ── Multi-twin sampling: N twins per segment (PRD #17 / multiTwin.ts) ──
    const twinN = effectiveTwinCount(tier, segments.length);
    const mode = samplingModeForTier(tier); // free → "array" (cheap), paid → "varied"

    const allRounds: any[] = [];
    let twinCounter = 0;

    for (let round = 0; round < rounds; round++) {
      const prevRound = round > 0 ? allRounds[round - 1] : null;

      const buildUserPrompt = (seg: any): string => {
        if (round === 0 || !prevRound) {
          return `A moderator asks the focus group:\n\n"${stimulusText}"\n\nPlease share your honest reaction and opinion.`;
        }
        const others = summarizePriorRound(prevRound, seg.id);
        return `The moderator asked: "${stimulusText}"\n\nHere is how the other segments reacted so far:\n\n${others}\n\nBased on what you've heard, what are your thoughts? Do you agree or disagree? What would you add?`;
      };

      const roundResponses: any[] = [];

      if (mode === "array") {
        // Free tier: one call per segment returns N reactions. Each segment call is
        // isolated — one failure drops that segment, never the whole run.
        const perSeg = await mapWithConcurrency(segments, MAX_CONCURRENCY, async (seg: any) => {
          try {
            const persona = buildPersonaPrompt(seg);
            const { reactions, tokensUsed } = await callGeminiArray(GEMINI_API_KEY, persona, buildUserPrompt(seg), twinN);
            return { seg, reactions, tokensUsed };
          } catch (e) {
            console.error("[multi-twin] segment array call failed:", (e as Error)?.message);
            return { seg, reactions: [] as any[], tokensUsed: 0 };
          }
        });
        for (const { seg, reactions, tokensUsed } of perSeg) {
          totalTokens += tokensUsed;
          for (const r of reactions) roundResponses.push(toEntry(seg, round, r));
        }
      } else {
        // Paid tiers: N varied sub-persona calls per segment (genuinely independent draws).
        // Each draw is isolated — one failed call drops one twin, never the whole run.
        const tasks: { seg: any; twinIndex: number }[] = [];
        for (const seg of segments) {
          for (let k = 0; k < twinN; k++) tasks.push({ seg, twinIndex: k });
        }
        const results = await mapWithConcurrency(tasks, MAX_CONCURRENCY, async ({ seg, twinIndex }) => {
          try {
            const persona = buildPersonaPrompt(seg) + variedPersonaSuffix(twinIndex, twinN, seg.demographics?.age_range);
            const result = await callGemini(GEMINI_API_KEY, persona, buildUserPrompt(seg), true);
            return { seg, result };
          } catch (e) {
            console.error("[multi-twin] twin call failed:", (e as Error)?.message);
            return { seg, result: null as any };
          }
        });
        for (const { seg, result } of results) {
          if (!result) continue;
          totalTokens += result.tokensUsed;
          roundResponses.push(toEntry(seg, round, result));
        }
      }

      // Persist each twin response (running twin_index avoids collisions across N×K×rounds).
      for (const entry of roundResponses) {
        await supabase.from("twin_responses").insert({
          simulation_id: simulation.id, segment_id: entry.segment_id, twin_index: twinCounter++,
          persona_snapshot: { name: entry.segment_name, demographics: entry.demographics, round },
          stimulus_variant: `round_${round}`, response_text: entry.response || "",
          sentiment: entry.sentiment, confidence: entry.confidence, behavioral_tags: entry.key_themes || [],
        });
      }

      allRounds.push(roundResponses);
    }

    const durationMs = Date.now() - startTime;

    // ── Record Token Usage ───────────────────────────────
    await recordTokenUsage(supabase, workspace_id as string, totalTokens);

    // Distribution-aware aggregate (mean ± stdev, per-segment, objection rate).
    const allResponses = allRounds.flat();
    if (allResponses.length === 0) {
      // Every twin call failed (e.g. a sustained Gemini outage). Mark failed
      // instead of stranding the row at 'running'; tokens were recorded above.
      await supabase.from("simulations").update({ status: "failed", tokens_used: totalTokens, duration_ms: durationMs }).eq("id", simulation.id);
      return jsonResponse(req, { error: "All twin simulations failed. Please try again." }, 502);
    }
    const aggregate = aggregateDistribution(
      allResponses.map((r: any) => ({
        segment_id: r.segment_id, segment_name: r.segment_name,
        sentiment: r.sentiment, confidence: r.confidence,
        purchase_intent: r.purchase_intent, key_themes: r.key_themes,
      })),
      segments.length,
    );
    // suggest-next-test (the aha loop) reads aggregate.total_rounds — keep it.
    (aggregate as any).total_rounds = rounds;
    const sampling = { twins_per_segment: twinN, mode, sample_size: allResponses.length };

    // Update simulation with results
    await supabase.from("simulations").update({
      status: "completed",
      results: { rounds: allRounds, aggregate, sampling },
      confidence_score: aggregate.avg_confidence,
      tokens_used: totalTokens,
      duration_ms: durationMs,
    }).eq("id", simulation.id);

    return jsonResponse(req, {
      simulation_id: simulation.id,
      rounds: allRounds,
      aggregate,
      sampling,
      tokens_used: totalTokens,
      duration_ms: durationMs,
    });
  } catch (err: any) {
    console.error("Focus group error:", err);
    return jsonResponse(req, { error: err.message || "Internal error" }, 500);
  }
});
