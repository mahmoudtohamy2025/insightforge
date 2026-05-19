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

    // Aha-loop part 4: fetch last 5 past simulations on this workspace
    // (excluding the current one) for cross-cycle awareness. AI infers which
    // focus_areas have already been probed and biases suggestions toward
    // unexplored axes.
    const { data: pastSims } = await supabase
      .from("simulations")
      .select("id, type, stimulus, results, created_at")
      .eq("workspace_id", workspace_id)
      .neq("id", simulation_id)
      .order("created_at", { ascending: false })
      .limit(5);

    const extractStimulusText = (raw: unknown): string => {
      if (raw && typeof raw === "object" && "text" in (raw as Record<string, unknown>)) {
        return String((raw as { text: unknown }).text);
      }
      if (typeof raw === "string") return raw;
      return JSON.stringify(raw ?? "");
    };

    const pastDigest = (pastSims || []).map((p: any, i: number) => {
      const stim = extractStimulusText(p.stimulus).slice(0, 400);
      const agg = ((p.results || {}).aggregate || {}) as Record<string, any>;
      const themes = (agg.top_themes || []) as Array<{ theme: string; count: number }>;
      const sentiment = Number(agg.avg_sentiment ?? (p.results || {}).sentiment ?? 0);
      const themeStr = themes.length
        ? themes.map((t) => `${t.theme} (${t.count})`).slice(0, 5).join(", ")
        : "(no themes recorded)";
      return `[${i + 1}] STIMULUS: "${stim}"\n    THEMES: ${themeStr}\n    AVG_SENTIMENT: ${sentiment.toFixed(2)}`;
    }).join("\n\n");

    const hasPastSims = (pastSims || []).length > 0;

    const systemPrompt = `You are a sharp research strategist helping a solo founder decide what to test next.

The founder just ran a simulated study. Your job has FOUR parts, in order:

1. **Identify the dominant objection** from the CURRENT simulation. The single most important pushback, hesitation, or concern the personas raised. One-line headline + estimated % of personas affected.
   - If broadly positive with no meaningful pushback, affected_pct=0 and the headline says "No clear objection — reception was broadly positive across personas".

2. **Classify the explored axes across this workspace's testing history.** For each of the 5 axes (price | feature | messaging | audience | positioning), decide its status by reading the CURRENT simulation AND the past simulations provided:
   - "covered" — tested, findings addressed (broadly positive reception, OR the objection was specific enough that the founder has a clear next step)
   - "open" — tested but the dominant objection on that axis is still live and unresolved
   - "untested" — not explored yet
   ALL 5 axes must appear in explored_axes, exactly once each. Write a one-clause evidence string for each — what makes you say that status.

3. **Write the meta_recommendation.** A single sentence that frames where the founder is in their testing journey, naming the unexplored or still-open axis they should bias toward next. Example: "You've stress-tested pricing and messaging — positioning is your biggest unexplored axis." Set meta_recommendation to null ONLY if there are zero past simulations (this is the founder's first run on the workspace).

4. **Propose EXACTLY 3 follow-up tests** ordered with the one resolving the biggest uncertainty FIRST. Bias toward unexplored or "open" axes from explored_axes — don't keep re-testing axes already "covered". Each suggestion: specific, opinionated, names a concrete variant. Avoid generic advice.

The suggestions should address the dominant objection AND/OR fill the most important gap from explored_axes.`;

    const userPrompt = `CURRENT SIMULATION

ORIGINAL STIMULUS:
${stimulusText}

WHAT HAPPENED:
${summary}

${hasPastSims
  ? `PAST SIMULATIONS ON THIS WORKSPACE (most recent first, ${(pastSims || []).length} of them):

${pastDigest}`
  : `PAST SIMULATIONS ON THIS WORKSPACE: none — this is the founder's first run.`}

Output, in order:
- dominant_objection (headline + affected_pct) for the CURRENT simulation
- explored_axes: array of all 5 axes with status + evidence — covering both past sims and the current one
- meta_recommendation: one-sentence framing of the journey (null if no past sims)
- suggestions: 3 next tests biased toward unexplored or still-open axes. For each:
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
            description:
              "Return the dominant objection + cross-cycle explored-axes state + 3 specific follow-up tests for the founder",
            parameters: {
              type: "object",
              properties: {
                dominant_objection: {
                  type: "object",
                  description:
                    "The single most important pushback/concern raised by the personas in the CURRENT simulation. If no clear objection, affected_pct is 0 and the headline says so.",
                  properties: {
                    headline: {
                      type: "string",
                      description:
                        "One-line description of the pushback (e.g. '27% pushed back on the $15 price as too high'). Or, if positive: 'No clear objection — reception was broadly positive'.",
                    },
                    affected_pct: {
                      type: "integer",
                      minimum: 0,
                      maximum: 100,
                      description: "Estimated % of personas who raised this concern. 0 if no objection.",
                    },
                  },
                  required: ["headline", "affected_pct"],
                },
                explored_axes: {
                  type: "array",
                  description:
                    "All 5 testing axes, each with a status reflecting BOTH past sims and the current one. Must contain exactly 5 entries — one per focus_area, no duplicates.",
                  minItems: 5,
                  maxItems: 5,
                  items: {
                    type: "object",
                    properties: {
                      focus_area: {
                        type: "string",
                        enum: ["price", "feature", "messaging", "audience", "positioning"],
                      },
                      status: {
                        type: "string",
                        enum: ["covered", "open", "untested"],
                        description:
                          "covered = tested with findings addressed; open = tested but objection still live; untested = not yet explored.",
                      },
                      evidence: {
                        type: "string",
                        description: "One short clause explaining the status (e.g. 'tested 2 sims ago, 57% pushed back — still open').",
                      },
                    },
                    required: ["focus_area", "status", "evidence"],
                  },
                },
                meta_recommendation: {
                  type: ["string", "null"],
                  description:
                    "One sentence framing where the founder is in their testing journey, naming the axis they should bias toward next. Null ONLY when there are zero past simulations.",
                },
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
              required: ["dominant_objection", "explored_axes", "meta_recommendation", "suggestions"],
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
      dominant_objection?: { headline: string; affected_pct: number };
      explored_axes?: Array<{ focus_area: string; status: string; evidence: string }>;
      meta_recommendation?: string | null;
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

    // Sanitize the dominant_objection. AI may omit it or produce out-of-range values.
    const rawObj = parsed.dominant_objection;
    const dominantObjection = rawObj && typeof rawObj.headline === "string" && rawObj.headline.trim().length > 0
      ? {
          headline: rawObj.headline.trim(),
          affected_pct: Math.min(Math.max(Math.round(Number(rawObj.affected_pct) || 0), 0), 100),
        }
      : null;

    // Sanitize explored_axes: ensure exactly one entry per focus_area, fall back
    // to "untested" if AI omitted one. Drop duplicates and any unknown axes.
    const ALL_AXES = ["price", "feature", "messaging", "audience", "positioning"] as const;
    type Axis = (typeof ALL_AXES)[number];
    const VALID_STATUSES = new Set(["covered", "open", "untested"]);
    const axisMap = new Map<Axis, { focus_area: Axis; status: "covered" | "open" | "untested"; evidence: string }>();
    for (const entry of parsed.explored_axes || []) {
      if (!ALL_AXES.includes(entry?.focus_area as Axis)) continue;
      const axis = entry.focus_area as Axis;
      if (axisMap.has(axis)) continue; // first wins, drop dupes
      const status = VALID_STATUSES.has(entry.status) ? entry.status : "untested";
      axisMap.set(axis, {
        focus_area: axis,
        status: status as "covered" | "open" | "untested",
        evidence: typeof entry.evidence === "string" ? entry.evidence.trim() : "",
      });
    }
    const exploredAxes = ALL_AXES.map((axis) =>
      axisMap.get(axis) || { focus_area: axis, status: "untested" as const, evidence: "Not explored yet" }
    );

    // meta_recommendation: must be null when no past sims; otherwise a trimmed string or null if AI omitted.
    const rawMeta = parsed.meta_recommendation;
    const metaRecommendation = hasPastSims
      ? (typeof rawMeta === "string" && rawMeta.trim().length > 0 ? rawMeta.trim() : null)
      : null;

    const tokensUsed = aiData.usage?.total_tokens || 0;
    await recordTokenUsage(supabase, workspace_id as string, tokensUsed);

    return jsonResponse(req, {
      simulation_id,
      dominant_objection: dominantObjection,
      explored_axes: exploredAxes,
      meta_recommendation: metaRecommendation,
      past_sim_count: (pastSims || []).length,
      suggestions: parsed.suggestions || [],
      tokens_used: tokensUsed,
      duration_ms: durationMs,
    });
  } catch (err: any) {
    console.error("Suggest next test error:", err);
    return jsonResponse(req, { error: err.message || "Internal error" }, 500);
  }
});
