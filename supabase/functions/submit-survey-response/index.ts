import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { requireWorkspaceMember } from "../_shared/validation.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // ── GET: Fetch survey + questions for respondents ──
    if (req.method === "GET") {
      const url = new URL(req.url);
      const surveyId = url.searchParams.get("survey_id");
      if (!surveyId) return jsonResponse(req, { error: "survey_id is required" }, 400);

      const { data: survey, error: surveyErr } = await supabase
        .from("surveys")
        .select("id, title, description, status, workspace_id, target_responses, response_count")
        .eq("id", surveyId)
        .single();

      if (surveyErr || !survey) return jsonResponse(req, { error: "Survey not found" }, 404);
      if (survey.status !== "live") return jsonResponse(req, { error: "Survey is not accepting responses" }, 403);
      if (survey.target_responses && survey.response_count >= survey.target_responses) {
        return jsonResponse(req, { error: "Survey has reached its maximum number of responses" }, 403);
      }

      const { data: questions, error: qErr } = await supabase
        .from("survey_questions")
        .select("id, question_text, question_type, options, sort_order, required, logic")
        .eq("survey_id", surveyId)
        .order("sort_order", { ascending: true });

      if (qErr) return jsonResponse(req, { error: "Failed to load questions" }, 500);

      // Fetch workspace branding
      const { data: workspace } = await supabase
        .from("workspaces")
        .select("logo_url, brand_primary_color, brand_accent_color, name")
        .eq("id", survey.workspace_id)
        .single();

      return jsonResponse(req, {
        survey: { id: survey.id, title: survey.title, description: survey.description },
        questions: questions ?? [],
        branding: workspace ? {
          logo_url: workspace.logo_url,
          primary_color: workspace.brand_primary_color,
          accent_color: workspace.brand_accent_color,
          workspace_name: workspace.name,
        } : null,
      });
    }

    // ── POST: Submit response ──
    if (req.method === "POST") {
      const body = await req.json();
      const { survey_id, answers } = body;

      if (!survey_id || !answers || typeof answers !== "object") {
        return jsonResponse(req, { error: "survey_id and answers are required" }, 400);
      }

      // Validate survey is live
      const { data: survey, error: surveyErr } = await supabase
        .from("surveys")
        .select("id, status, workspace_id, target_responses, response_count")
        .eq("id", survey_id)
        .single();

      if (surveyErr || !survey) return jsonResponse(req, { error: "Survey not found" }, 404);
      if (survey.status !== "live") return jsonResponse(req, { error: "Survey is not accepting responses" }, 403);
      if (survey.target_responses && survey.response_count >= survey.target_responses) {
        return jsonResponse(req, { error: "Survey has reached its maximum number of responses" }, 403);
      }

      // Fetch all questions with logic
      const { data: questions } = await supabase
        .from("survey_questions")
        .select("id, required, logic, question_type")
        .eq("survey_id", survey_id)
        .order("sort_order", { ascending: true });

      if (questions) {
        // Determine visible questions based on display logic
        const visibleIds = new Set<string>();
        for (const q of questions) {
          const logic = q.logic as { show_if?: { question_id: string; equals: string } } | null;
          if (!logic?.show_if) {
            visibleIds.add(q.id);
            continue;
          }
          const { question_id, equals } = logic.show_if;
          const answer = answers[question_id] || "";
          // Check multi_select
          try {
            const parsed = JSON.parse(answer);
            if (Array.isArray(parsed) && parsed.includes(equals)) {
              visibleIds.add(q.id);
              continue;
            }
          } catch { /* not JSON */ }
          if (answer === equals) {
            visibleIds.add(q.id);
          }
        }

        // Validate only visible required questions
        const missing = questions
          .filter((q: any) => q.required && visibleIds.has(q.id))
          .filter((q: any) => !answers[q.id] || (typeof answers[q.id] === "string" && answers[q.id].trim() === ""));
        if (missing.length > 0) {
          return jsonResponse(req, { error: "Please answer all required questions", missing: missing.map((q: any) => q.id) }, 400);
        }
      }

      // Insert response
      const { error: insertErr } = await supabase.from("survey_responses").insert({
        survey_id,
        workspace_id: survey.workspace_id,
        answers,
        completed_at: new Date().toISOString(),
      });

      if (insertErr) {
        console.error("Insert error:", insertErr);
        return jsonResponse(req, { error: "Failed to submit response" }, 500);
      }

      // Increment response_count atomically
      const { error: rpcErr } = await supabase.rpc("increment_survey_responses", { sid: survey_id });
      if (rpcErr && rpcErr.message && rpcErr.code !== "PGRST202") {
        // Fallback if RPC doesn't exist (handle silently to not block user, but ideally we create the RPC)
        console.error("RPC error:", rpcErr);
        await supabase
          .from("surveys")
          .update({ response_count: survey.response_count + 1 })
          .eq("id", survey_id);
      }

      return jsonResponse(req, { success: true });
    }

    return jsonResponse(req, { error: "Method not allowed" }, 405);
  } catch (err) {
    console.error("Edge function error:", err);
    return jsonResponse(req, { error: "Internal server error" }, 500);
  }
});
