import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse } from "../_shared/cors.ts";

const MINIMUM_CASHOUT_CENTS = 500; // $5.00
const OPEN_PAYOUT_STATUSES = ["requested", "processing"];

const logStep = (requestId: string, step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[PARTICIPANT-CASHOUT] [${requestId}] ${step}${detailsStr}`);
};

const extractProviderOrderId = (providerResponse: Record<string, unknown>) => {
  const order = providerResponse.order as Record<string, unknown> | undefined;
  const reward = Array.isArray(providerResponse.rewards) ? providerResponse.rewards[0] as Record<string, unknown> | undefined : undefined;
  return String(order?.id || providerResponse.id || reward?.id || "");
};

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed", request_id: requestId }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse(req, { error: "Unauthorized", request_id: requestId }, 401);
  }

  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return jsonResponse(req, { error: "Unauthorized", request_id: requestId }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const idempotencyKey = String(
      body.idempotency_key || req.headers.get("idempotency-key") || crypto.randomUUID(),
    );

    if (!user.email || !user.email_confirmed_at) {
      return jsonResponse(req, {
        error: "Verified participant email required before cashout",
        request_id: requestId,
      }, 400);
    }

    const { data: profile } = await supabaseAdmin
      .from("participant_profiles")
      .select("id, user_id, status, paypal_email")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return jsonResponse(req, { error: "Profile not found", request_id: requestId }, 404);
    }

    if (profile.status !== "active") {
      return jsonResponse(req, { error: "Participant account is not eligible for cashout", request_id: requestId }, 403);
    }

    const { data: existingByKey, error: existingByKeyError } = await supabaseAdmin
      .from("participant_payout_requests")
      .select("*")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existingByKeyError) throw existingByKeyError;
    if (existingByKey) {
      return jsonResponse(req, {
        status: existingByKey.status,
        amount_cents: existingByKey.amount_cents,
        amount_formatted: `$${(existingByKey.amount_cents / 100).toFixed(2)}`,
        provider: existingByKey.provider,
        method: existingByKey.provider,
        provider_order_id: existingByKey.provider_order_id,
        payout_request: existingByKey,
        idempotent: true,
        request_id: requestId,
      });
    }

    const { data: openRequest, error: openRequestError } = await supabaseAdmin
      .from("participant_payout_requests")
      .select("*")
      .eq("participant_id", profile.id)
      .in("status", OPEN_PAYOUT_STATUSES)
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (openRequestError) throw openRequestError;
    if (openRequest) {
      return jsonResponse(req, {
        error: "A payout request is already open",
        payout_request: openRequest,
        request_id: requestId,
      }, 409);
    }

    const { data: availableEarnings, error: earningsError } = await supabaseAdmin
      .from("participant_earnings")
      .select("id, amount_cents")
      .eq("participant_id", profile.id)
      .eq("status", "available");

    if (earningsError) throw earningsError;
    if (!availableEarnings?.length) {
      return jsonResponse(req, { error: "No available earnings to cash out", request_id: requestId }, 400);
    }

    const totalCents = availableEarnings.reduce((sum, earning) => sum + earning.amount_cents, 0);
    if (totalCents < MINIMUM_CASHOUT_CENTS) {
      return jsonResponse(req, {
        error: `Minimum cashout is $${(MINIMUM_CASHOUT_CENTS / 100).toFixed(2)}. Current balance: $${(totalCents / 100).toFixed(2)}`,
        available_cents: totalCents,
        minimum_cents: MINIMUM_CASHOUT_CENTS,
        request_id: requestId,
      }, 400);
    }

    const earningIds = availableEarnings.map((earning) => earning.id);
    const { data: payoutRequest, error: payoutInsertError } = await supabaseAdmin
      .from("participant_payout_requests")
      .insert({
        participant_id: profile.id,
        amount_cents: totalCents,
        currency: "USD",
        status: "requested",
        provider: "tremendous",
        idempotency_key: idempotencyKey,
        earning_ids: earningIds,
      })
      .select()
      .single();

    if (payoutInsertError) throw payoutInsertError;

    await supabaseAdmin
      .from("participant_earnings")
      .update({ status: "processing" })
      .in("id", earningIds)
      .eq("participant_id", profile.id)
      .eq("status", "available");

    logStep(requestId, "Earnings locked for payout", {
      payoutRequestId: payoutRequest.id,
      earningsCount: earningIds.length,
      totalCents,
    });

    const tremendousApiKey = Deno.env.get("TREMENDOUS_API_KEY");
    let payoutStatus = "processing";
    let providerOrderId = "";
    let providerResponse: Record<string, unknown> = {};
    let failureReason = "";

    if (tremendousApiKey) {
      try {
        const tremendousResp = await fetch("https://testflight.tremendous.com/api/v2/orders", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${tremendousApiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
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

        providerResponse = await tremendousResp.json().catch(() => ({}));
        providerOrderId = extractProviderOrderId(providerResponse);

        if (tremendousResp.ok) {
          payoutStatus = "paid";
        } else {
          payoutStatus = "failed";
          failureReason = `Tremendous returned ${tremendousResp.status}`;
        }
      } catch (providerErr) {
        payoutStatus = "failed";
        failureReason = providerErr instanceof Error ? providerErr.message : "Tremendous request failed";
      }
    } else {
      logStep(requestId, "No Tremendous API key configured; payout left for manual processing");
    }

    const now = new Date().toISOString();
    const { data: updatedRequest, error: payoutUpdateError } = await supabaseAdmin
      .from("participant_payout_requests")
      .update({
        status: payoutStatus,
        provider_order_id: providerOrderId || null,
        provider_response: providerResponse,
        failure_reason: failureReason || null,
        processed_at: payoutStatus === "paid" || payoutStatus === "failed" ? now : null,
        updated_at: now,
      })
      .eq("id", payoutRequest.id)
      .select()
      .single();

    if (payoutUpdateError) throw payoutUpdateError;

    if (payoutStatus === "failed") {
      await supabaseAdmin
        .from("participant_earnings")
        .update({ status: "available", paid_at: null })
        .in("id", earningIds);

      return jsonResponse(req, {
        error: "Payout provider failed; earnings were released for retry",
        status: payoutStatus,
        failure_reason: failureReason,
        payout_request: updatedRequest,
        request_id: requestId,
      }, 502);
    }

    await supabaseAdmin
      .from("participant_earnings")
      .update({
        status: payoutStatus,
        paid_at: payoutStatus === "paid" ? now : null,
      })
      .in("id", earningIds);

    return jsonResponse(req, {
      status: payoutStatus,
      amount_cents: totalCents,
      amount_formatted: `$${(totalCents / 100).toFixed(2)}`,
      earnings_count: earningIds.length,
      provider: "tremendous",
      method: "tremendous",
      provider_order_id: providerOrderId || null,
      payout_request: updatedRequest,
      request_id: requestId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    logStep(requestId, "ERROR", { message });
    return jsonResponse(req, { error: message, request_id: requestId }, 500);
  }
});
