import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, getCorsHeaders } from "../_shared/cors.ts";

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[PARTICIPANT-IMPACT] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }

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

    // Get participant profile
    const { data: profile } = await supabaseAdmin
      .from("participant_profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Get reputation data
    const { data: reputation } = await supabaseAdmin
      .from("participant_reputation")
      .select("*")
      .eq("participant_id", profile.id)
      .single();

    // Get completed participations count
    const { count: completedStudies } = await supabaseAdmin
      .from("study_participations")
      .select("*", { count: "exact", head: true })
      .eq("participant_id", profile.id)
      .in("status", ["approved", "paid"]);

    // Count simulations that used calibration data related to this participant's studies
    const twinContributions = reputation?.twin_contributions || 0;

    // Calculate badges
    const badges: Array<{ id: string; name: string; icon: string; earned: boolean; description: string }> = [
      {
        id: "first_study",
        name: "Pioneer",
        icon: "🌱",
        earned: (completedStudies || 0) >= 1,
        description: "Completed your first study",
      },
      {
        id: "five_studies",
        name: "Regular Contributor",
        icon: "⭐",
        earned: (completedStudies || 0) >= 5,
        description: "Completed 5 studies",
      },
      {
        id: "ten_studies",
        name: "Seasoned Researcher",
        icon: "💎",
        earned: (completedStudies || 0) >= 10,
        description: "Completed 10 studies",
      },
      {
        id: "perfect_rating",
        name: "Five Star Participant",
        icon: "🌟",
        earned: Number(reputation?.avg_rating || 0) >= 4.8 && (completedStudies || 0) >= 3,
        description: "Maintained a 4.8+ rating across 3+ studies",
      },
      {
        id: "calibration",
        name: "AI Calibrator",
        icon: "🤖",
        earned: twinContributions >= 1,
        description: "Contributed to AI Twin calibration",
      },
      {
        id: "elite",
        name: "Elite Member",
        icon: "👑",
        earned: reputation?.tier === "elite",
        description: "Reached Elite tier status",
      },
    ];

    // Build impact feed (anonymized)
    const impactFeed = [
      ...(completedStudies && completedStudies > 0 ? [{
        type: "contribution",
        message: `Your responses have been used in ${completedStudies} research ${completedStudies === 1 ? "study" : "studies"}`,
        timestamp: new Date().toISOString(),
      }] : []),
      ...(twinContributions > 0 ? [{
        type: "twin",
        message: `Your calibration data has powered ${twinContributions} AI simulation${twinContributions === 1 ? "" : "s"}`,
        timestamp: new Date().toISOString(),
      }] : []),
    ];

    // Tier progress
    const tierThresholds: Record<string, { next: string; studiesNeeded: number; ratingNeeded: number }> = {
      newcomer: { next: "regular", studiesNeeded: 3, ratingNeeded: 0 },
      regular: { next: "trusted", studiesNeeded: 10, ratingNeeded: 3.5 },
      trusted: { next: "expert", studiesNeeded: 25, ratingNeeded: 4.0 },
      expert: { next: "elite", studiesNeeded: 50, ratingNeeded: 4.5 },
      elite: { next: "elite", studiesNeeded: 50, ratingNeeded: 4.5 },
    };

    const currentTier = reputation?.tier || "newcomer";
    const tierInfo = tierThresholds[currentTier] || tierThresholds.newcomer;
    const progress = Math.min(
      100,
      Math.round(((completedStudies || 0) / tierInfo.studiesNeeded) * 100)
    );

    logStep("Impact data retrieved", { participantId: profile.id });

    return new Response(JSON.stringify({
      reputation,
      badges,
      impactFeed,
      stats: {
        total_studies: completedStudies || 0,
        twin_contributions: twinContributions,
        completion_rate: reputation?.completion_rate || 100,
        avg_rating: reputation?.avg_rating || 5.0,
      },
      tierProgress: {
        current: currentTier,
        next: tierInfo.next,
        progress,
        studiesNeeded: tierInfo.studiesNeeded,
        studiesCompleted: completedStudies || 0,
      },
    }), {
      status: 200,
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
