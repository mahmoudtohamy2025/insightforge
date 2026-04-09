import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, getCorsHeaders } from "../_shared/cors.ts";

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[PARTICIPANT-CASHOUT] ${step}${detailsStr}`);
};

const MINIMUM_CASHOUT_CENTS = 500; // $5.00

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

    logStep("Cashout requested", { userId: user.id });

    // Get participant profile
    const { data: profile } = await supabaseAdmin
      .from("participant_profiles")
      .select("id, user_id")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Get all available earnings
    const { data: availableEarnings, error: earningsError } = await supabaseAdmin
      .from("participant_earnings")
      .select("id, amount_cents")
      .eq("participant_id", profile.id)
      .eq("status", "available");

    if (earningsError) throw earningsError;

    if (!availableEarnings || availableEarnings.length === 0) {
      return new Response(JSON.stringify({ error: "No available earnings to cash out" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const totalCents = availableEarnings.reduce((sum, e) => sum + e.amount_cents, 0);

    if (totalCents < MINIMUM_CASHOUT_CENTS) {
      return new Response(JSON.stringify({
        error: `Minimum cashout is $${(MINIMUM_CASHOUT_CENTS / 100).toFixed(2)}. Current balance: $${(totalCents / 100).toFixed(2)}`,
        available_cents: totalCents,
        minimum_cents: MINIMUM_CASHOUT_CENTS,
      }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Mark all available earnings as "processing"
    const earningIds = availableEarnings.map(e => e.id);
    await supabaseAdmin
      .from("participant_earnings")
      .update({ status: "processing" })
      .in("id", earningIds);

    logStep("Earnings marked as processing", { count: earningIds.length, totalCents });

    // Attempt Tremendous payout
    const tremendousApiKey = Deno.env.get("TREMENDOUS_API_KEY");
    let payoutStatus = "processing";
    let providerResponse: Record<string, unknown> = {};

    if (tremendousApiKey && user.email) {
      try {
        const tremendousResp = await fetch("https://testflight.tremendous.com/api/v2/orders", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${tremendousApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            payment: { funding_source_id: "BALANCE" },
            rewards: [{
              value: { denomination: totalCents / 100, currency_code: "USD" },
              recipient: { email: user.email },
              delivery: { method: "EMAIL" },
              products: ["GIFT_CARD_CATALOG"],
            }],
          }),
        });

        providerResponse = await tremendousResp.json();

        if (tremendousResp.ok) {
          payoutStatus = "paid";
          logStep("Tremendous payout successful", { totalCents });
        } else {
          logStep("Tremendous payout failed", { response: providerResponse });
        }
      } catch (providerErr) {
        logStep("Tremendous API error", { message: String(providerErr) });
      }
    } else {
      logStep("No Tremendous API key or email; marking as processing for manual payout");
    }

    // Update earnings final status
    const now = new Date().toISOString();
    await supabaseAdmin
      .from("participant_earnings")
      .update({
        status: payoutStatus,
        paid_at: payoutStatus === "paid" ? now : null,
      })
      .in("id", earningIds);

    return new Response(JSON.stringify({
      status: payoutStatus,
      amount_cents: totalCents,
      amount_formatted: `$${(totalCents / 100).toFixed(2)}`,
      earnings_count: earningIds.length,
      provider_response: providerResponse,
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
