import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { enforceTierLimit, getWorkspaceTier } from "../_shared/tierEnforcement.ts";
import { validateRequired, isValidUUID, sanitize, validateWorkspaceMembership, parseBody, validateUUIDs, validateEnumValue } from "../_shared/validation.ts";
import { checkRateLimit, recordTokenUsage } from "../_shared/rateLimiter.ts";
import { fetchGemini } from "../_shared/aiClient.ts";
import { buildPersonaPrompt } from "../_shared/prompts.ts";

// ── Call Gemini with structured policy evaluation output ──
async function callGemini(apiKey: string, systemPrompt: string, userPrompt: string) {
  const res = await fetchGemini(apiKey, {
    model: "gemini-2.5-flash",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    tools: [{
      type: "function",
      function: {
        name: "policy_evaluation",
        description: "Return the twin's evaluation of a policy",
        parameters: {
          type: "object",
          properties: {
            response: { type: "string", description: "Natural language opinion on the policy" },
            stance: { type: "string", enum: ["strongly_support", "support", "neutral", "oppose", "strongly_oppose"] },
            compliance_likelihood: { type: "number", description: "How likely to comply (0.0 to 1.0)" },
            personal_impact: { type: "string", enum: ["very_positive", "positive", "neutral", "negative", "very_negative"] },
            economic_impact_perception: { type: "string", enum: ["very_positive", "positive", "neutral", "negative", "very_negative"] },
            social_impact_perception: { type: "string", enum: ["very_positive", "positive", "neutral", "negative", "very_negative"] },
            key_concerns: { type: "array", items: { type: "string" }, description: "1-3 key concerns" },
            key_benefits: { type: "array", items: { type: "string" }, description: "1-3 perceived benefits" },
            willingness_to_advocate: { type: "number", description: "Likelihood to publicly support/oppose (0.0 to 1.0)" },
          },
          required: ["response", "stance", "compliance_likelihood", "personal_impact", "economic_impact_perception", "social_impact_perception", "key_concerns", "key_benefits", "willingness_to_advocate"],
        },
      },
    }],
    tool_choice: { type: "function", function: { name: "policy_evaluation" } },
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
    stance: "neutral", compliance_likelihood: 0.5, personal_impact: "neutral",
    economic_impact_perception: "neutral", social_impact_perception: "neutral",
    key_concerns: [], key_benefits: [], willingness_to_advocate: 0.3, tokensUsed,
  };
}

const IMPACT_AREAS = ["health", "economy", "environment", "social", "education", "technology", "security", "infrastructure"];
const STANCE_SCORES: Record<string, number> = {
  strongly_support: 2, support: 1, neutral: 0, oppose: -1, strongly_oppose: -2,
};
const IMPACT_SCORES: Record<string, number> = {
  very_positive: 2, positive: 1, neutral: 0, negative: -1, very_negative: -2,
};

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
      policy_description,
      impact_areas = [],
      severity = "moderate",
      workspace_id,
      title,
    } = body!;

    const reqCheck = validateRequired(body!, ["segment_ids", "policy_description", "workspace_id"]);
    if (reqCheck) return jsonResponse(req, reqCheck, 400);

    if (!isValidUUID(workspace_id)) return jsonResponse(req, { error: "workspace_id must be a valid UUID" }, 400);
    if (!Array.isArray(segment_ids) || segment_ids.length < 1) return jsonResponse(req, { error: "segment_ids must have at least 1 item" }, 400);

    const uuidCheck = validateUUIDs(segment_ids, "segment_ids");
    if (uuidCheck) return jsonResponse(req, uuidCheck, 400);

    const cleanPolicy = sanitize(policy_description, 5000);
    if (!cleanPolicy) return jsonResponse(req, { error: "policy_description must be a non-empty string" }, 400);

    if (severity !== undefined && severity !== "moderate") {
      const sevCheck = validateEnumValue(severity, "severity", ["low", "moderate", "high", "critical"]);
      if (sevCheck) return jsonResponse(req, sevCheck, 400);
    }

    // Validate impact areas
    const validAreas = (impact_areas as string[]).filter((a: string) => IMPACT_AREAS.includes(a));
    const areasText = validAreas.length > 0 ? validAreas.join(", ") : "general";

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
    const simTitle = title || `Policy Impact: ${policy_description.slice(0, 60)}`;
    const { data: simulation, error: simError } = await supabase
      .from("simulations")
      .insert({
        workspace_id,
        type: "policy",
        title: simTitle,
        stimulus: { policy_description, impact_areas: validAreas, severity },
        segment_ids,
        status: "running",
        created_by: user.id,
      })
      .select()
      .single();

    if (simError) return jsonResponse(req, { error: "Failed to create simulation" }, 500);

    // Evaluate each segment
    const segmentEvals: any[] = [];

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const persona = buildPersonaPrompt(seg);
      const prompt = `A new policy is being proposed:

"${policy_description}"

Severity level: ${severity}
Impact areas: ${areasText}

How would this policy affect you personally? Do you support or oppose it? Would you comply? What concerns or benefits do you see?`;

      const result = await callGemini(GEMINI_API_KEY, persona, prompt);
      totalTokens += result.tokensUsed;

      segmentEvals.push({
        segment_id: seg.id,
        segment_name: seg.name,
        response: result.response,
        stance: result.stance,
        compliance_likelihood: result.compliance_likelihood,
        personal_impact: result.personal_impact,
        economic_impact_perception: result.economic_impact_perception,
        social_impact_perception: result.social_impact_perception,
        key_concerns: result.key_concerns,
        key_benefits: result.key_benefits,
        willingness_to_advocate: result.willingness_to_advocate,
      });

      // Store twin response
      await supabase.from("twin_responses").insert({
        simulation_id: simulation.id,
        segment_id: seg.id,
        twin_index: i,
        persona_snapshot: { name: seg.name, demographics: seg.demographics },
        stimulus_variant: "policy_eval",
        response_text: result.response || "",
        sentiment: (STANCE_SCORES[result.stance] || 0) / 2, // -1 to 1
        confidence: result.compliance_likelihood || 0.5,
        behavioral_tags: [result.stance, result.personal_impact, ...(result.key_concerns || [])],
      });
    }

    // Aggregate metrics
    const stanceCounts: Record<string, number> = {};
    let totalStanceScore = 0;
    let totalCompliance = 0;
    let totalAdvocacy = 0;

    segmentEvals.forEach(e => {
      stanceCounts[e.stance] = (stanceCounts[e.stance] || 0) + 1;
      totalStanceScore += STANCE_SCORES[e.stance] || 0;
      totalCompliance += e.compliance_likelihood || 0;
      totalAdvocacy += e.willingness_to_advocate || 0;
    });

    const n = segmentEvals.length;

    // Impact heatmap: area → avg score
    const impactHeatmap: Record<string, number> = {};
    segmentEvals.forEach(e => {
      const ecoScore = IMPACT_SCORES[e.economic_impact_perception] || 0;
      const socScore = IMPACT_SCORES[e.social_impact_perception] || 0;
      const perScore = IMPACT_SCORES[e.personal_impact] || 0;

      // Map each valid area to the most relevant score
      validAreas.forEach((area: string) => {
        let score = perScore; // default
        if (area === "economy" || area === "infrastructure") score = ecoScore;
        if (area === "social" || area === "education") score = socScore;
        impactHeatmap[area] = ((impactHeatmap[area] || 0) * (n - 1) + score) / n;
      });
    });

    // Aggregate all concerns and benefits
    const concernCounts: Record<string, number> = {};
    const benefitCounts: Record<string, number> = {};
    segmentEvals.forEach(e => {
      (e.key_concerns || []).forEach((c: string) => {
        const k = c.toLowerCase().trim();
        concernCounts[k] = (concernCounts[k] || 0) + 1;
      });
      (e.key_benefits || []).forEach((b: string) => {
        const k = b.toLowerCase().trim();
        benefitCounts[k] = (benefitCounts[k] || 0) + 1;
      });
    });

    const topConcerns = Object.entries(concernCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([text, count]) => ({ text, count }));
    const topBenefits = Object.entries(benefitCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([text, count]) => ({ text, count }));

    // Support ratio: -1 (all oppose) to +1 (all support)
    const supportRatio = totalStanceScore / (n * 2); // normalize to -1..1

    const durationMs = Date.now() - startTime;

    // ── Record Token Usage ───────────────────────────────
    await recordTokenUsage(supabase, workspace_id as string, totalTokens);

    const results = {
      segment_evaluations: segmentEvals,
      aggregate: {
        support_ratio: supportRatio,
        stance_distribution: stanceCounts,
        avg_compliance: totalCompliance / n,
        avg_advocacy: totalAdvocacy / n,
        impact_heatmap: impactHeatmap,
        top_concerns: topConcerns,
        top_benefits: topBenefits,
        participant_count: n,
      },
    };

    // Update simulation
    await supabase.from("simulations").update({
      status: "completed",
      results,
      confidence_score: totalCompliance / n,
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
    console.error("Policy simulation error:", err);
    return jsonResponse(req, { error: err.message || "Internal error" }, 500);
  }
});
