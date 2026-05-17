import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse } from "../_shared/cors.ts";

type ParticipantProfile = {
  id: string;
  status: string;
};

const logStep = (requestId: string, step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STUDY-PARTICIPATE] [${requestId}] ${step}${detailsStr}`);
};

const getIsoWeekStartDate = (date = new Date()) => {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day + 1);
  return d.toISOString().split("T")[0];
};

const mapAcceptError = (message: string) => {
  if (message.includes("participant_profile_not_found")) return { status: 404, error: "Participant profile not found" };
  if (message.includes("participant_not_active")) return { status: 403, error: "Participant account is not eligible for studies" };
  if (message.includes("study_not_found")) return { status: 404, error: "Study not found" };
  if (message.includes("study_full")) return { status: 409, error: "Study is full" };
  if (message.includes("study_expired")) return { status: 409, error: "Study has expired" };
  if (message.includes("study_not_accepting")) return { status: 409, error: "Study is not accepting participants" };
  return { status: 500, error: message };
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

  const getParticipantProfile = async (userId: string): Promise<ParticipantProfile | null> => {
    const { data } = await supabaseAdmin
      .from("participant_profiles")
      .select("id, status")
      .eq("user_id", userId)
      .single();
    return data as ParticipantProfile | null;
  };

  const assertWorkspaceAccess = async (userId: string, workspaceId: string) => {
    const { data, error } = await supabaseAdmin
      .from("workspace_memberships")
      .select("id, role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .in("role", ["owner", "admin", "researcher"])
      .maybeSingle();

    if (error) throw error;
    return Boolean(data);
  };

  try {
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return jsonResponse(req, { error: "Unauthorized", request_id: requestId }, 401);
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return jsonResponse(req, { error: "Malformed JSON payload", request_id: requestId }, 400);
    }

    const { action, study_id, participation_id, rating, notes } = body as Record<string, any>;

    if (action === "accept") {
      if (!study_id) return jsonResponse(req, { error: "study_id required", request_id: requestId }, 400);

      const { data: participation, error } = await supabaseAdmin.rpc("accept_study_participation", {
        p_study_id: study_id,
        p_user_id: user.id,
      });

      if (error) {
        const mapped = mapAcceptError(error.message);
        return jsonResponse(req, { error: mapped.error, request_id: requestId }, mapped.status);
      }

      logStep(requestId, "ACCEPT", { studyId: study_id, participantId: participation?.participant_id });
      return jsonResponse(req, { ...participation, request_id: requestId }, 201);
    }

    if (action === "submit") {
      if (!participation_id) return jsonResponse(req, { error: "participation_id required", request_id: requestId }, 400);

      const profile = await getParticipantProfile(user.id);
      if (!profile) return jsonResponse(req, { error: "Participant profile not found", request_id: requestId }, 404);
      if (profile.status !== "active") {
        return jsonResponse(req, { error: "Participant account is not eligible for studies", request_id: requestId }, 403);
      }

      const { data: participation, error: participationError } = await supabaseAdmin
        .from("study_participations")
        .select("*")
        .eq("id", participation_id)
        .eq("participant_id", profile.id)
        .single();

      if (participationError || !participation) {
        return jsonResponse(req, { error: "Participation not found", request_id: requestId }, 404);
      }

      if (["submitted", "approved", "paid"].includes(participation.status)) {
        return jsonResponse(req, { ...participation, idempotent: true, request_id: requestId });
      }

      if (!["accepted", "in_progress"].includes(participation.status)) {
        return jsonResponse(req, {
          error: `Cannot submit participation from ${participation.status}`,
          request_id: requestId,
        }, 409);
      }

      const submissionPayload = {
        ...(body.submission_payload && typeof body.submission_payload === "object"
          ? body.submission_payload
          : { responses: body.responses || {} }),
        submitted_by: user.id,
        submitted_at: new Date().toISOString(),
      };

      const { data: updated, error } = await supabaseAdmin
        .from("study_participations")
        .update({
          status: "submitted",
          completed_at: new Date().toISOString(),
          submitted_at: new Date().toISOString(),
          submission_payload: submissionPayload,
        })
        .eq("id", participation_id)
        .eq("participant_id", profile.id)
        .select()
        .single();

      if (error) throw error;
      logStep(requestId, "SUBMIT", { participationId: participation_id });
      return jsonResponse(req, { ...updated, request_id: requestId });
    }

    if (action === "approve" || action === "reject") {
      if (!participation_id) return jsonResponse(req, { error: "participation_id required", request_id: requestId }, 400);

      const { data: participation, error: participationError } = await supabaseAdmin
        .from("study_participations")
        .select("*, study_listings(*)")
        .eq("id", participation_id)
        .single();

      if (participationError || !participation) {
        return jsonResponse(req, { error: "Participation not found", request_id: requestId }, 404);
      }

      const study = participation.study_listings;
      const hasAccess = await assertWorkspaceAccess(user.id, study.workspace_id);
      if (!hasAccess) {
        return jsonResponse(req, { error: "Researcher is not authorized for this study", request_id: requestId }, 403);
      }

      if (action === "reject") {
        if (participation.status === "rejected") {
          return jsonResponse(req, { status: "rejected", idempotent: true, request_id: requestId });
        }

        if (["approved", "paid"].includes(participation.status)) {
          return jsonResponse(req, {
            error: `Cannot reject participation from ${participation.status}`,
            request_id: requestId,
          }, 409);
        }

        if (participation.status !== "submitted") {
          return jsonResponse(req, {
            error: `Cannot reject participation from ${participation.status}`,
            request_id: requestId,
          }, 409);
        }

        const { data: updated, error } = await supabaseAdmin
          .from("study_participations")
          .update({
            status: "rejected",
            researcher_notes: notes || null,
            rejected_at: new Date().toISOString(),
          })
          .eq("id", participation_id)
          .select()
          .single();

        if (error) throw error;
        logStep(requestId, "REJECT", { participationId: participation_id });
        return jsonResponse(req, { ...updated, request_id: requestId });
      }

      if (participation.status === "approved" || participation.status === "paid") {
        const { data: existingEarning } = await supabaseAdmin
          .from("participant_earnings")
          .select("*")
          .eq("participation_id", participation.id)
          .eq("earning_type", "study")
          .maybeSingle();

        return jsonResponse(req, {
          participation_id,
          earning: existingEarning,
          status: participation.status,
          idempotent: true,
          request_id: requestId,
        });
      }

      if (participation.status !== "submitted") {
        return jsonResponse(req, {
          error: `Cannot approve participation from ${participation.status}`,
          request_id: requestId,
        }, 409);
      }

      const { data: updatedParticipation, error: updateError } = await supabaseAdmin
        .from("study_participations")
        .update({
          status: "approved",
          researcher_rating: rating || null,
          researcher_notes: notes || null,
          approved_at: new Date().toISOString(),
        })
        .eq("id", participation_id)
        .select()
        .single();

      if (updateError) throw updateError;

      const { data: rep } = await supabaseAdmin
        .from("participant_reputation")
        .select("*")
        .eq("participant_id", participation.participant_id)
        .single();

      let finalEarningCents = study.reward_amount_cents;
      let streakBonusCents = 0;
      let newStreak = 0;
      let currentWeekStr = "";

      if (rep) {
        currentWeekStr = getIsoWeekStartDate();
        const lastWeekStr = rep.last_activity_week;
        newStreak = rep.streak_weeks || 0;

        if (!lastWeekStr) {
          newStreak = 1;
        } else {
          const cwDate = new Date(currentWeekStr);
          const lwDate = new Date(lastWeekStr);
          const diffWeeks = Math.round((cwDate.getTime() - lwDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
          if (diffWeeks === 1) newStreak += 1;
          else if (diffWeeks > 1) newStreak = 1;
        }

        let streakBonusPct = 0;
        if (newStreak >= 12) streakBonusPct = 15;
        else if (newStreak >= 8) streakBonusPct = 10;
        else if (newStreak >= 4) streakBonusPct = 5;

        if (streakBonusPct > 0) {
          streakBonusCents = Math.round(study.reward_amount_cents * (streakBonusPct / 100));
          finalEarningCents += streakBonusCents;
        }
      }

      const { data: earning, error: earnError } = await supabaseAdmin
        .from("participant_earnings")
        .insert({
          participant_id: participation.participant_id,
          participation_id: participation.id,
          amount_cents: finalEarningCents,
          currency: study.currency,
          earning_type: "study",
          status: "available",
          description: `Study: ${study.title}${streakBonusCents > 0 ? ` (+${(streakBonusCents / 100).toFixed(2)} streak bonus)` : ""}`,
        })
        .select()
        .single();

      if (earnError) throw earnError;

      if (rep) {
        const newTotal = rep.total_studies + 1;
        let referralBonusToCurrent = 0;

        if (rep.total_studies === 0) {
          const { data: referral } = await supabaseAdmin
            .from("participant_referrals")
            .select("*")
            .eq("referred_id", participation.participant_id)
            .eq("status", "signed_up")
            .maybeSingle();

          if (referral) {
            referralBonusToCurrent = referral.referred_bonus_cents;
            await supabaseAdmin.from("participant_earnings").insert({
              participant_id: participation.participant_id,
              amount_cents: referral.referred_bonus_cents,
              currency: "USD",
              earning_type: "referral",
              status: "available",
              description: "Welcome referral bonus",
            });

            await supabaseAdmin.from("participant_earnings").insert({
              participant_id: referral.referrer_id,
              amount_cents: referral.referrer_bonus_cents,
              currency: "USD",
              earning_type: "referral",
              status: "available",
              description: "Referral bonus for a first completed study",
            });

            await supabaseAdmin.from("participant_referrals").update({
              status: "completed",
              completed_at: new Date().toISOString(),
              referrer_bonus_paid: true,
              referred_bonus_paid: true,
            }).eq("id", referral.id);

            const { data: refRep } = await supabaseAdmin
              .from("participant_reputation")
              .select("total_earned_cents")
              .eq("participant_id", referral.referrer_id)
              .single();

            if (refRep) {
              await supabaseAdmin.from("participant_reputation").update({
                total_earned_cents: refRep.total_earned_cents + referral.referrer_bonus_cents,
              }).eq("participant_id", referral.referrer_id);
            }
          }
        }

        const newEarned = rep.total_earned_cents + finalEarningCents + referralBonusToCurrent;
        let newAvg = rep.avg_rating;
        if (rating) {
          newAvg = Number(((Number(rep.avg_rating) * rep.total_studies + rating) / newTotal).toFixed(2));
        }

        let newTier = "newcomer";
        if (newTotal >= 50 && newAvg >= 4.5) newTier = "elite";
        else if (newTotal >= 25 && newAvg >= 4.0) newTier = "expert";
        else if (newTotal >= 10 && newAvg >= 3.5) newTier = "trusted";
        else if (newTotal >= 3) newTier = "regular";

        await supabaseAdmin
          .from("participant_reputation")
          .update({
            total_studies: newTotal,
            avg_rating: newAvg,
            total_earned_cents: newEarned,
            tier: newTier,
            streak_weeks: newStreak,
            last_activity_week: currentWeekStr,
            updated_at: new Date().toISOString(),
          })
          .eq("participant_id", participation.participant_id);
      }

      logStep(requestId, "APPROVE", { participationId: participation_id, earnedCents: finalEarningCents });
      return jsonResponse(req, {
        participation_id,
        participation: updatedParticipation,
        earning,
        status: "approved",
        request_id: requestId,
      });
    }

    return jsonResponse(req, {
      error: "Invalid action. Use: accept, submit, approve, reject",
      request_id: requestId,
    }, 400);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    logStep(requestId, "ERROR", { message });
    return jsonResponse(req, { error: message, request_id: requestId }, 500);
  }
});
