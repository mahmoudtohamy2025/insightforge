/**
 * validation-report Edge Function
 *
 * Aggregates all calibration_data for a workspace and returns
 * global accuracy metrics, per-segment breakdowns, and trend data.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { requireWorkspaceMember } from "../_shared/validation.ts";

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
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

    const { workspace_id } = await req.json();
    if (!workspace_id) {
      return jsonResponse(req, { error: "workspace_id is required" }, 400);
    }

    // Verify workspace membership
    const memberError = await requireWorkspaceMember(supabase, workspace_id, user.id);
    if (memberError) return memberError;

    // ── 1. Get all segments for this workspace ──
    const { data: segments } = await supabase
      .from("segment_profiles")
      .select("id, name, calibration_score, created_at")
      .eq("workspace_id", workspace_id)
      .order("name");

    if (!segments?.length) {
      return jsonResponse(req, {
        global_accuracy: 0,
        total_calibration_entries: 0,
        total_segments: 0,
        segments: [],
        trend: [],
        dimensions: { sentiment: 0, themes: 0 },
      });
    }

    const segmentIds = segments.map(s => s.id);

    // ── 2. Get all calibration data for these segments ──
    const { data: calibrationData } = await supabase
      .from("calibration_data")
      .select("id, segment_id, accuracy_score, real_sentiment, real_themes, created_at, source_type")
      .in("segment_id", segmentIds)
      .order("created_at", { ascending: true });

    const allCalData = calibrationData || [];

    // ── 3. Compute global accuracy ──
    const scores = allCalData
      .map(d => d.accuracy_score)
      .filter((s): s is number => s !== null && s !== undefined);
    const globalAccuracy = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;

    // ── 4. Per-segment breakdown ──
    const segmentMap: Record<string, { name: string; scores: number[]; entries: number; calibration_score: number }> = {};
    for (const seg of segments) {
      segmentMap[seg.id] = {
        name: seg.name,
        scores: [],
        entries: 0,
        calibration_score: seg.calibration_score || 0,
      };
    }
    for (const d of allCalData) {
      if (segmentMap[d.segment_id]) {
        segmentMap[d.segment_id].entries++;
        if (d.accuracy_score !== null && d.accuracy_score !== undefined) {
          segmentMap[d.segment_id].scores.push(d.accuracy_score);
        }
      }
    }

    const segmentBreakdown = Object.entries(segmentMap).map(([id, data]) => ({
      segment_id: id,
      segment_name: data.name,
      calibration_score: data.calibration_score,
      avg_accuracy: data.scores.length > 0
        ? data.scores.reduce((a, b) => a + b, 0) / data.scores.length
        : 0,
      entry_count: data.entries,
    }));

    // ── 5. Trend data (monthly accuracy) ──
    const monthlyBuckets: Record<string, number[]> = {};
    for (const d of allCalData) {
      if (d.accuracy_score !== null && d.accuracy_score !== undefined) {
        const month = d.created_at.substring(0, 7); // "YYYY-MM"
        if (!monthlyBuckets[month]) monthlyBuckets[month] = [];
        monthlyBuckets[month].push(d.accuracy_score);
      }
    }
    const trend = Object.entries(monthlyBuckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, scores]) => ({
        month,
        avg_accuracy: scores.reduce((a, b) => a + b, 0) / scores.length,
        entry_count: scores.length,
      }));

    // ── 6. Dimension accuracy (sentiment vs themes) ──
    // Sentiment: compare real_sentiment against accuracy_score (proxy)
    const sentimentEntries = allCalData.filter(d => d.real_sentiment !== null);
    const sentimentAccuracy = sentimentEntries.length > 0
      ? sentimentEntries
          .map(d => d.accuracy_score || 0)
          .reduce((a, b) => a + b, 0) / sentimentEntries.length
      : 0;

    // Themes: entries with real_themes populated
    const themeEntries = allCalData.filter(d => d.real_themes && (d.real_themes as string[]).length > 0);
    const themeAccuracy = themeEntries.length > 0
      ? themeEntries
          .map(d => d.accuracy_score || 0)
          .reduce((a, b) => a + b, 0) / themeEntries.length
      : 0;

    // ── 7. Latest twin_responses for comparison view ──
    const { data: recentTwinResponses } = await supabase
      .from("twin_responses")
      .select("id, segment_id, sentiment, confidence, response_text, created_at")
      .in("segment_id", segmentIds)
      .order("created_at", { ascending: false })
      .limit(50);

    // Build comparison pairs: real vs twin per segment
    const comparisonPairs = segmentBreakdown.map(seg => {
      const realEntries = allCalData.filter(d => d.segment_id === seg.segment_id);
      const twinEntries = (recentTwinResponses || []).filter((t: any) => t.segment_id === seg.segment_id);
      const avgRealSentiment = realEntries.filter(d => d.real_sentiment !== null).length > 0
        ? realEntries
            .filter(d => d.real_sentiment !== null)
            .map(d => d.real_sentiment!)
            .reduce((a, b) => a + b, 0) / realEntries.filter(d => d.real_sentiment !== null).length
        : null;
      const avgTwinSentiment = twinEntries.length > 0
        ? twinEntries
            .map((t: any) => t.sentiment || 0)
            .reduce((a: number, b: number) => a + b, 0) / twinEntries.length
        : null;

      return {
        segment_id: seg.segment_id,
        segment_name: seg.segment_name,
        real_sentiment: avgRealSentiment,
        twin_sentiment: avgTwinSentiment,
        accuracy: seg.avg_accuracy,
        real_count: realEntries.length,
        twin_count: twinEntries.length,
      };
    });

    return jsonResponse(req, {
      global_accuracy: Math.round(globalAccuracy * 1000) / 1000,
      total_calibration_entries: allCalData.length,
      total_segments: segments.length,
      segments: segmentBreakdown,
      trend,
      dimensions: {
        sentiment: Math.round(sentimentAccuracy * 1000) / 1000,
        themes: Math.round(themeAccuracy * 1000) / 1000,
      },
      comparison_pairs: comparisonPairs,
    });
  } catch (err: any) {
    console.error("validation-report error:", err);
    return jsonResponse(req, { error: err.message || "Internal error" }, 500);
  }
});
