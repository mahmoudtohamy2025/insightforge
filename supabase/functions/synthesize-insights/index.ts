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

    const { workspace_id, project_id } = await req.json();

    if (!workspace_id) {
      return new Response(JSON.stringify({ error: "Missing workspace_id" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Fetch all session themes for this workspace
    let themesQuery = supabase
      .from("session_themes")
      .select("id, title, description, confidence_score, evidence, session_id, sessions!inner(title, project_id)")
      .eq("workspace_id", workspace_id)
      .order("confidence_score", { ascending: false });

    if (project_id) {
      themesQuery = themesQuery.eq("sessions.project_id", project_id);
    }

    const { data: themes, error: themesError } = await themesQuery;

    if (themesError) {
      console.error("Fetch themes error:", themesError);
      return new Response(JSON.stringify({ error: "Failed to fetch themes" }), {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    if (!themes || themes.length < 2) {
      return new Response(JSON.stringify({ error: "Need at least 2 session themes to synthesize patterns. Analyze more session transcripts first." }), {
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

    // Build the themes summary for the AI
    const themeSummary = themes.map((t: any) => {
      const evidence = t.evidence as { sentiment?: string; quotes?: string[] } | null;
      const session = t.sessions as { title: string; project_id: string | null } | null;
      return {
        theme_id: t.id,
        session_id: t.session_id,
        session_title: session?.title || "Untitled",
        title: t.title,
        description: t.description,
        confidence: t.confidence_score,
        sentiment: evidence?.sentiment || "neutral",
        quotes: evidence?.quotes || [],
      };
    });

    const uniqueSessionIds = [...new Set(themes.map((t: any) => t.session_id))];
    const totalSessions = uniqueSessionIds.length;

    const systemPrompt = `You are an expert qualitative research analyst. You will receive themes extracted from multiple research sessions. Your job is to identify cross-session PATTERNS — groups of semantically similar or related themes that appear across different sessions.

Rules:
- Group themes that address the same underlying issue, even if worded differently
- A pattern must span at least 2 different sessions to be meaningful
- For each pattern, aggregate the best supporting quotes from all related themes
- Assign a dominant sentiment based on the majority of grouped themes
- Order patterns by session_count (most frequent first), then by average confidence
- Create 2-15 patterns depending on data richness
- Be specific and actionable — "Users struggle with pricing" is better than "Pricing"`;

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
          {
            role: "user",
            content: `Analyze these ${themes.length} themes from ${totalSessions} research sessions and identify cross-session patterns:\n\n${JSON.stringify(themeSummary, null, 2)}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "synthesize_patterns",
              description: "Group related themes into cross-session research patterns.",
              parameters: {
                type: "object",
                properties: {
                  patterns: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string", description: "Pattern title (3-10 words)" },
                        description: { type: "string", description: "Pattern summary (2-4 sentences)" },
                        sentiment: {
                          type: "string",
                          enum: ["positive", "negative", "neutral", "mixed"],
                        },
                        theme_ids: {
                          type: "array",
                          items: { type: "string" },
                          description: "IDs of the session themes that belong to this pattern",
                        },
                        evidence_quotes: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              quote: { type: "string" },
                              session_title: { type: "string" },
                            },
                            required: ["quote", "session_title"],
                            additionalProperties: false,
                          },
                          description: "Top 2-6 quotes with session attribution",
                        },
                      },
                      required: ["title", "description", "sentiment", "theme_ids", "evidence_quotes"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["patterns"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "synthesize_patterns" } },
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
      return new Response(JSON.stringify({ error: "Failed to synthesize insights" }), {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response:", JSON.stringify(result));
      return new Response(JSON.stringify({ error: "AI did not return structured patterns" }), {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const patterns = parsed.patterns || [];

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Create a synthesis run record
    const now = new Date().toISOString();
    const { data: runData, error: runError } = await serviceClient
      .from("synthesis_runs")
      .insert({
        workspace_id,
        project_id: project_id || null,
        patterns_count: patterns.length,
        sessions_analyzed: totalSessions,
        themes_processed: themes.length,
        created_at: now,
      })
      .select("id")
      .single();

    if (runError || !runData) {
      console.error("Insert synthesis run error:", runError);
      return new Response(JSON.stringify({ error: "Failed to save synthesis run" }), {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const synthesisRunId = runData.id;

    // Build patterns to insert (no longer deleting old ones)
    const patternsToInsert = patterns.map((p: any) => {
      const patternThemeIds = (p.theme_ids || []).filter((id: string) =>
        themes.some((t: any) => t.id === id)
      );
      const sessionIds = new Set(
        patternThemeIds.map((tid: string) => {
          const theme = themes.find((t: any) => t.id === tid);
          return theme?.session_id;
        }).filter(Boolean)
      );

      return {
        workspace_id,
        title: p.title,
        description: p.description || "",
        sentiment: p.sentiment || "neutral",
        session_count: sessionIds.size || 1,
        theme_ids: patternThemeIds,
        evidence_quotes: p.evidence_quotes || [],
        synthesis_run_id: synthesisRunId,
        first_seen_at: now,
        last_seen_at: now,
        created_at: now,
        updated_at: now,
      };
    });

    if (patternsToInsert.length > 0) {
      const { data: insertedPatterns, error: insertError } = await serviceClient
        .from("insight_patterns")
        .insert(patternsToInsert)
        .select("id, session_count, sentiment");

      if (insertError) {
        console.error("Insert patterns error:", insertError);
        return new Response(JSON.stringify({ error: "Failed to save patterns" }), {
          status: 500,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      // Insert pattern snapshots for trend tracking
      if (insertedPatterns && insertedPatterns.length > 0) {
        const snapshotsToInsert = insertedPatterns.map((p: any) => ({
          workspace_id,
          project_id: project_id || null,
          pattern_id: p.id,
          session_count: p.session_count,
          sentiment: p.sentiment || "neutral",
          snapshot_date: now.split("T")[0],
        }));

        const { error: snapshotError } = await serviceClient
          .from("pattern_snapshots")
          .insert(snapshotsToInsert);

        if (snapshotError) {
          console.error("Insert snapshots error:", snapshotError);
          // Non-fatal: don't fail the whole request
        }
      }
    }

    return new Response(
      JSON.stringify({
        patterns_count: patternsToInsert.length,
        sessions_analyzed: totalSessions,
        themes_processed: themes.length,
        synthesis_run_id: synthesisRunId,
      }),
      {
        status: 200,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("synthesize-insights error:", err);
    await recordTokenUsage(supabase, workspace_id, 2000); // Estimated 2K tokens
    return new Response(JSON.stringify({ error: (err instanceof Error ? err.message : "Unknown error") }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
