import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse } from "../_shared/cors.ts";

const logStep = (requestId: string, step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[PARTICIPANT-PRIVACY] [${requestId}] ${step}${detailsStr}`);
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
    const action = String(body.action || "");

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("participant_profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return jsonResponse(req, { error: "Participant profile not found", request_id: requestId }, 404);
    }

    if (action === "export") {
      const [
        reputationResult,
        participationsResult,
        earningsResult,
        payoutRequestsResult,
        referralsAsReferrerResult,
        referralsAsReferredResult,
        notificationsResult,
      ] = await Promise.all([
        supabaseAdmin.from("participant_reputation").select("*").eq("participant_id", profile.id).maybeSingle(),
        supabaseAdmin.from("study_participations").select("*, study_listings(id, title, study_type, reward_amount_cents, currency)").eq("participant_id", profile.id),
        supabaseAdmin.from("participant_earnings").select("*").eq("participant_id", profile.id).order("created_at", { ascending: false }),
        supabaseAdmin.from("participant_payout_requests").select("*").eq("participant_id", profile.id).order("requested_at", { ascending: false }),
        supabaseAdmin.from("participant_referrals").select("*").eq("referrer_id", profile.id).order("created_at", { ascending: false }),
        supabaseAdmin.from("participant_referrals").select("*").eq("referred_id", profile.id).order("created_at", { ascending: false }),
        supabaseAdmin.from("participant_notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);

      const exportPayload = {
        exported_at: new Date().toISOString(),
        auth_user: {
          id: user.id,
          email: user.email,
          email_confirmed_at: user.email_confirmed_at,
        },
        profile,
        reputation: reputationResult.data,
        participations: participationsResult.data || [],
        earnings: earningsResult.data || [],
        payout_requests: payoutRequestsResult.data || [],
        referrals: {
          as_referrer: referralsAsReferrerResult.data || [],
          as_referred: referralsAsReferredResult.data || [],
        },
        notifications: notificationsResult.data || [],
      };

      const { data: privacyRequest, error: privacyError } = await supabaseAdmin
        .from("privacy_requests")
        .insert({
          participant_id: profile.id,
          user_id: user.id,
          request_type: "export",
          status: "completed",
          export_payload: exportPayload,
          completed_at: new Date().toISOString(),
        })
        .select("id, request_type, status, requested_at, completed_at")
        .single();

      if (privacyError) throw privacyError;
      logStep(requestId, "EXPORT", { participantId: profile.id, privacyRequestId: privacyRequest.id });

      return jsonResponse(req, {
        privacy_request: privacyRequest,
        export: exportPayload,
        request_id: requestId,
      });
    }

    if (action === "request_erasure") {
      const { data: openPayout } = await supabaseAdmin
        .from("participant_payout_requests")
        .select("id, status")
        .eq("participant_id", profile.id)
        .in("status", ["requested", "processing"])
        .limit(1)
        .maybeSingle();

      if (openPayout) {
        return jsonResponse(req, {
          error: "Resolve the open payout request before account erasure",
          payout_request: openPayout,
          request_id: requestId,
        }, 409);
      }

      const { data: privacyRequest, error: privacyError } = await supabaseAdmin
        .from("privacy_requests")
        .insert({
          participant_id: profile.id,
          user_id: user.id,
          request_type: "erasure",
          status: "processing",
        })
        .select("*")
        .single();

      if (privacyError) throw privacyError;

      const now = new Date().toISOString();
      await supabaseAdmin
        .from("participant_profiles")
        .update({
          display_name: "Deleted participant",
          avatar_url: null,
          date_of_birth: null,
          gender: null,
          country: null,
          city: null,
          ethnicity: null,
          income_bracket: null,
          education: null,
          employment_status: null,
          industry: null,
          job_title: null,
          interests: [],
          languages: [],
          availability: {},
          bio: null,
          paypal_email: null,
          status: "suspended",
          erased_at: now,
          updated_at: now,
        })
        .eq("id", profile.id);

      await supabaseAdmin
        .from("study_participations")
        .update({
          submission_payload: { erased: true, erased_at: now },
          researcher_notes: null,
        })
        .eq("participant_id", profile.id);

      await supabaseAdmin
        .from("participant_notifications")
        .delete()
        .eq("user_id", user.id);

      await supabaseAdmin
        .from("participant_referrals")
        .update({ referred_id: null })
        .eq("referred_id", profile.id);

      await supabaseAdmin
        .from("participant_referrals")
        .delete()
        .eq("referrer_id", profile.id);

      const { data: completedRequest, error: completionError } = await supabaseAdmin
        .from("privacy_requests")
        .update({
          status: "completed",
          completed_at: now,
          updated_at: now,
        })
        .eq("id", privacyRequest.id)
        .select("id, request_type, status, requested_at, completed_at")
        .single();

      if (completionError) throw completionError;
      logStep(requestId, "ERASURE", { participantId: profile.id, privacyRequestId: completedRequest.id });

      return jsonResponse(req, {
        privacy_request: completedRequest,
        retained_records: ["participant_earnings", "participant_payout_requests", "privacy_requests"],
        request_id: requestId,
      });
    }

    return jsonResponse(req, {
      error: "Invalid action. Use: export, request_erasure",
      request_id: requestId,
    }, 400);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    logStep(requestId, "ERROR", { message });
    return jsonResponse(req, { error: message, request_id: requestId }, 500);
  }
});
