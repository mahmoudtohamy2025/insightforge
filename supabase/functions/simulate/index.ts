import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { enforceTierLimit, getWorkspaceTier } from "../_shared/tierEnforcement.ts";
import { validateRequired, isValidUUID, sanitize, validateWorkspaceMembership, parseBody } from "../_shared/validation.ts";
import { checkRateLimit, recordTokenUsage } from "../_shared/rateLimiter.ts";

Deno.serve(async (req: any) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // ── Auth ───────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse(req, { error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify the user's JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse(req, { error: "Unauthorized" }, 401);
    }

    // ── Parse & Validate Input ───────────────────────────
    const { body, error: parseError } = await parseBody(req);
    if (parseError) return parseError;

    const { segment_id, stimulus, title, workspace_id } = body!;

    const reqCheck = validateRequired(body!, ["segment_id", "stimulus", "workspace_id"]);
    if (reqCheck) return jsonResponse(req, reqCheck, 400);

    if (!isValidUUID(segment_id)) {
      return jsonResponse(req, { error: "segment_id must be a valid UUID" }, 400);
    }
    if (!isValidUUID(workspace_id)) {
      return jsonResponse(req, { error: "workspace_id must be a valid UUID" }, 400);
    }

    const cleanStimulus = sanitize(stimulus, 10000);
    if (!cleanStimulus) {
      return jsonResponse(req, { error: "stimulus must be a non-empty string (max 10,000 chars)" }, 400);
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

    // ── Load Segment Profile ───────────────────────────────
    const { data: segment, error: segError } = await supabase
      .from("segment_profiles")
      .select("*")
      .eq("id", segment_id)
      .eq("workspace_id", workspace_id)
      .single();

    if (segError || !segment) {
      return jsonResponse(req, { error: "Segment not found" }, 404);
    }

    // ── Build Persona System Prompt ────────────────────────
    const demo = segment.demographics || {};
    const psycho = segment.psychographics || {};
    const behavior = segment.behavioral_data || {};
    const culture = segment.cultural_context || {};

    const personaPrompt = `You are a simulated consumer. You must respond ONLY from the perspective of this persona — never break character.

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
- Religious considerations: ${culture.religious || "Not specified"}

IMPORTANT RULES:
1. Stay in character at all times. Respond as this real person would.
2. Show genuine emotions, hesitations, and opinions — not robotic corporate-speak.
3. If you disagree with something, say so naturally.
4. Reference your lifestyle, experiences, and cultural context when relevant.
5. Be specific in your responses, not generic.`;

    const userPrompt = typeof stimulus === "string" 
      ? cleanStimulus 
      : `Please evaluate the following and share your honest reaction:\n\n${JSON.stringify(stimulus, null, 2)}`;

    // ── Call Gemini API ────────────────────────────────────
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return jsonResponse(req, { error: "AI not configured (missing GEMINI_API_KEY)" }, 500);
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
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "structured_response",
              description: "Return the twin's response with structured metadata",
              parameters: {
                type: "object",
                properties: {
                  response: { type: "string", description: "The twin's natural language response to the stimulus" },
                  sentiment: { type: "number", description: "Sentiment score from -1.0 (very negative) to 1.0 (very positive)" },
                  confidence: { type: "number", description: "How confident this persona would be in this response, from 0.0 to 1.0" },
                  key_themes: { type: "array", items: { type: "string" }, description: "3-5 key themes or decision factors in the response" },
                  purchase_intent: { type: "string", enum: ["definitely_yes", "probably_yes", "neutral", "probably_no", "definitely_no"], description: "Would this persona purchase/adopt/support this?" },
                  emotional_reaction: { type: "string", enum: ["excited", "interested", "neutral", "skeptical", "concerned", "opposed"], description: "Primary emotional reaction" },
                },
                required: ["response", "sentiment", "confidence", "key_themes", "purchase_intent", "emotional_reaction"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "structured_response" } },
      }),
    });

    const durationMs = Date.now() - startTime;

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("Gemini API error:", errText);
      return jsonResponse(req, { error: "AI generation failed", details: errText }, 502);
    }

    const aiData = await aiResponse.json();
    
    // Parse the structured response
    let parsed: any = {};
    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        parsed = JSON.parse(toolCall.function.arguments);
      }
    } catch (e) {
      // Fallback: use the raw message content
      const content = aiData.choices?.[0]?.message?.content || "";
      parsed = {
        response: content,
        sentiment: 0,
        confidence: 0.5,
        key_themes: [],
        purchase_intent: "neutral",
        emotional_reaction: "neutral",
      };
    }

    const tokensUsed = aiData.usage?.total_tokens || 0;

    // ── Record Token Usage ───────────────────────────────
    await recordTokenUsage(supabase, workspace_id as string, tokensUsed);

    // ── Store Simulation ──────────────────────────────────
    const simTitle = (title as string) || `Query: ${cleanStimulus.slice(0, 80)}...`;

    const { data: simulation, error: simError } = await supabase
      .from("simulations")
      .insert({
        workspace_id,
        type: "solo",
        title: simTitle,
        stimulus: typeof stimulus === "string" ? { text: cleanStimulus } : stimulus,
        segment_ids: [segment_id],
        status: "completed",
        results: {
          summary: parsed.response,
          sentiment: parsed.sentiment,
          confidence: parsed.confidence,
          key_themes: parsed.key_themes,
          purchase_intent: parsed.purchase_intent,
          emotional_reaction: parsed.emotional_reaction,
        },
        confidence_score: parsed.confidence,
        tokens_used: tokensUsed,
        duration_ms: durationMs,
        created_by: user.id,
      })
      .select()
      .single();

    if (simError) {
      console.error("Failed to store simulation:", simError);
      return jsonResponse(req, { error: "Failed to store simulation results" }, 500);
    }

    // ── Store Twin Response ───────────────────────────────
    await supabase.from("twin_responses").insert({
      simulation_id: simulation.id,
      segment_id,
      twin_index: 0,
      persona_snapshot: {
        name: segment.name,
        demographics: segment.demographics,
        psychographics: segment.psychographics,
        cultural_context: segment.cultural_context,
      },
      response_text: parsed.response || "",
      sentiment: parsed.sentiment,
      confidence: parsed.confidence,
      behavioral_tags: parsed.key_themes || [],
    });

    // ── Return Results ────────────────────────────────────
    return jsonResponse(req, {
      simulation_id: simulation.id,
      segment: { id: segment.id, name: segment.name },
      response: parsed.response,
      sentiment: parsed.sentiment,
      confidence: parsed.confidence,
      key_themes: parsed.key_themes,
      purchase_intent: parsed.purchase_intent,
      emotional_reaction: parsed.emotional_reaction,
      tokens_used: tokensUsed,
      duration_ms: durationMs,
    });
  } catch (err: any) {
    console.error("Simulate function error:", err);
    return jsonResponse(req, { error: err.message || "Internal error" }, 500);
  }
});
