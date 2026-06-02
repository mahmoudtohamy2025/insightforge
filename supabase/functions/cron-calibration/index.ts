import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * Continuous Calibration Engine
 * This runs periodically to scan `calibration_data` and update each segment_profile's
 * `calibration_score` moving average based on new real-world data matched against simulated data.
 */

/** Constant-time string comparison to avoid leaking the secret via timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

serve(async (req: Request) => {
  // Cron-only endpoint: runs with the service-role key and rewrites calibration
  // scores + audit logs across EVERY workspace. Gate on a shared CRON_SECRET and
  // fail closed (refuse if the secret is unset) so no external caller can trigger
  // it. The scheduler must send the secret in the `x-cron-secret` header — same
  // contract as cleanup-expired-data.
  const expectedSecret = Deno.env.get("CRON_SECRET");
  const providedSecret = req.headers.get("x-cron-secret") ?? "";
  if (!expectedSecret || !safeEqual(providedSecret, expectedSecret)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Get all segments that have at least one calibration data row
    const { data: segmentIdsData, error: distError } = await supabaseClient
      .rpc('get_distinct_segments_from_calibration'); // We can do this in JS easily

    // Since we don't have that RPC, let's just query all segments, or query calibration
    // Actually, querying all calibration_data with accuracy_score IS NOT NULL and doing a server-side aggregate 
    // using Supabase JS is possible but slow. A better approach: 
    // We fetch all segment mappings where there is calibration data.
    
    // For large scale, we should use a Postgres Function. But for this edge function demo, 
    // we'll fetch uniquely impacted segments within the last 24 hours. (Or all, since it's an MVP)
    
    // 1. Fetch recent calibrations and include workspace_id from segment_profiles
    const { data: recentCalibrations, error: calibError } = await supabaseClient
      .from("calibration_data")
      .select(`
        segment_id, 
        accuracy_score,
        segment_profiles (workspace_id)
      `)
      .not('accuracy_score', 'is', null);

    if (calibError) throw calibError;

    // Aggregate average accuracy per segment
    // We also store workspace_id to create audit logs
    const segmentScores: Record<string, { total: number; count: number; workspace_id: string }> = {};
    
    for (const row of recentCalibrations) {
      if (!segmentScores[row.segment_id]) {
        segmentScores[row.segment_id] = { 
          total: 0, 
          count: 0,
          workspace_id: (row.segment_profiles as any)?.workspace_id
        };
      }
      segmentScores[row.segment_id].total += row.accuracy_score;
      segmentScores[row.segment_id].count += 1;
    }

    // 2. Update each segment_profile's calibration_score and log an audit trail
    for (const [segmentId, stats] of Object.entries(segmentScores)) {
      const averageScore = Math.round((stats.total / stats.count) * 100) / 100; // Round to 2 decimals
      
      // Update the score
      await supabaseClient
        .from("segment_profiles")
        .update({ calibration_score: averageScore })
        .eq("id", segmentId);
        
      // Insert audit log
      if (stats.workspace_id) {
        await supabaseClient
          .from("audit_logs")
          .insert({
            workspace_id: stats.workspace_id,
            action: 'calibration_cron_run',
            resource_type: 'segment_profile',
            resource_id: segmentId,
            details: { new_score: averageScore },
            user_agent: 'cron-system'
          });
      }
    }

    return new Response(
      JSON.stringify({
        message: "Calibration engine executed successfully",
        segmentsUpdated: Object.keys(segmentScores).length,
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
