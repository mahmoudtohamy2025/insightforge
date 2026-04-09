import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, getCorsHeaders } from "../_shared/cors.ts";

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[PARTICIPANT-MATCH] ${step}${detailsStr}`);
};

interface StudyRequirements {
  min_age?: number;
  max_age?: number;
  gender?: string[];
  country?: string[];
  industry?: string[];
  education?: string[];
  employment_status?: string[];
}

function calculateMatchScore(
  profile: Record<string, unknown>,
  requirements: StudyRequirements,
  reputation: Record<string, unknown> | null
): number {
  let score = 50; // Base score

  // Demographic matching
  if (requirements.gender && requirements.gender.length > 0) {
    if (requirements.gender.includes(profile.gender as string)) score += 15;
    else return 0; // Hard requirement
  }

  if (requirements.country && requirements.country.length > 0) {
    if (requirements.country.includes(profile.country as string)) score += 10;
    else return 0; // Hard requirement
  }

  if (requirements.industry && requirements.industry.length > 0) {
    if (requirements.industry.includes(profile.industry as string)) score += 10;
  }

  if (requirements.education && requirements.education.length > 0) {
    if (requirements.education.includes(profile.education as string)) score += 5;
  }

  // Reputation bonus
  if (reputation) {
    const tier = reputation.tier as string;
    const tierBonus: Record<string, number> = {
      newcomer: 0,
      regular: 5,
      trusted: 10,
      expert: 15,
      elite: 20,
    };
    score += tierBonus[tier] || 0;

    // High avg rating bonus
    const avgRating = Number(reputation.avg_rating || 0);
    if (avgRating >= 4.5) score += 5;
  }

  return Math.min(100, score);
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
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

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();
    const { study_id } = body;

    if (!study_id) {
      return new Response(JSON.stringify({ error: "study_id required" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Get study details
    const { data: study, error: studyError } = await supabaseAdmin
      .from("study_listings")
      .select("*")
      .eq("id", study_id)
      .single();

    if (studyError || !study) {
      return new Response(JSON.stringify({ error: "Study not found" }), {
        status: 404,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const requirements = (study.requirements || {}) as StudyRequirements;

    // Get all active participant profiles
    const { data: profiles } = await supabaseAdmin
      .from("participant_profiles")
      .select("*")
      .eq("status", "active");

    if (!profiles || profiles.length === 0) {
      logStep("No active participants to match");
      return new Response(JSON.stringify({ matched: 0, participants: [] }), {
        status: 200,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Get reputations
    const participantIds = profiles.map(p => p.id);
    const { data: reputations } = await supabaseAdmin
      .from("participant_reputation")
      .select("*")
      .in("participant_id", participantIds);

    const repMap = new Map<string, Record<string, unknown>>();
    (reputations || []).forEach((r: Record<string, unknown>) => {
      repMap.set(r.participant_id as string, r);
    });

    // Score and rank participants
    const scored = profiles.map(profile => ({
      participant_id: profile.id,
      user_id: profile.user_id,
      display_name: profile.display_name,
      score: calculateMatchScore(profile as Record<string, unknown>, requirements, repMap.get(profile.id) || null),
    })).filter(p => p.score > 0).sort((a, b) => b.score - a.score);

    // Create notifications for top matches (limit to max_participants * 2)
    const topMatches = scored.slice(0, Math.min(scored.length, study.max_participants * 2));

    let notifiedCount = 0;
    for (const match of topMatches) {
      try {
        await supabaseAdmin.from("notifications").insert({
          user_id: match.user_id,
          title: "New Study Match! 🎯",
          message: `"${study.title}" matches your profile. Reward: $${(study.reward_amount_cents / 100).toFixed(2)} for ${study.estimated_minutes} min.`,
          type: "study_match",
          link: `/participate/studies`,
        });
        notifiedCount++;
      } catch {
        // Skip individual notification failures
      }
    }

    logStep("Matching complete", {
      studyId: study_id,
      totalProfiles: profiles.length,
      scored: scored.length,
      notified: notifiedCount,
    });

    return new Response(JSON.stringify({
      matched: scored.length,
      notified: notifiedCount,
      top_matches: topMatches.slice(0, 10), // Return top 10 for visibility
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
