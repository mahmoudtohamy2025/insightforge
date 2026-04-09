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

    const { workspace_id, participant_id } = await req.json();
    if (!workspace_id || !participant_id) {
      return new Response(
        JSON.stringify({ error: "workspace_id and participant_id required" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

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

    // Get participant info before deletion
    const { data: participant } = await supabase
      .from("participants")
      .select("name, email")
      .eq("id", participant_id)
      .eq("workspace_id", workspace_id)
      .single();

    if (!participant) {
      return new Response(JSON.stringify({ error: "Participant not found" }), {
        status: 404,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // 1. Delete session_participants links
    await supabase
      .from("session_participants")
      .delete()
      .eq("participant_id", participant_id)
      .eq("workspace_id", workspace_id);

    // 2. Scrub evidence_quotes in insight_patterns that reference participant
    const { data: patterns } = await supabase
      .from("insight_patterns")
      .select("id, evidence_quotes")
      .eq("workspace_id", workspace_id);

    if (patterns) {
      for (const pattern of patterns) {
        const quotes = pattern.evidence_quotes as any[];
        if (!Array.isArray(quotes) || quotes.length === 0) continue;

        // Filter out quotes attributed to this participant
        const filtered = quotes.filter(
          (q: any) =>
            q.participant_id !== participant_id &&
            q.speaker !== participant.name
        );

        if (filtered.length !== quotes.length) {
          await supabase
            .from("insight_patterns")
            .update({ evidence_quotes: filtered })
            .eq("id", pattern.id);
        }
      }
    }

    // 3. Nullify participant_id in survey_responses
    await supabase
      .from("survey_responses")
      .update({ participant_id: null })
      .eq("participant_id", participant_id)
      .eq("workspace_id", workspace_id);

    // 4. Delete the participant record
    const { error: deleteError } = await supabase
      .from("participants")
      .delete()
      .eq("id", participant_id)
      .eq("workspace_id", workspace_id);

    if (deleteError) throw deleteError;

    // Log the erasure
    await supabase.from("workspace_activity").insert({
      workspace_id,
      user_id: userId,
      action: "deleted",
      entity_type: "participant",
      entity_id: participant_id,
      metadata: {
        type: "erasure_request",
        participant_name: participant.name,
      },
    });

    return new Response(
      JSON.stringify({ success: true, erased: participant.name }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erasure error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
