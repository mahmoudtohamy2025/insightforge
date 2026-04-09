import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, getCorsHeaders } from "../_shared/cors.ts";
import { requireWorkspaceMember } from "../_shared/validation.ts";

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

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const { workspace_id } = await req.json();
    if (!workspace_id) {
      return new Response(JSON.stringify({ error: "workspace_id required" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Use service role for full data access
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify user is owner or admin
    const { data: membership } = await supabase
      .from("workspace_memberships")
      .select("role")
      .eq("workspace_id", workspace_id)
      .eq("user_id", userId)
      .single();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Fetch all workspace data
    const [
      { data: workspace },
      { data: participants },
      { data: sessions },
      { data: transcripts },
      { data: notes },
      { data: themes },
      { data: surveys },
      { data: questions },
      { data: responses },
      { data: projects },
      { data: patterns },
    ] = await Promise.all([
      supabase.from("workspaces").select("*").eq("id", workspace_id).single(),
      supabase.from("participants").select("*").eq("workspace_id", workspace_id),
      supabase.from("sessions").select("*").eq("workspace_id", workspace_id),
      supabase.from("session_transcripts").select("*").eq("workspace_id", workspace_id),
      supabase.from("session_notes").select("*").eq("workspace_id", workspace_id),
      supabase.from("session_themes").select("*").eq("workspace_id", workspace_id),
      supabase.from("surveys").select("*").eq("workspace_id", workspace_id),
      supabase.from("survey_questions").select("*").eq("workspace_id", workspace_id),
      supabase.from("survey_responses").select("*").eq("workspace_id", workspace_id),
      supabase.from("projects").select("*").eq("workspace_id", workspace_id),
      supabase.from("insight_patterns").select("*").eq("workspace_id", workspace_id),
    ]);

    const exportData = {
      export_metadata: {
        exported_at: new Date().toISOString(),
        exported_by: userId,
        workspace_id,
        format_version: "1.0",
      },
      workspace,
      participants: participants || [],
      projects: projects || [],
      sessions: sessions || [],
      session_transcripts: transcripts || [],
      session_notes: notes || [],
      session_themes: themes || [],
      surveys: surveys || [],
      survey_questions: questions || [],
      survey_responses: responses || [],
      insight_patterns: patterns || [],
    };

    // Log the export
    await supabase.from("workspace_activity").insert({
      workspace_id,
      user_id: userId,
      action: "created",
      entity_type: "workspace",
      metadata: { type: "data_export" },
    });

    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        ...getCorsHeaders(req),
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="workspace-export-${workspace_id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
