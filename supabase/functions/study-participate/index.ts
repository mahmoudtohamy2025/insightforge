import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, getCorsHeaders } from "../_shared/cors.ts";

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STUDY-PARTICIPATE] ${step}${detailsStr}`);
};

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

    const body = await req.json();
    const { action, study_id, participation_id, rating, notes } = body;

    // ── ACCEPT: Participant joins a study ──
    if (action === "accept") {
      if (!study_id) {
        return new Response(JSON.stringify({ error: "study_id required" }), {
          status: 400,
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
        return new Response(JSON.stringify({ error: "Participant profile not found" }), {
          status: 404,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      // Check study is active and has capacity
      const { data: study } = await supabaseAdmin
        .from("study_listings")
        .select("*")
        .eq("id", study_id)
        .eq("status", "active")
        .single();

      if (!study) {
        return new Response(JSON.stringify({ error: "Study not found or not active" }), {
          status: 404,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      if (study.current_participants >= study.max_participants) {
        return new Response(JSON.stringify({ error: "Study is full" }), {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      // Create participation
      const { data: participation, error: partError } = await supabaseAdmin
        .from("study_participations")
        .insert({
          study_id,
          participant_id: profile.id,
          status: "accepted",
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (partError) {
        if (partError.code === "23505") {
          return new Response(JSON.stringify({ error: "Already participating in this study" }), {
            status: 409,
            headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
          });
        }
        throw partError;
      }

      // Increment participant count
      await supabaseAdmin
        .from("study_listings")
        .update({ current_participants: study.current_participants + 1 })
        .eq("id", study_id);

      // Auto-fill if max reached
      if (study.current_participants + 1 >= study.max_participants) {
        await supabaseAdmin
          .from("study_listings")
          .update({ status: "filled" })
          .eq("id", study_id);
      }

      logStep("ACCEPT", { studyId: study_id, participantId: profile.id });
      return new Response(JSON.stringify(participation), {
        status: 201,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // ── SUBMIT: Participant marks study as completed ──
    if (action === "submit") {
      if (!participation_id) {
        return new Response(JSON.stringify({ error: "participation_id required" }), {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      const { data: updated, error } = await supabaseAdmin
        .from("study_participations")
        .update({
          status: "submitted",
          completed_at: new Date().toISOString(),
        })
        .eq("id", participation_id)
        .select()
        .single();

      if (error) throw error;
      logStep("SUBMIT", { participationId: participation_id });
      return new Response(JSON.stringify(updated), {
        status: 200,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // ── APPROVE: Researcher approves submission → triggers payment ──
    if (action === "approve") {
      if (!participation_id) {
        return new Response(JSON.stringify({ error: "participation_id required" }), {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      // Get participation with study details
      const { data: participation } = await supabaseAdmin
        .from("study_participations")
        .select("*, study_listings(*)")
        .eq("id", participation_id)
        .single();

      if (!participation) {
        return new Response(JSON.stringify({ error: "Participation not found" }), {
          status: 404,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      const study = participation.study_listings;

      // Update participation status
      await supabaseAdmin
        .from("study_participations")
        .update({
          status: "approved",
          researcher_rating: rating || null,
          researcher_notes: notes || null,
        })
        .eq("id", participation_id);

      // Fetch participant reputation for streak & tier logic
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
        // Streak logic
        const getIsoWeekStartDate = (date = new Date()) => {
          const d = new Date(date);
          const day = d.getDay() || 7;
          d.setHours(0, 0, 0, 0);
          d.setDate(d.getDate() - day + 1);
          return d.toISOString().split('T')[0];
        };
        currentWeekStr = getIsoWeekStartDate();
        const lastWeekStr = rep.last_activity_week;
        newStreak = rep.streak_weeks || 0;

        if (!lastWeekStr) {
          newStreak = 1;
        } else {
          const cwDate = new Date(currentWeekStr);
          const lwDate = new Date(lastWeekStr);
          const diffWeeks = Math.round((cwDate.getTime() - lwDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
          if (diffWeeks === 0) {
            // Already active this week, streak remains as is
          } else if (diffWeeks === 1) {
            newStreak += 1; // Kept the streak alive
          } else {
            newStreak = 1; // Broken streak, start over
          }
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

      // Create earnings record
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
          // Referral Engine: Check if they were referred and it's their first study
          const { data: referral } = await supabaseAdmin
            .from("participant_referrals")
            .select("*")
            .eq("referred_id", participation.participant_id)
            .eq("status", "signed_up")
            .single();

          if (referral) {
            // Give referred participant $2.00
            referralBonusToCurrent = referral.referred_bonus_cents;
            await supabaseAdmin.from("participant_earnings").insert({
              participant_id: participation.participant_id,
              amount_cents: referral.referred_bonus_cents,
              currency: "USD",
              earning_type: "referral_bonus",
              status: "available",
              description: "Welcome Referral Bonus! 🎉"
            });
            
            // Give referrer their $2.00
            await supabaseAdmin.from("participant_earnings").insert({
              participant_id: referral.referrer_id,
              amount_cents: referral.referrer_bonus_cents,
              currency: "USD",
              earning_type: "referral_bonus",
              status: "available",
              description: "Referral Bonus for a friend's first study! 🎁"
            });
            
            // Update the referral record to completed
            await supabaseAdmin.from("participant_referrals").update({
              status: "completed",
              completed_at: new Date().toISOString(),
              referrer_bonus_paid: true,
              referred_bonus_paid: true
            }).eq("id", referral.id);
            
            // Update referrer's reputation earnings
            const { data: refRep } = await supabaseAdmin
              .from("participant_reputation")
              .select("total_earned_cents")
              .eq("participant_id", referral.referrer_id)
              .single();
            if (refRep) {
              await supabaseAdmin.from("participant_reputation").update({
                total_earned_cents: refRep.total_earned_cents + referral.referrer_bonus_cents
              }).eq("participant_id", referral.referrer_id);
            }
          }
        }

        const newEarned = rep.total_earned_cents + finalEarningCents + referralBonusToCurrent;

        // Calculate new avg rating
        let newAvg = rep.avg_rating;
        if (rating) {
          newAvg = Number(((Number(rep.avg_rating) * rep.total_studies + rating) / newTotal).toFixed(2));
        }

        // Determine tier
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

      logStep("APPROVE", { participationId: participation_id, earnedCents: study.reward_amount_cents });
      return new Response(JSON.stringify({ participation_id, earning, status: "approved" }), {
        status: 200,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // ── REJECT: Researcher rejects submission ──
    if (action === "reject") {
      if (!participation_id) {
        return new Response(JSON.stringify({ error: "participation_id required" }), {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      await supabaseAdmin
        .from("study_participations")
        .update({
          status: "rejected",
          researcher_notes: notes || null,
        })
        .eq("id", participation_id);

      logStep("REJECT", { participationId: participation_id });
      return new Response(JSON.stringify({ status: "rejected" }), {
        status: 200,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action. Use: accept, submit, approve, reject" }), {
      status: 400,
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
