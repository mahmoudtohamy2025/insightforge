import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { enforceTierLimit, getWorkspaceTier } from "../_shared/tierEnforcement.ts";
import { validateRequired, isValidUUID, sanitize, validateWorkspaceMembership, parseBody, validateUUIDs, validateNumberRange } from "../_shared/validation.ts";
import { checkRateLimit, recordTokenUsage } from "../_shared/rateLimiter.ts";

// ── Build persona prompt ──
function buildPersonaPrompt(segment: any): string {
  const demo = segment.demographics || {};
  const psycho = segment.psychographics || {};
  const behavior = segment.behavioral_data || {};
  const culture = segment.cultural_context || {};

  return `You are a simulated consumer persona named "${segment.name}". Stay in character.

DEMOGRAPHICS: Age ${demo.age_range || "25-35"}, ${demo.gender || "Mixed"}, ${demo.location || "Urban"}, income: ${demo.income_level || "Middle"}, education: ${demo.education || "College"}, job: ${demo.occupation || "Professional"}.
PSYCHOGRAPHICS: Values: ${psycho.values || "N/A"}. Lifestyle: ${psycho.lifestyle || "N/A"}. Interests: ${psycho.interests || "N/A"}.
BEHAVIOR: Purchase: ${behavior.purchase_behavior || "N/A"}. Brands: ${behavior.brand_preferences || "N/A"}. Decisions: ${behavior.decision_factors || "N/A"}.
CULTURE: ${culture.region || "N/A"}, language: ${culture.language || "English"}.

Rules: Stay in character. Be specific, not generic. 2-3 sentences max.`;
}

// ── Call Gemini with structured output ──
async function callGemini(apiKey: string, systemPrompt: string, userPrompt: string) {
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: "market_evaluation",
          description: "Return the twin's market evaluation of a product",
          parameters: {
            type: "object",
            properties: {
              response: { type: "string", description: "Natural language opinion" },
              purchase_probability: { type: "number", description: "Probability of buying (0.0 to 1.0)" },
              price_sensitivity: { type: "string", enum: ["very_low", "low", "moderate", "high", "very_high"] },
              adoption_timing: { type: "string", enum: ["innovator", "early_adopter", "early_majority", "late_majority", "laggard"] },
              word_of_mouth_likelihood: { type: "number", description: "Likelihood of recommending (0.0 to 1.0)" },
              key_barriers: { type: "array", items: { type: "string" }, description: "1-3 purchase barriers" },
              key_drivers: { type: "array", items: { type: "string" }, description: "1-3 purchase drivers" },
            },
            required: ["response", "purchase_probability", "price_sensitivity", "adoption_timing", "word_of_mouth_likelihood", "key_barriers", "key_drivers"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "market_evaluation" } },
    }),
  });

  if (!res.ok) throw new Error(`Gemini error: ${await res.text()}`);
  const data = await res.json();
  const tokensUsed = data.usage?.total_tokens || 0;

  try {
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      return { ...JSON.parse(toolCall.function.arguments), tokensUsed };
    }
  } catch (_) { /* fallback */ }

  return {
    response: data.choices?.[0]?.message?.content || "",
    purchase_probability: 0.3, price_sensitivity: "moderate",
    adoption_timing: "early_majority", word_of_mouth_likelihood: 0.3,
    key_barriers: [], key_drivers: [], tokensUsed,
  };
}

// ── Bass Diffusion Model ──
// F(t) = 1 - e^(-(p+q)*t) / (1 + (q/p) * e^(-(p+q)*t))
// p = coefficient of innovation, q = coefficient of imitation (network effects)
function bassDiffusion(
  months: number,
  marketSize: number,
  p: number, // innovation (typically 0.01-0.05)
  q: number, // imitation/network (typically 0.3-0.5)
): { month: number; cumulative_adopters: number; new_adopters: number; penetration: number }[] {
  const curve: any[] = [];
  let cumulative = 0;

  for (let t = 1; t <= months; t++) {
    const remaining = marketSize - cumulative;
    const newAdopters = remaining * (p + q * (cumulative / marketSize));
    cumulative = Math.min(cumulative + Math.max(newAdopters, 0), marketSize);

    curve.push({
      month: t,
      cumulative_adopters: Math.round(cumulative),
      new_adopters: Math.round(Math.max(newAdopters, 0)),
      penetration: parseFloat((cumulative / marketSize).toFixed(4)),
    });
  }

  return curve;
}

// ── Main Handler ──
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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return jsonResponse(req, { error: "Unauthorized" }, 401);

    // ── Parse & Validate Input ───────────────────────────
    const { body, error: parseError } = await parseBody(req);
    if (parseError) return parseError;

    const {
      segment_ids,
      product,
      pricing,
      market_size = 100000,
      time_horizon_months = 24,
      workspace_id,
      title,
    } = body!;

    const reqCheck = validateRequired(body!, ["segment_ids", "product", "workspace_id"]);
    if (reqCheck) return jsonResponse(req, reqCheck, 400);

    if (!isValidUUID(workspace_id)) return jsonResponse(req, { error: "workspace_id must be a valid UUID" }, 400);
    if (!Array.isArray(segment_ids) || segment_ids.length < 1) return jsonResponse(req, { error: "segment_ids must have at least 1 item" }, 400);

    const uuidCheck = validateUUIDs(segment_ids, "segment_ids");
    if (uuidCheck) return jsonResponse(req, uuidCheck, 400);

    const cleanProduct = sanitize(product, 5000);
    if (!cleanProduct) return jsonResponse(req, { error: "product must be a non-empty string" }, 400);

    if (market_size !== undefined) {
      const sizeCheck = validateNumberRange(market_size, "market_size", 1000, 10000000);
      if (sizeCheck) return jsonResponse(req, sizeCheck, 400);
    }
    if (time_horizon_months !== undefined) {
      const horizonCheck = validateNumberRange(time_horizon_months, "time_horizon_months", 6, 60);
      if (horizonCheck) return jsonResponse(req, horizonCheck, 400);
    }

    const months = Math.min(Math.max(time_horizon_months as number, 6), 60);
    const mktSize = Math.min(Math.max(market_size as number, 1000), 10000000);
    const priceNum = parseFloat(pricing as string) || 0;

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

    // Create simulation
    const simTitle = (title as string) || `Market Sim: ${cleanProduct.slice(0, 60)}`;
    const { data: simulation, error: simError } = await supabase
      .from("simulations")
      .insert({
        workspace_id,
        type: "market_sim",
        title: simTitle,
        stimulus: { product, pricing: priceNum, market_size: mktSize, time_horizon_months: months },
        segment_ids,
        status: "running",
        created_by: user.id,
      })
      .select()
      .single();

    if (simError) return jsonResponse(req, { error: "Failed to create simulation" }, 500);

    // Evaluate each segment
    const segmentEvals: any[] = [];
    let avgPurchaseProb = 0;
    let avgWOM = 0;

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const persona = buildPersonaPrompt(seg);
      const prompt = `A company is launching: "${product}"${priceNum > 0 ? ` at $${priceNum}` : ""}. Target market size is ${mktSize.toLocaleString()} potential customers.

Evaluate this product from your perspective: Would you buy it? At this price? Would you tell friends about it? What might stop you? What excites you?`;

      const result = await callGemini(GEMINI_API_KEY, persona, prompt);
      totalTokens += result.tokensUsed;

      avgPurchaseProb += result.purchase_probability || 0;
      avgWOM += result.word_of_mouth_likelihood || 0;

      segmentEvals.push({
        segment_id: seg.id,
        segment_name: seg.name,
        response: result.response,
        purchase_probability: result.purchase_probability,
        price_sensitivity: result.price_sensitivity,
        adoption_timing: result.adoption_timing,
        word_of_mouth_likelihood: result.word_of_mouth_likelihood,
        key_barriers: result.key_barriers,
        key_drivers: result.key_drivers,
      });

      // Store twin response
      await supabase.from("twin_responses").insert({
        simulation_id: simulation.id,
        segment_id: seg.id,
        twin_index: i,
        persona_snapshot: { name: seg.name, demographics: seg.demographics },
        stimulus_variant: "market_eval",
        response_text: result.response || "",
        sentiment: (result.purchase_probability || 0.5) * 2 - 1, // map 0-1 to -1 to 1
        confidence: result.word_of_mouth_likelihood || 0.5,
        behavioral_tags: [result.adoption_timing, result.price_sensitivity, ...(result.key_drivers || [])],
      });
    }

    avgPurchaseProb /= segments.length;
    avgWOM /= segments.length;

    // ── Record Token Usage ───────────────────────────────
    await recordTokenUsage(supabase, workspace_id as string, totalTokens);

    // Compute Bass model parameters from AI evaluations
    // p (innovation) = avg purchase probability * 0.03 (scaled for realism)
    // q (imitation/network) = avg WOM * 0.4 (network effect strength)
    const p = Math.max(0.005, Math.min(avgPurchaseProb * 0.03, 0.08));
    const q = Math.max(0.1, Math.min(avgWOM * 0.4, 0.6));

    // Generate adoption curve
    const adoptionCurve = bassDiffusion(months, mktSize, p, q);

    // Revenue projections (if pricing provided)
    const revenueData = priceNum > 0
      ? adoptionCurve.map(d => ({
          month: d.month,
          monthly_revenue: d.new_adopters * priceNum,
          cumulative_revenue: d.cumulative_adopters * priceNum,
        }))
      : null;

    // Find peak adoption month
    const peakMonth = adoptionCurve.reduce((best, d) =>
      d.new_adopters > (best?.new_adopters || 0) ? d : best, adoptionCurve[0]);

    // Saturation point (when >= 90% penetration)
    const saturationMonth = adoptionCurve.find(d => d.penetration >= 0.9)?.month || null;

    // Network effect multiplier
    const networkMultiplier = q / p;

    const durationMs = Date.now() - startTime;

    const results = {
      segment_evaluations: segmentEvals,
      adoption_curve: adoptionCurve,
      revenue_projections: revenueData,
      aggregate: {
        market_size: mktSize,
        avg_purchase_probability: avgPurchaseProb,
        avg_word_of_mouth: avgWOM,
        bass_parameters: { p, q },
        network_multiplier: networkMultiplier,
        peak_adoption_month: peakMonth.month,
        peak_new_adopters: peakMonth.new_adopters,
        saturation_month: saturationMonth,
        final_penetration: adoptionCurve[adoptionCurve.length - 1].penetration,
        total_adopters_projected: adoptionCurve[adoptionCurve.length - 1].cumulative_adopters,
        total_revenue_projected: revenueData
          ? revenueData[revenueData.length - 1].cumulative_revenue
          : null,
      },
    };

    // Update simulation
    await supabase.from("simulations").update({
      status: "completed",
      results,
      confidence_score: avgPurchaseProb,
      tokens_used: totalTokens,
      duration_ms: durationMs,
    }).eq("id", simulation.id);

    return jsonResponse(req, {
      simulation_id: simulation.id,
      ...results,
      tokens_used: totalTokens,
      duration_ms: durationMs,
    });
  } catch (err: any) {
    console.error("Market simulation error:", err);
    return jsonResponse(req, { error: err.message || "Internal error" }, 500);
  }
});
