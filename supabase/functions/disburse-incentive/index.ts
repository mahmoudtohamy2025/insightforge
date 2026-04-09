import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, getCorsHeaders } from "../_shared/cors.ts";
import { requireWorkspaceMember } from "../_shared/validation.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Use service role for writing disbursements
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const {
      program_id,
      workspace_id,
      participant_id,
      amount_cents,
      currency = "USD",
      reason = "session_completion",
      linked_session_id,
      linked_survey_id,
      delivery_method = "email",
      recipient_email,
      recipient_phone,
    } = body;

    if (!program_id || !workspace_id || !participant_id || !amount_cents) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const membershipError = await requireWorkspaceMember(supabaseUser, claimsData.claims.sub, workspace_id);
    if (membershipError) return membershipError;

    // Verify program exists and has budget
    const { data: program, error: progError } = await supabaseAdmin
      .from("incentive_programs")
      .select("*")
      .eq("id", program_id)
      .eq("workspace_id", workspace_id)
      .single();

    if (progError || !program) {
      return new Response(JSON.stringify({ error: "Program not found" }), {
        status: 404,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    if (["exhausted", "closed", "paused"].includes(program.status)) {
      return new Response(JSON.stringify({ error: `Program is ${program.status}` }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const remaining = program.total_budget_cents - program.spent_cents;
    if (amount_cents > remaining) {
      return new Response(JSON.stringify({ error: "Insufficient budget", remaining_cents: remaining }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Determine if approval is required
    const requiresApproval = program.approval_threshold_cents > 0 && amount_cents >= program.approval_threshold_cents;
    const initialStatus = requiresApproval ? "awaiting_approval" : "pending";

    // Create disbursement record
    const { data: disbursement, error: disError } = await supabaseAdmin
      .from("incentive_disbursements")
      .insert({
        program_id,
        workspace_id,
        participant_id,
        amount_cents,
        currency,
        reason,
        linked_session_id: linked_session_id || null,
        linked_survey_id: linked_survey_id || null,
        delivery_method,
        recipient_email: recipient_email || null,
        recipient_phone: recipient_phone || null,
        status: initialStatus,
        created_by: claimsData.claims.sub,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days expiry
      })
      .select()
      .single();

    if (disError) throw disError;

    // If not requiring approval, attempt to process via provider
    if (!requiresApproval && program.provider && program.provider !== "manual") {
      // Attempt provider-specific disbursement
      let providerResult: Record<string, unknown> = {};
      let newStatus = "processing";

      try {
        if (program.provider === "tremendous") {
          const tremendousApiKey = (program.provider_config as Record<string, string>)?.api_key
            || Deno.env.get("TREMENDOUS_API_KEY");
          if (tremendousApiKey && recipient_email) {
            const tremendousResp = await fetch("https://testflight.tremendous.com/api/v2/orders", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${tremendousApiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                payment: { funding_source_id: "BALANCE" },
                rewards: [{
                  value: { denomination: amount_cents / 100, currency_code: currency },
                  recipient: { email: recipient_email },
                  delivery: { method: "EMAIL" },
                  products: [(program.provider_config as Record<string, string>)?.catalog_id || "GIFT_CARD_CATALOG"],
                }],
              }),
            });
            const tremendousData = await tremendousResp.json();
            providerResult = tremendousData;
            if (tremendousResp.ok) newStatus = "sent";
          }
        }
      } catch (providerErr) {
        // Log provider error but don't fail - disbursement record is saved
        console.error("Provider error:", providerErr);
      }

      // Update disbursement with provider response
      await supabaseAdmin
        .from("incentive_disbursements")
        .update({
          status: newStatus,
          provider_response: providerResult,
          sent_at: newStatus === "sent" ? new Date().toISOString() : null,
        })
        .eq("id", disbursement.id);

      // Log to audit log
      await supabaseAdmin.from("audit_logs").insert({
        workspace_id,
        user_id: claimsData.claims.sub,
        action: "incentive_disbursed",
        resource_type: "incentive_disbursement",
        resource_id: disbursement.id,
        details: { amount_cents, currency, participant_id, status: newStatus },
      });

      return new Response(JSON.stringify({ ...disbursement, status: newStatus }), {
        status: 200,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Manual provider or awaiting approval
    await supabaseAdmin.from("audit_logs").insert({
      workspace_id,
      user_id: claimsData.claims.sub,
      action: "incentive_created",
      resource_type: "incentive_disbursement",
      resource_id: disbursement.id,
      details: { amount_cents, currency, participant_id, status: initialStatus },
    });

    return new Response(JSON.stringify(disbursement), {
      status: 200,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
