import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { enforceTierLimit, getWorkspaceTier } from "../_shared/tierEnforcement.ts";
import { validateRequired, isValidUUID, sanitize, validateWorkspaceMembership, parseBody } from "../_shared/validation.ts";
import { checkRateLimit, recordTokenUsage } from "../_shared/rateLimiter.ts";
import { fetchGemini, parseToolCallResponse } from "../_shared/aiClient.ts";

Deno.serve(async (req: any) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // ── Auth ───────────────────────────────────────────
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

    const { workspace_id, title, description, category, target_audience, target_market } = body!;

    const reqCheck = validateRequired(body!, ["workspace_id", "title"]);
    if (reqCheck) return jsonResponse(req, reqCheck, 400);

    if (!isValidUUID(workspace_id)) {
      return jsonResponse(req, { error: "workspace_id must be a valid UUID" }, 400);
    }

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

    // Count matching digital twins
    const { count: twinCount } = await supabase
      .from("segment_profiles")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace_id);

    const systemPrompt = `You are a senior market research strategist with 20+ years of experience designing research programs.
Your role is to analyze a research requirement and recommend the optimal methodology to answer the business question.
Consider the MENA region's cultural nuances when relevant (gender separation, prayer scheduling, Halal considerations).`;

    const cleanTitle = sanitize(title as string, 500);
    const cleanDesc = sanitize((description as string) || "", 2000);

    const userPrompt = `Research Requirement:
Title: ${cleanTitle}
${cleanDesc ? `Description: ${cleanDesc}` : ""}
${category ? `Category: ${category}` : ""}
${target_audience ? `Target Audience: ${target_audience}` : ""}
${target_market ? `Target Market: ${target_market}` : ""}

Recommend the best research methodology to address this requirement.`;

    const startTime = Date.now();

    const aiResponse = await fetchGemini(GEMINI_API_KEY, {
      model: "gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: "recommend_methodology",
          description: "Recommend the optimal research methodology for the given requirement",
          parameters: {
            type: "object",
            properties: {
              recommended_methodology: {
                type: "string",
                enum: ["survey", "focus_group", "idi", "simulation", "ux_test", "diary_study", "mixed"],
                description: "Primary recommended method",
              },
              secondary_methodologies: {
                type: "array",
                items: { type: "string" },
                description: "1-2 secondary methods",
              },
              rationale: {
                type: "string",
                description: "2-3 sentence explanation of why this methodology best answers the question",
              },
              estimated_effort: {
                type: "string",
                enum: ["small", "medium", "large", "xl"],
              },
              estimated_timeline_weeks: { type: "number" },
              recommended_sample_size: { type: "number" },
              key_questions_to_answer: {
                type: "array",
                items: { type: "string" },
                description: "3-5 key research questions",
              },
              risks_and_considerations: { type: "string" },
              digital_twin_applicability: {
                type: "string",
                enum: ["pre-validation", "substitute", "complement", "not-applicable"],
              },
            },
            required: [
              "recommended_methodology", "rationale", "estimated_effort",
              "estimated_timeline_weeks", "recommended_sample_size",
              "key_questions_to_answer", "digital_twin_applicability",
            ],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "recommend_methodology" } },
    });

    const durationMs = Date.now() - startTime;

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("Gemini API error:", errText);
      return jsonResponse(req, { error: "AI generation failed", details: errText }, 502);
    }

    const aiData = await aiResponse.json();
    const { parsed: suggestion, tokensUsed } = parseToolCallResponse(aiData, {
      recommended_methodology: "mixed",
      rationale: "Unable to determine specific methodology",
    });

    await recordTokenUsage(supabase, workspace_id as string, tokensUsed);

    // Attach the count of available twins
    (suggestion as any).matching_twin_count = twinCount ?? 0;

    return jsonResponse(req, suggestion);
  } catch (err: any) {
    console.error("suggest-methodology error:", err);
    return jsonResponse(req, { error: err.message || "Internal error" }, 500);
  }
});
