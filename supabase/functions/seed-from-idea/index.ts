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

    const { idea, workspace_id } = body!;
    const reqCheck = validateRequired(body!, ["idea", "workspace_id"]);
    if (reqCheck) return jsonResponse(req, reqCheck, 400);
    if (typeof idea !== "string" || idea.trim().length < 10) {
      return jsonResponse(req, { error: "idea must be at least 10 characters" }, 400);
    }
    if (idea.length > 1000) {
      return jsonResponse(req, { error: "idea must be 1000 characters or less" }, 400);
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

    // Fetch the workspace's segments — we anchor the AI's choices to real IDs.
    const { data: segments, error: segError } = await supabase
      .from("segment_profiles")
      .select("id, name, demographics, psychographics, cultural_context")
      .eq("workspace_id", workspace_id)
      .order("name")
      .limit(40);

    if (segError) {
      console.error("[seed-from-idea] Segment fetch error:", segError);
      return jsonResponse(req, { error: "Could not load segments" }, 500);
    }

    if (!segments || segments.length === 0) {
      return jsonResponse(req, {
        error: "No segments yet — create at least one segment before seeding a simulation",
        code: "NO_SEGMENTS",
      }, 422);
    }

    const segmentSummaries = segments
      .map((s: any) => {
        const demo = JSON.stringify(s.demographics || {}).slice(0, 200);
        const psycho = JSON.stringify(s.psychographics || {}).slice(0, 200);
        const culture = JSON.stringify(s.cultural_context || {}).slice(0, 100);
        return `- ${s.id}: "${s.name}"\n  demographics: ${demo}\n  psychographics: ${psycho}\n  cultural_context: ${culture}`;
      })
      .join("\n\n");

    const systemPrompt = `You are a research strategist setting up a founder's first AI focus group from a single-sentence idea.

Your job: pick the 1-3 most relevant existing segments to test against, write a focused 3-5 sentence stimulus the personas will respond to, and recommend how many rounds (2-4) the simulation should run.

Be opinionated. Do not pick more segments than necessary — if one segment is the obvious right audience, pick just one. Two or three only if testing across audiences is genuinely informative.

The stimulus must be concrete. Mention the product/idea, the context (when/where it would be used), and the specific decision the founder wants feedback on. Avoid open-ended questions like "what do you think?" — instead ask "Would you pay X for Y? Why or why not?" style.

num_rounds: 2 is the default for a basic gut check. 3 if there's a clear follow-up worth probing.`;

    const userPrompt = `FOUNDER'S IDEA:
${idea.trim()}

AVAILABLE SEGMENTS (only pick segment_ids from this list — never invent IDs):
${segmentSummaries}

Pick 1-3 segments, write the stimulus, recommend num_rounds, and explain your choices in one short sentence.`;

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) return jsonResponse(req, { error: "AI not configured" }, 500);

    const validIdSet = new Set(segments.map((s: any) => s.id));

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
            name: "seed_simulation",
            description:
              "Choose segments + write a stimulus + pick num_rounds for the founder's first focus group on this idea",
            parameters: {
              type: "object",
              properties: {
                segment_ids: {
                  type: "array",
                  minItems: 1,
                  maxItems: 3,
                  items: { type: "string" },
                  description: "1-3 segment IDs from the available list (no inventing IDs)",
                },
                stimulus: {
                  type: "string",
                  description: "3-5 sentence prompt to send to the personas. Concrete and specific.",
                },
                num_rounds: {
                  type: "integer",
                  minimum: 2,
                  maximum: 3,
                },
                rationale: {
                  type: "string",
                  description: "One sentence on why these segments + this stimulus.",
                },
              },
              required: ["segment_ids", "stimulus", "num_rounds", "rationale"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "seed_simulation" } },
    });

    const durationMs = Date.now() - startTime;
    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("[seed-from-idea] Gemini error:", errText);
      return jsonResponse(req, { error: "AI generation failed" }, 502);
    }

    const aiData = await aiResponse.json();
    let parsed: {
      segment_ids: string[];
      stimulus: string;
      num_rounds: number;
      rationale: string;
    } = { segment_ids: [], stimulus: "", num_rounds: 2, rationale: "" };
    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        parsed = JSON.parse(toolCall.function.arguments);
      }
    } catch (e) {
      console.error("[seed-from-idea] Parse error:", e);
      return jsonResponse(req, { error: "AI response could not be parsed" }, 502);
    }

    // Fail loudly if the AI hallucinated segment IDs that don't belong to the workspace.
    const validSegmentIds = parsed.segment_ids.filter((id) => validIdSet.has(id));
    if (validSegmentIds.length === 0) {
      return jsonResponse(
        req,
        { error: "AI returned no valid segment selections — please retry or pick segments manually" },
        502,
      );
    }

    if (!parsed.stimulus || parsed.stimulus.trim().length < 20) {
      return jsonResponse(
        req,
        { error: "AI returned an empty or too-short stimulus — please retry" },
        502,
      );
    }

    const tokensUsed = aiData.usage?.total_tokens || 0;
    await recordTokenUsage(supabase, workspace_id as string, tokensUsed);

    return jsonResponse(req, {
      segment_ids: validSegmentIds,
      stimulus: parsed.stimulus.trim(),
      num_rounds: Math.min(Math.max(parsed.num_rounds || 2, 2), 3),
      rationale: parsed.rationale,
      tokens_used: tokensUsed,
      duration_ms: durationMs,
    });
  } catch (err: any) {
    console.error("Seed from idea error:", err);
    return jsonResponse(req, { error: err.message || "Internal error" }, 500);
  }
});
