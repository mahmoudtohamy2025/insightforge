import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, getCorsHeaders } from "../_shared/cors.ts";

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STUDY-LISTING] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // GET: List studies (for participants, show active; for enterprise, show their workspace's)
    if (req.method === "GET") {
      const url = new URL(req.url);
      const workspaceId = url.searchParams.get("workspace_id");
      const role = user.user_metadata?.role;

      if (role === "participant") {
        // Participant view: all active studies
        const { data: studies, error } = await supabaseAdmin
          .from("study_listings")
          .select("id, title, description, study_type, estimated_minutes, reward_amount_cents, currency, max_participants, current_participants, requirements, status, closes_at, created_at")
          .eq("status", "active")
          .order("created_at", { ascending: false });

        if (error) throw error;
        logStep("GET (participant)", { count: studies?.length });
        return new Response(JSON.stringify({ studies }), {
          status: 200,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      // Enterprise view: workspace-specific
      if (!workspaceId) {
        return new Response(JSON.stringify({ error: "workspace_id required" }), {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      const { data: studies, error } = await supabaseAdmin
        .from("study_listings")
        .select("*, study_participations(count)")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      logStep("GET (enterprise)", { workspaceId, count: studies?.length });
      return new Response(JSON.stringify({ studies }), {
        status: 200,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // POST: Create study listing (enterprise only)
    if (req.method === "POST") {
      const body = await req.json();
      const {
        workspace_id, title, description, study_type, estimated_minutes,
        reward_amount_cents, currency, max_participants, requirements,
        screener_questions, linked_survey_id, linked_session_id, closes_at, status,
      } = body;

      if (!workspace_id || !title) {
        return new Response(JSON.stringify({ error: "workspace_id and title required" }), {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      const { data: study, error } = await supabaseAdmin
        .from("study_listings")
        .insert({
          workspace_id,
          created_by: user.id,
          title,
          description: description || null,
          study_type: study_type || "survey",
          estimated_minutes: estimated_minutes || 15,
          reward_amount_cents: reward_amount_cents || 500,
          currency: currency || "USD",
          max_participants: max_participants || 50,
          requirements: requirements || {},
          screener_questions: screener_questions || [],
          linked_survey_id: linked_survey_id || null,
          linked_session_id: linked_session_id || null,
          closes_at: closes_at || null,
          status: status || "active",
        })
        .select()
        .single();

      if (error) throw error;
      logStep("POST created", { studyId: study.id });
      return new Response(JSON.stringify(study), {
        status: 201,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // PATCH: Update study listing
    if (req.method === "PATCH") {
      const body = await req.json();
      const { id, ...updates } = body;
      if (!id) {
        return new Response(JSON.stringify({ error: "id required" }), {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      updates.updated_at = new Date().toISOString();
      const { data: updated, error } = await supabaseAdmin
        .from("study_listings")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      logStep("PATCH updated", { studyId: id });
      return new Response(JSON.stringify(updated), {
        status: 200,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    logStep("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
