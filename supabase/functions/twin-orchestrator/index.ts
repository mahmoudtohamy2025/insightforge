import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { requireWorkspaceMember } from "../_shared/validation.ts";
import { checkRateLimit, recordTokenUsage } from "../_shared/rateLimiter.ts";
import { getWorkspaceTier } from "../_shared/tierEnforcement.ts";

/**
 * Autonomously calculates temporal context based on current JS Date
 * Splicing Hijri/Islamic calendar milestones dynamically.
 */
function getTemporalContext(ramadanMode: boolean): string {
  const currentMonth = new Date().getMonth();
  const currentDay = new Date().getDay(); // 0 is Sunday, 5 is Friday
  
  let temporalStr = "You are responding in the current geopolitical and economic climate of 2026. ";
  
  // Friday prayer context
  if (currentDay === 5) {
    temporalStr += "Today is Jumu'ah (Friday), a culturally significant day of gathering, prayer, and family meals in MENA. ";
  }

  if (ramadanMode) {
    temporalStr += "TEMPORAL CONTEXT: It is currently the Holy Month of Ramadan. Your consumption patterns shift drastically. You eat after sunset (Iftar), stay up late engaging with media, focus on charitable giving (Zakat), and are preparing for Eid shopping. Prioritize family and spiritual values in your decision-making. ";
  } else if (currentMonth === 11) { // Dec
    temporalStr += "TEMPORAL CONTEXT: It is year-end. You may be thinking about winter holidays or end-of-year sales events like White Friday. ";
  }

  return temporalStr;
}

/**
 * Generates the 6-layer prompt stack for a Digital Consumer Twin
 */
function build6LayerPrompt(
  segment: any, 
  studyContext: string, 
  categoryKnowledge: string, 
  ramadanMode: boolean,
  calibrationData: any[] = []
): string {
  const demo = segment.demographics || {};
  const psycho = segment.psychographics || {};
  const behavior = segment.behavioral_data || {};
  const culture = segment.cultural_context || {};

  // LAYER 1: Base Persona
  const layer1 = `LAYER 1 (BASE PERSONA):
You are a simulated digital twin named "${segment.name}". 
Age: ${demo.age_range || "25-35"} | Gender: ${demo.gender || "Mixed"} | Income: ${demo.income_level || "Middle income"} | Education: ${demo.education || "College educated"}
Values: ${psycho.values || "Not specified"} | Lifestyle: ${psycho.lifestyle || "Not specified"}
You must respond EXACTLY as this demographic profile would. Never break character.`;

  // LAYER 2: Cultural Context (MENA Customization)
  const isExpat = culture.nationality && culture.nationality.toLowerCase().includes("expat");
  const layer2 = `LAYER 2 (CULTURAL CONTEXT):
Region: ${culture.region || "MENA"} | Dialect Preference: ${culture.language || "Arabic/English Mix"}
Status: ${isExpat ? "Expatriate Consumer (Adaptable, Remittance-aware)" : "National/Local Citizen (Rooted, Traditional values)"}
You must incorporate regional nuances, family/tribal influence on decision-making, and appropriate cultural propriety (e.g., Halal standards, modesty, Wasta).`;

  // LAYER 3: Category Knowledge
  const layer3 = `LAYER 3 (CATEGORY KNOWLEDGE):
${categoryKnowledge || `General consumer awareness. Your brand preferences are: ${behavior.brand_preferences || "Standard regional brands"}.`}`;

  // LAYER 4: Temporal Context (Hijri/Seasonal)
  const layer4 = `LAYER 4 (TEMPORAL CONTEXT):\n${getTemporalContext(ramadanMode)}`;

  // LAYER 5: Study Context
  const layer5 = `LAYER 5 (STUDY CONTEXT & STIMULUS):
The researcher is asking about: "${studyContext}"`;

  // LAYER 6: Calibration Anchor
  let anchorText = "No historical background provided. Rely on foundation logic.";
  if (calibrationData && calibrationData.length > 0) {
    anchorText = `Past studies show your demographic behaves as follows: ${JSON.stringify(calibrationData.slice(0, 2))}. Anchor your predicted response to these historical truths.`;
  }
  const layer6 = `LAYER 6 (CALIBRATION ANCHOR):\n${anchorText}`;

  return [layer1, layer2, layer3, layer4, layer5, layer6, 
    "Return your response naturally. Base your confidence and sentiment purely on how strongly this persona connects with the stimulus."
  ].join("\n\n");
}

async function callGeminiOrchestrator(
  apiKey: string,
  systemPrompt: string,
  userMessage: string
) {
  const body: any = {
    model: "gemini-2.5-flash",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    tools: [{
      type: "function",
      function: {
        name: "deterministic_twin_response",
        description: "Output the twin's verbal response along with strict quantitative metrics.",
        parameters: {
          type: "object",
          properties: {
            verbal_response: { type: "string", description: "The natural language response of the twin." },
            confidence_score: { type: "number", description: "Integer from 0 to 100 indicating how certain the twin is based on their profile match to the stimulus." },
            sentiment_score: { type: "number", description: "Float from -1.0 (very negative) to 1.0 (very positive)." },
            key_behavioral_drivers: { type: "array", items: { type: "string" }, description: "2-3 structural reasons for their answer." },
          },
          required: ["verbal_response", "confidence_score", "sentiment_score", "key_behavioral_drivers"],
        },
      },
    }],
    tool_choice: { type: "function", function: { name: "deterministic_twin_response" } },
  };

  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini Orchestrator error: ${errText}`);
  }

  const data = await res.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  
  if (toolCall?.function?.arguments) {
    return JSON.parse(toolCall.function.arguments);
  }
  
  throw new Error("Failed to parse structured response from Gemini.");
}

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
    if (authError || !user) {
      return jsonResponse(req, { error: "Unauthorized" }, 401);
    }

    const { segment_id, workspace_id, study_context, category_knowledge = "", ramadan_mode = false, prior_history = "" } = await req.json();

    if (!segment_id || !workspace_id || !study_context) {
      return jsonResponse(req, { error: "Missing required fields: segment_id, workspace_id, study_context" }, 400);
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return jsonResponse(req, { error: "AI not configured" }, 500);
    }

    // 1. Fetch Segment
    const { data: segment, error: segError } = await supabase
      .from("segment_profiles")
      .select("*")
      .eq("id", segment_id)
      .eq("workspace_id", workspace_id)
      .single();

    if (segError || !segment) {
      return jsonResponse(req, { error: "Segment not found" }, 404);
    }

    // 2. Fetch Calibration Data
    const { data: calibrations } = await supabase
      .from("calibration_data")
      .select("actual_metric, predicted_metric, context_tags")
      .eq("segment_id", segment_id)
      .order("created_at", { ascending: false })
      .limit(3);

    // 3. Construct 6-Layer Orchestrator Stack
    const fullSystemPrompt = build6LayerPrompt(
      segment, 
      study_context, 
      category_knowledge, 
      ramadan_mode, 
      calibrations || []
    );

    const userMessage = prior_history ? `Previous conversation context:\n${prior_history}\n\nNow respond to the study context.` : `Please provide your response to the stimulus.`;

    // 4. Generate Deterministic Output
    const result = await callGeminiOrchestrator(GEMINI_API_KEY, fullSystemPrompt, userMessage);

    return jsonResponse(req, {
      success: true,
      segment_name: segment.name,
      response: result.verbal_response,
      confidence_score: result.confidence_score,  // 0-100 deterministic
      sentiment_score: result.sentiment_score,    // -1.0 to 1.0
      behavioral_drivers: result.key_behavioral_drivers,
      orchestrator_layers_used: 6
    });

  } catch (err: any) {
    console.error("Twin Orchestrator error:", err);
    return jsonResponse(req, { error: err.message || "Internal Server Error" }, 500);
  }
});
