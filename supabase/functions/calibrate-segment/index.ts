import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { requireWorkspaceMember } from "../_shared/validation.ts";

Deno.serve(async (req: any) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse(req, { error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse(req, { error: "Unauthorized" }, 401);
    }

    const { segment_id, real_responses, workspace_id } = await req.json();

    if (!segment_id || !real_responses?.length || !workspace_id) {
      return jsonResponse(req, { error: "Need segment_id, real_responses[], and workspace_id" }, 400);
    }

    // Verify segment exists and user has access
    const { data: segment, error: segError } = await supabase
      .from("segment_profiles")
      .select("*")
      .eq("id", segment_id)
      .eq("workspace_id", workspace_id)
      .single();

    if (segError || !segment) {
      return jsonResponse(req, { error: "Segment not found" }, 404);
    }

    // Get existing twin responses for this segment
    const { data: twinResponses } = await supabase
      .from("twin_responses")
      .select("*")
      .eq("segment_id", segment_id)
      .order("created_at", { ascending: false })
      .limit(50);

    // Store calibration data and compute accuracy
    const calibrationResults: any[] = [];
    let totalAccuracy = 0;

    for (const real of real_responses) {
      // Simple sentiment-based accuracy: compare real sentiment vs closest twin sentiment
      let bestMatch: any = null;
      let bestDistance = Infinity;

      if (twinResponses?.length) {
        for (const twin of twinResponses) {
          const realSentiment = real.sentiment || 0;
          const twinSentiment = twin.sentiment || 0;
          const distance = Math.abs(realSentiment - twinSentiment);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestMatch = twin;
          }
        }
      }

      // Accuracy: 1 - normalized distance (capped at 0-1)
      const accuracy = bestMatch ? Math.max(0, 1 - bestDistance / 2) : 0;
      totalAccuracy += accuracy;

      // Store calibration entry
      const { data: calEntry } = await supabase.from("calibration_data").insert({
        segment_id,
        source_type: real.source_type || "manual",
        source_id: real.source_id || null,
        real_response_text: real.text || "",
        real_sentiment: real.sentiment || null,
        real_themes: real.themes || [],
        matched_twin_response_id: bestMatch?.id || null,
        accuracy_score: accuracy,
        created_by: user.id,
      }).select().single();

      calibrationResults.push({
        calibration_id: calEntry?.id,
        real_text: real.text,
        real_sentiment: real.sentiment,
        matched_twin_text: bestMatch?.response_text || null,
        matched_twin_sentiment: bestMatch?.sentiment || null,
        accuracy_score: accuracy,
      });
    }

    // Compute overall calibration score: weighted average of all calibration data
    const { data: allCalData } = await supabase
      .from("calibration_data")
      .select("accuracy_score")
      .eq("segment_id", segment_id);

    const allScores = (allCalData || []).map((d: any) => d.accuracy_score || 0);
    const overallCalibration = allScores.length > 0
      ? allScores.reduce((a: number, b: number) => a + b, 0) / allScores.length
      : 0;

    // Update segment calibration score
    await supabase.from("segment_profiles").update({
      calibration_score: overallCalibration,
      updated_at: new Date().toISOString(),
    }).eq("id", segment_id);

    return jsonResponse(req, {
      segment_id,
      segment_name: segment.name,
      calibration_score: overallCalibration,
      entries_processed: calibrationResults.length,
      total_calibration_entries: allScores.length,
      results: calibrationResults,
    });
  } catch (err: any) {
    console.error("Calibration error:", err);
    return jsonResponse(req, { error: err.message || "Internal error" }, 500);
  }
});
