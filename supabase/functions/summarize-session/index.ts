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

    const { session_id, workspace_id } = await req.json();

    if (!session_id || !workspace_id) {
      return new Response(JSON.stringify({ error: "Missing session_id or workspace_id" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Fetch transcript
    const { data: transcript, error: txError } = await supabase
      .from("session_transcripts")
      .select("raw_text, language")
      .eq("session_id", session_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (txError || !transcript) {
      return new Response(JSON.stringify({ error: "Transcript not found" }), {
        status: 404,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    if (!transcript.raw_text || transcript.raw_text.trim().length < 50) {
      return new Response(JSON.stringify({ error: "Transcript too short to summarize" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Also fetch existing themes for richer summary
    const { data: themes } = await supabase
      .from("session_themes")
      .select("title, description, evidence")
      .eq("session_id", session_id)
      .order("confidence_score", { ascending: false });

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const maxChars = 30000;
    const rawText = transcript.raw_text.length > maxChars
      ? transcript.raw_text.slice(0, maxChars) + "\n\n[Transcript truncated]"
      : transcript.raw_text;

    const themesContext = themes && themes.length > 0
      ? `\n\nPreviously extracted themes:\n${themes.map((t: any) => `- ${t.title}: ${t.description}`).join("\n")}`
      : "";

    const systemPrompt = `You are an expert qualitative research analyst. Generate a concise post-session summary from the transcript.

The summary should:
- Be 200-300 words
- Start with a one-sentence overview of the session topic
- Highlight 5-7 key findings or themes
- Note any areas of consensus or disagreement among participants
- End with 2-3 recommended follow-up actions

Write in a professional, actionable tone. If the transcript is in Arabic, write the summary in English but preserve key Arabic terms/quotes where relevant.`;

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
          { role: "user", content: `Summarize this research session transcript (language: ${transcript.language || "en"}):\n\n${rawText}${themesContext}` },
        ],
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
      return new Response(JSON.stringify({ error: "Failed to generate summary" }), {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const summary = result.choices?.[0]?.message?.content?.trim();

    if (!summary) {
      return new Response(JSON.stringify({ error: "AI did not return a summary" }), {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Store summary on the session
    const { error: updateError } = await supabase
      .from("sessions")
      .update({ summary })
      .eq("id", session_id);

    if (updateError) {
      console.error("Update session error:", updateError);
      return new Response(JSON.stringify({ error: "Failed to save summary" }), {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ summary }), {
      status: 200,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("summarize-session error:", err);
    await recordTokenUsage(supabase, workspace_id, 2000); // Estimated 2K tokens
    return new Response(JSON.stringify({ error: (err instanceof Error ? err.message : "Unknown error") }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
