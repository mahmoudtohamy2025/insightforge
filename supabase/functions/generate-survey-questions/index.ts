import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, getCorsHeaders } from "../_shared/cors.ts";
import { requireWorkspaceMember } from "../_shared/validation.ts";
import { checkRateLimit, recordTokenUsage } from "../_shared/rateLimiter.ts";
import { getWorkspaceTier } from "../_shared/tierEnforcement.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const { objective } = await req.json();
    if (!objective || typeof objective !== "string") {
      return new Response(JSON.stringify({ error: "Missing objective" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are an expert market research survey designer specializing in the MENA region. 
Given a research objective, generate 6-10 high-quality survey questions that will effectively gather the needed insights.
Use a mix of question types: scale (1-5 Likert), multiple_choice, multi_select (checkboxes), matrix (grid of rows and columns), open_ended, nps (Net Promoter Score 0-10), and yes_no.
For multiple_choice and multi_select questions, always provide 3-6 answer options. For matrix, provide 3-5 rows and 3-5 columns.
Questions should be clear, unbiased, and professionally worded.`;

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Research objective: ${objective}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_survey_questions",
              description: "Generate a list of survey questions based on the research objective.",
              parameters: {
                type: "object",
                properties: {
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        question: { type: "string", description: "The survey question text" },
                        type: {
                          type: "string",
                          enum: ["scale", "multiple_choice", "multi_select", "matrix", "open_ended", "nps", "yes_no"],
                          description: "Question type",
                        },
                        options: {
                          type: "array",
                          items: { type: "string" },
                          description: "Answer options (required for multiple_choice and multi_select, optional for others)",
                        },
                        matrix_rows: {
                          type: "array",
                          items: { type: "string" },
                          description: "Row labels (required for matrix questions)",
                        },
                        matrix_columns: {
                          type: "array",
                          items: { type: "string" },
                          description: "Column labels (required for matrix questions)",
                        },
                      },
                      required: ["question", "type"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["questions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_survey_questions" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings." }), {
          status: 402,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", status, text);
      return new Response(JSON.stringify({ error: "Failed to generate questions" }), {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response:", JSON.stringify(result));
      return new Response(JSON.stringify({ error: "AI did not return structured questions" }), {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ questions: parsed.questions }), {
      status: 200,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-survey-questions error:", err);
    await recordTokenUsage(supabase, workspace_id, 2000); // Estimated 2K tokens
    return new Response(JSON.stringify({ error: (err instanceof Error ? err.message : "Unknown error") }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
