import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, getCorsHeaders } from "../_shared/cors.ts";

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[PARTICIPANT-PROFILE] ${step}${detailsStr}`);
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
    // Get authenticated user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    if (req.method === "GET") {
      logStep("GET profile", { userId: user.id });

      // Fetch profile
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("participant_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (profileError || !profile) {
        return new Response(JSON.stringify({ error: "Profile not found" }), {
          status: 404,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      // Fetch reputation
      const { data: reputation } = await supabaseAdmin
        .from("participant_reputation")
        .select("*")
        .eq("participant_id", profile.id)
        .single();

      // Fetch earnings summary
      const { data: earnings } = await supabaseAdmin
        .from("participant_earnings")
        .select("id, amount_cents, status, description, created_at")
        .eq("participant_id", profile.id)
        .order("created_at", { ascending: false });

      const earningsSummary = {
        total_earned_cents: 0,
        pending_cents: 0,
        available_cents: 0,
        history: earnings || [],
      };

      if (earnings) {
        for (const e of earnings) {
          earningsSummary.total_earned_cents += e.amount_cents;
          if (e.status === "pending") earningsSummary.pending_cents += e.amount_cents;
          if (e.status === "available") earningsSummary.available_cents += e.amount_cents;
        }
      }

      return new Response(JSON.stringify({ profile, reputation, earnings: earningsSummary }), {
        status: 200,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    if (req.method === "PATCH") {
      logStep("PATCH profile", { userId: user.id });
      const updates = await req.json();

      // Allowed fields for update
      const allowedFields = [
        "display_name", "avatar_url", "date_of_birth", "gender", "country", "city",
        "ethnicity", "income_bracket", "education", "employment_status",
        "industry", "job_title", "interests", "languages", "availability", "bio",
      ];

      const safeUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const key of allowedFields) {
        if (key in updates) safeUpdates[key] = updates[key];
      }

      // Mark onboarding completed if enough fields filled
      const profileFields = ["gender", "country", "industry"];
      const hasEnough = profileFields.every(f => f in updates && updates[f]);
      if (hasEnough) {
        safeUpdates.onboarding_completed_at = new Date().toISOString();
      }

      const { data: updated, error: updateError } = await supabaseAdmin
        .from("participant_profiles")
        .update(safeUpdates)
        .eq("user_id", user.id)
        .select()
        .single();

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ profile: updated }), {
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
