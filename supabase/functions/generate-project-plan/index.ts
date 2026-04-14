import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, getCorsHeaders } from "../_shared/cors.ts";
import { requireWorkspaceMember } from "../_shared/validation.ts";
import { checkRateLimit, recordTokenUsage } from "../_shared/rateLimiter.ts";
import { getWorkspaceTier } from "../_shared/tierEnforcement.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // ── Auth Guard ────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const { description, locale = "en" } = await req.json();
    if (!description || typeof description !== "string") {
      return new Response(JSON.stringify({ error: "description is required" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured");

    const bilingualInstruction = locale === "ar"
      ? "Return all text fields in Arabic. Use formal Arabic suitable for research contexts."
      : "Return all text fields in English. If the description mentions MENA/Arab/KSA/UAE regions, also add Arabic translations in parentheses for key terms.";

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an expert UX research methodologist with deep knowledge of MENA region cultural contexts. Given a research goal description, generate a structured project plan.

Cultural awareness guidelines:
- For KSA/Gulf research: consider gender separation requirements, prayer time scheduling, cultural sensitivities around family/religion topics
- For bilingual research: suggest both Arabic and English discussion guides when participants may speak either
- Suggest appropriate methodologies based on the research context (qual for exploratory, quant for validation, hybrid for complex studies)

${bilingualInstruction}`,
          },
          {
            role: "user",
            content: `Generate a research project plan for: "${description}"`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_project_plan",
              description: "Create a structured research project plan from a natural language description.",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Concise project title" },
                  objective: { type: "string", description: "Clear research objective statement (2-3 sentences)" },
                  methodology: { type: "string", enum: ["qualitative", "quantitative", "hybrid"], description: "Recommended methodology" },
                  discussion_guide: {
                    type: "array",
                    description: "Structured discussion guide sections",
                    items: {
                      type: "object",
                      properties: {
                        section: { type: "string", description: "Section title" },
                        questions: {
                          type: "array",
                          items: { type: "string" },
                          description: "Questions for this section",
                        },
                      },
                      required: ["section", "questions"],
                      additionalProperties: false,
                    },
                  },
                  screener_criteria: {
                    type: "array",
                    description: "Participant screening criteria",
                    items: {
                      type: "object",
                      properties: {
                        criterion: { type: "string" },
                        requirement: { type: "string" },
                      },
                      required: ["criterion", "requirement"],
                      additionalProperties: false,
                    },
                  },
                  target_participants: { type: "integer", description: "Recommended number of participants" },
                  target_sessions: { type: "integer", description: "Recommended number of sessions" },
                  suggested_timeline_days: { type: "integer", description: "Suggested project duration in days" },
                  cultural_notes: {
                    type: "array",
                    items: { type: "string" },
                    description: "Cultural considerations or sensitivities for this research",
                  },
                },
                required: ["title", "objective", "methodology", "discussion_guide", "screener_criteria", "target_participants", "target_sessions", "suggested_timeline_days"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_project_plan" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return new Response(JSON.stringify({ error: "AI plan generation failed" }), {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "AI did not return a structured plan" }), {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const plan = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify({ plan }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-project-plan error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
