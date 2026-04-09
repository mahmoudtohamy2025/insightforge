import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, getCorsHeaders } from "../_shared/cors.ts";
import { requireWorkspaceMember } from "../_shared/validation.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all workspaces with their retention settings
    const { data: workspaces, error: wsError } = await supabase
      .from("workspaces")
      .select("id, data_retention_days, name")
      .not("data_retention_days", "is", null);

    if (wsError) throw wsError;

    let totalDeleted = 0;
    const results: Array<{ workspace_id: string; deleted: number }> = [];

    for (const ws of workspaces || []) {
      const retentionDays = ws.data_retention_days || 730;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      const cutoff = cutoffDate.toISOString();

      let wsDeleted = 0;

      // Delete old session transcripts
      const { count: transcriptCount } = await supabase
        .from("session_transcripts")
        .delete({ count: "exact" })
        .eq("workspace_id", ws.id)
        .lt("created_at", cutoff);
      wsDeleted += transcriptCount || 0;

      // Delete old session notes
      const { count: notesCount } = await supabase
        .from("session_notes")
        .delete({ count: "exact" })
        .eq("workspace_id", ws.id)
        .lt("created_at", cutoff);
      wsDeleted += notesCount || 0;

      // Delete old session themes
      const { count: themesCount } = await supabase
        .from("session_themes")
        .delete({ count: "exact" })
        .eq("workspace_id", ws.id)
        .lt("created_at", cutoff);
      wsDeleted += themesCount || 0;

      // Delete old survey responses
      const { count: responsesCount } = await supabase
        .from("survey_responses")
        .delete({ count: "exact" })
        .eq("workspace_id", ws.id)
        .lt("created_at", cutoff);
      wsDeleted += responsesCount || 0;

      if (wsDeleted > 0) {
        // Log the cleanup in workspace_activity
        await supabase.from("workspace_activity").insert({
          workspace_id: ws.id,
          user_id: "00000000-0000-0000-0000-000000000000", // system user
          action: "deleted",
          entity_type: "workspace",
          metadata: {
            type: "retention_cleanup",
            records_deleted: wsDeleted,
            retention_days: retentionDays,
            cutoff_date: cutoff,
          },
        });

        totalDeleted += wsDeleted;
        results.push({ workspace_id: ws.id, deleted: wsDeleted });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_deleted: totalDeleted,
        workspaces_processed: workspaces?.length || 0,
        results,
      }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Cleanup error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
