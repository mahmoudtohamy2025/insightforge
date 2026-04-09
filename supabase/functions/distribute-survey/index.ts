import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, getCorsHeaders, jsonResponse } from "../_shared/cors.ts";
import { requireWorkspaceMember } from "../_shared/validation.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse(req, { error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return jsonResponse(req, { error: "Unauthorized" }, 401);
    }
    const callerId = claimsData.claims.sub as string;

    const { survey_id, participant_ids, workspace_id } = await req.json();

    if (!survey_id || !workspace_id) {
      return jsonResponse(req, { error: "survey_id and workspace_id are required" }, 400);
    }

    if (!participant_ids || !Array.isArray(participant_ids) || participant_ids.length === 0) {
      return jsonResponse(req, { error: "participant_ids array is required" }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Verify caller has access to the workspace
    const { data: membership } = await adminClient
      .from("workspace_memberships")
      .select("role")
      .eq("workspace_id", workspace_id)
      .eq("user_id", callerId)
      .single();

    if (!membership || !["owner", "admin", "researcher"].includes(membership.role)) {
      return jsonResponse(req, { error: "Insufficient permissions" }, 403);
    }

    // Verify survey exists and is live
    const { data: survey, error: surveyErr } = await adminClient
      .from("surveys")
      .select("id, title, status, workspace_id")
      .eq("id", survey_id)
      .eq("workspace_id", workspace_id)
      .single();

    if (surveyErr || !survey) {
      return jsonResponse(req, { error: "Survey not found" }, 404);
    }

    if (survey.status !== "live") {
      return jsonResponse(req, { error: "Survey must be live to distribute" }, 400);
    }

    // Fetch participant emails
    const { data: participants, error: partErr } = await adminClient
      .from("participants")
      .select("id, name, email")
      .eq("workspace_id", workspace_id)
      .in("id", participant_ids);

    if (partErr || !participants) {
      return jsonResponse(req, { error: "Failed to fetch participants" }, 500);
    }

    const withEmail = participants.filter((p) => p.email);
    const withoutEmail = participants.filter((p) => !p.email);

    // Build survey URL
    const appUrl = Deno.env.get("APP_URL") || supabaseUrl.replace(".supabase.co", ".lovableproject.com");
    const surveyUrl = `${appUrl}/s/${survey_id}`;

    // Send emails via Supabase auth's built-in email (or log for manual distribution)
    const sent: string[] = [];
    const failed: string[] = [];

    for (const participant of withEmail) {
      try {
        // Use Supabase's built-in SMTP to send a magic link style email
        // We'll use a simple approach — generate a personalized link
        // In production, this would use a dedicated email service (Resend, SendGrid, etc.)
        const personalizedUrl = `${surveyUrl}?ref=${participant.id}`;

        // For now, we just record the distribution — actual email sending
        // would require RESEND_API_KEY or similar. Log the intent.
        await adminClient.from("workspace_activity").insert({
          workspace_id,
          user_id: callerId,
          action: "survey_distributed",
          resource_type: "survey",
          resource_id: survey_id,
          metadata: {
            participant_id: participant.id,
            participant_name: participant.name,
            participant_email: participant.email,
            survey_url: personalizedUrl,
            survey_title: survey.title,
          },
        });

        sent.push(participant.id);
      } catch (err) {
        console.error(`Failed to process ${participant.email}:`, err);
        failed.push(participant.id);
      }
    }

    // If RESEND_API_KEY is set, actually send emails
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey && withEmail.length > 0) {
      for (const participant of withEmail) {
        const personalizedUrl = `${surveyUrl}?ref=${participant.id}`;
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "InsightForge <surveys@insightforge.io>",
              to: [participant.email],
              subject: `You're invited: ${survey.title}`,
              html: `
                <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 16px;">
                  <h2 style="color: #1a1a2e;">You've been invited to a survey</h2>
                  <p style="color: #555; line-height: 1.6;">
                    Hi ${participant.name || "there"},<br/><br/>
                    You've been invited to participate in <strong>${survey.title}</strong>.
                    Your feedback is valuable and will help improve our understanding.
                  </p>
                  <a href="${personalizedUrl}" 
                     style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; 
                            border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">
                    Take the Survey →
                  </a>
                  <p style="color: #999; font-size: 12px; margin-top: 32px;">
                    This survey was sent via InsightForge. If you believe this was sent in error, you can ignore this email.
                  </p>
                </div>
              `,
            }),
          });
        } catch (emailErr) {
          console.error(`Email send failed for ${participant.email}:`, emailErr);
        }
      }
    }

    return jsonResponse(req, {
      success: true,
      survey_url: surveyUrl,
      sent_count: sent.length,
      skipped_no_email: withoutEmail.map((p) => ({ id: p.id, name: p.name })),
      failed_count: failed.length,
      email_enabled: !!resendKey,
    });
  } catch (err) {
    console.error("distribute-survey error:", err);
    return jsonResponse(req, { error: (err instanceof Error ? err.message : "Internal error") }, 500);
  }
});
