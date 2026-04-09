import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

  try {
    // Fetch participant profile
    const { data: profile } = await supabase
      .from("participant_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ scores: {} }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch active studies
    const { data: studies } = await supabase
      .from("study_listings")
      .select("id, requirements, study_type")
      .eq("status", "active");

    if (!studies || studies.length === 0) {
      return new Response(JSON.stringify({ scores: {} }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch reputation for soft-scoring
    const { data: reputation } = await supabase
      .from("participant_reputation")
      .select("tier, avg_rating, total_studies")
      .eq("participant_id", profile.id)
      .single();

    // Score each study
    const scores: Record<string, number> = {};

    for (const study of studies) {
      let score = 50; // baseline
      const req = (study.requirements as Record<string, unknown>) || {};

      // Demographic hard-filter scoring (each match adds points)
      if (req.min_age && req.max_age && profile.date_of_birth) {
        const age = Math.floor((Date.now() - new Date(profile.date_of_birth).getTime()) / (1000 * 60 * 60 * 24 * 365));
        const minAge = Number(req.min_age);
        const maxAge = Number(req.max_age);
        if (age >= minAge && age <= maxAge) score += 20;
        else score -= 20;
      }

      if (req.country && profile.country) {
        if (String(req.country).toLowerCase() === String(profile.country).toLowerCase()) score += 15;
      }

      if (req.gender && profile.gender) {
        if (String(req.gender).toLowerCase() === String(profile.gender).toLowerCase() || req.gender === "any") score += 10;
        else score -= 10;
      }

      if (req.employment && profile.employment_status) {
        if (String(req.employment) === profile.employment_status) score += 10;
      }

      if (req.industry && profile.industry) {
        if (String(req.industry) === profile.industry) score += 10;
      }

      // Interest overlap
      if (req.interests && Array.isArray(req.interests) && Array.isArray(profile.interests)) {
        const studyInterests = req.interests as string[];
        const participantInterests = (profile.interests as string[]) || [];
        const overlap = studyInterests.filter((i) => participantInterests.includes(i)).length;
        score += overlap * 5;
      }

      // Reputation soft-scoring
      if (reputation) {
        const tierBonus: Record<string, number> = { newcomer: 0, regular: 3, trusted: 6, expert: 9, elite: 12 };
        score += tierBonus[reputation.tier] || 0;
        if (reputation.avg_rating >= 4.5) score += 5;
      }

      // Clamp to 0-100
      scores[study.id] = Math.max(0, Math.min(100, Math.round(score)));
    }

    return new Response(
      JSON.stringify({ scores }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
