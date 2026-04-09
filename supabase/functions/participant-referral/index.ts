import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateCode(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

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

  const { data: profile } = await supabase
    .from("participant_profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) return new Response(JSON.stringify({ error: "Participant profile not found" }), { status: 404, headers: corsHeaders });

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  // GET /participant-referral?action=get — return referral code + stats
  if (req.method === "GET" && action === "get") {
    // Find or create the "open" referral slot (the participant's shareable code)
    let { data: existing } = await supabase
      .from("participant_referrals")
      .select("*")
      .eq("referrer_id", profile.id)
      .is("referred_id", null)  // open slot
      .limit(1)
      .single();

    if (!existing) {
      // Generate unique code
      let code = generateCode();
      let collision = true;
      while (collision) {
        const { data: check } = await supabase.from("participant_referrals").select("id").eq("referral_code", code).single();
        if (!check) collision = false;
        else code = generateCode();
      }
      const { data: created } = await supabase
        .from("participant_referrals")
        .insert({ referrer_id: profile.id, referral_code: code })
        .select()
        .single();
      existing = created;
    }

    // Stats: completed referrals
    const { data: stats } = await supabase
      .from("participant_referrals")
      .select("id, status, referred_id, created_at, signed_up_at, completed_at")
      .eq("referrer_id", profile.id)
      .not("referred_id", "is", null)
      .order("created_at", { ascending: false });

    const completedCount = (stats || []).filter((r) => r.status === "completed" || r.status === "paid").length;
    const totalBonusEarned = completedCount * 200; // $2.00 per completed referral

    return new Response(
      JSON.stringify({
        referral_code: existing?.referral_code,
        referrals: stats || [],
        completed_count: completedCount,
        total_bonus_earned_cents: totalBonusEarned,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // POST /participant-referral — claim/register a referral code on signup
  if (req.method === "POST") {
    const body = await req.json();
    const { referral_code } = body;

    if (!referral_code) return new Response(JSON.stringify({ error: "referral_code required" }), { status: 400, headers: corsHeaders });

    // Find the open referral slot matching this code
    const { data: referral } = await supabase
      .from("participant_referrals")
      .select("*")
      .eq("referral_code", referral_code)
      .is("referred_id", null)
      .single();

    if (!referral) return new Response(JSON.stringify({ error: "Invalid or already used referral code" }), { status: 400, headers: corsHeaders });
    if (referral.referrer_id === profile.id) return new Response(JSON.stringify({ error: "Cannot refer yourself" }), { status: 400, headers: corsHeaders });

    // Link the referred participant
    await supabase
      .from("participant_referrals")
      .update({ referred_id: profile.id, status: "signed_up", signed_up_at: new Date().toISOString() })
      .eq("id", referral.id);

    return new Response(
      JSON.stringify({ success: true, message: "Referral registered! You'll earn $2.00 when you complete your first study." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
});
