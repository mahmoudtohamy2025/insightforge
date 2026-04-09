import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, getCorsHeaders } from "../_shared/cors.ts";
import { requireWorkspaceMember } from "../_shared/validation.ts";
import { checkRateLimit, recordTokenUsage } from "../_shared/rateLimiter.ts";

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

    const body = await req.json();
    const { workspace_id, title, description, category, target_audience, target_market } = body;

    if (!workspace_id || !title) {
      return new Response(JSON.stringify({ error: "Missing required fields: workspace_id, title" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Validate workspace membership
    const membershipError = await requireWorkspaceMember(supabase, claimsData.claims.sub, workspace_id);
    if (membershipError) return membershipError;

    // Check rate limit
    const rateLimitError = await checkRateLimit(supabase, workspace_id);
    if (rateLimitError) return rateLimitError;

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Count matching digital twins
    const { count: twinCount } = await supabase
      .from("segment_profiles")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace_id);

    const systemPrompt = `You are a senior market research strategist with 20+ years of experience designing research programs.
Your role is to analyze a research requirement and recommend the optimal methodology to answer the business question.

You must respond with a valid JSON object only (no markdown, no extra text). Use this exact schema:
{
  "recommended_methodology": "<primary method: survey | focus_group | idi | simulation | ux_test | diary_study | mixed>",
  "secondary_methodologies": ["<method>", "<method>"],
  "rationale": "<2-3 sentence explanation of why this methodology best answers the question>",
  "estimated_effort": "<small | medium | large | xl>",
  "estimated_timeline_weeks": <number>,
  "recommended_sample_size": <number>,
  "key_questions_to_answer": ["<question>", "<question>", "<question>"],
  "risks_and_considerations": "<brief note on limitations or risks>",
  "digital_twin_applicability": "<how digital twins could be used: pre-validation | substitute | complement | not-applicable>"
}`;

    const userPrompt = `Research Requirement:
Title: ${title}
${description ? `Description: ${description}` : ""}
${category ? `Category: ${category}` : ""}
${target_audience ? `Target Audience: ${target_audience}` : ""}
${target_market ? `Target Market: ${target_market}` : ""}

Recommend the best research methodology to address this requirement.`;

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GEMINI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 800,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(JSON.stringify({ error: "AI API error", details: errText }), {
        status: 502,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content ?? "{}";
    const tokensUsed = aiData.usage?.total_tokens ?? 0;

    await recordTokenUsage(supabase, workspace_id, tokensUsed, "suggest-methodology");

    let suggestion: Record<string, unknown>;
    try {
      suggestion = JSON.parse(content);
    } catch {
      suggestion = { recommended_methodology: "mixed", rationale: content };
    }

    // Attach the count of available twins
    suggestion.matching_twin_count = twinCount ?? 0;

    return new Response(JSON.stringify(suggestion), {
      status: 200,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
