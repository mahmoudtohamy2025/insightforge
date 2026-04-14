import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, getCorsHeaders } from "../_shared/cors.ts";
import { requireWorkspaceMember } from "../_shared/validation.ts";
import { checkRateLimit, recordTokenUsage } from "../_shared/rateLimiter.ts";
import { getWorkspaceTier } from "../_shared/tierEnforcement.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
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

    const userId = user.id;
    const { session_id, workspace_id, source } = await req.json();

    if (!session_id || !workspace_id) {
      return new Response(JSON.stringify({ error: "Missing session_id or workspace_id" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const probeSource = source || "discussion_guide";

    // Fetch session + project
    const { data: session, error: sessErr } = await supabase
      .from("sessions")
      .select("id, title, project_id, workspace_id")
      .eq("id", session_id)
      .single();

    if (sessErr || !session) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    let discussionGuide: any[] = [];
    let objective = "";

    if (session.project_id) {
      const { data: project } = await supabase
        .from("projects")
        .select("objective, discussion_guide")
        .eq("id", session.project_id)
        .single();

      if (project) {
        objective = project.objective || "";
        discussionGuide = Array.isArray(project.discussion_guide) ? project.discussion_guide : [];
      }
    }

    // For post_session source, also fetch transcript
    let transcriptText = "";
    if (probeSource === "post_session") {
      const { data: transcript } = await supabase
        .from("session_transcripts")
        .select("raw_text")
        .eq("session_id", session_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!transcript?.raw_text || transcript.raw_text.trim().length < 50) {
        return new Response(JSON.stringify({ error: "Transcript too short to generate probes" }), {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
      transcriptText = transcript.raw_text.length > 20000
        ? transcript.raw_text.slice(0, 20000) + "\n[truncated]"
        : transcript.raw_text;
    }

    if (probeSource === "discussion_guide" && discussionGuide.length === 0) {
      return new Response(JSON.stringify({ error: "No discussion guide found on the linked project" }), {
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

    // Build prompt based on source
    let systemPrompt: string;
    let userPrompt: string;

    if (probeSource === "discussion_guide") {
      const guideText = discussionGuide
        .map((section: any, i: number) => {
          const title = section.title || `Section ${i + 1}`;
          const questions = Array.isArray(section.questions)
            ? section.questions.map((q: any) => `  - ${typeof q === "string" ? q : q.text || q.question || JSON.stringify(q)}`).join("\n")
            : "";
          return `### ${title}\n${questions}`;
        })
        .join("\n\n");

      systemPrompt = `You are an expert qualitative research moderator with deep experience in the MENA region. Given a discussion guide and research objective, generate contextual follow-up probes for each question. These probes help the moderator dig deeper when participants give brief or surface-level answers.

Generate 2-3 follow-up probes per discussion guide question. Each probe should:
- Be open-ended and non-leading
- Encourage elaboration or concrete examples
- Be culturally appropriate for Gulf/MENA audiences
- Use professional but conversational tone`;

      userPrompt = `Research objective: ${objective || "General qualitative research"}\n\nDiscussion Guide:\n${guideText}`;
    } else {
      systemPrompt = `You are an expert qualitative research analyst. After reviewing a session transcript, identify moments where deeper probing would have yielded richer insights. Generate follow-up questions the researcher could ask in the next session to explore underdeveloped topics.

Generate 5-8 follow-up probes. Each should:
- Reference a specific topic or moment from the transcript
- Be open-ended and encourage elaboration
- Be culturally appropriate for Gulf/MENA audiences`;

      userPrompt = `Research objective: ${objective || "General qualitative research"}\n\nSession title: ${session.title}\n\nTranscript:\n${transcriptText}`;
    }

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
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_probes",
              description: "Generate follow-up probes for research sessions.",
              parameters: {
                type: "object",
                properties: {
                  probes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        guide_question: {
                          type: "string",
                          description: "The original discussion guide question this probe relates to (null for post-session probes)",
                        },
                        suggested_text: {
                          type: "string",
                          description: "The follow-up probe question",
                        },
                      },
                      required: ["suggested_text"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["probes"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_probes" } },
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
      return new Response(JSON.stringify({ error: "Failed to generate probes" }), {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response:", JSON.stringify(result));
      return new Response(JSON.stringify({ error: "AI did not return structured probes" }), {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const probes = parsed.probes || [];

    // Insert probes
    const rows = probes.map((p: any) => ({
      session_id,
      workspace_id,
      source: probeSource,
      guide_question_text: p.guide_question || null,
      suggested_text: p.suggested_text,
      status: "suggested",
      created_by: userId,
    }));

    if (rows.length > 0) {
      const { error: insertErr } = await supabase.from("session_probes").insert(rows);
      if (insertErr) {
        console.error("Insert probes error:", insertErr);
        return new Response(JSON.stringify({ error: "Failed to save probes" }), {
          status: 500,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ count: rows.length }), {
      status: 200,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-probes error:", err);
    return new Response(JSON.stringify({ error: (err instanceof Error ? err.message : "Unknown error") }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
