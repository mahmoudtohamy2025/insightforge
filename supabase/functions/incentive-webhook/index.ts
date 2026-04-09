import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, getCorsHeaders } from "../_shared/cors.ts";

// Handles provider callbacks (Tremendous, Runa) when incentives are claimed or expire
Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const provider = req.headers.get("X-Provider") || "unknown";

    // Tremendous webhook format
    if (provider === "tremendous") {
      const { event, data } = body;
      const orderId = data?.id || data?.order_id;
      const rewardId = data?.reward?.id;

      if (!orderId && !rewardId) {
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      // Find disbursement by provider_reference
      const { data: disbursement } = await supabase
        .from("incentive_disbursements")
        .select("id, program_id, amount_cents")
        .or(`provider_reference.eq.${orderId},provider_reference.eq.${rewardId}`)
        .single();

      if (disbursement) {
        let newStatus: string | null = null;
        let claimedAt: string | null = null;

        if (event === "REWARD.DELIVERED" || event === "ORDER.COMPLETED") {
          newStatus = "sent";
        } else if (event === "REWARD.CLAIMED") {
          newStatus = "claimed";
          claimedAt = new Date().toISOString();
        } else if (event === "REWARD.EXPIRED") {
          newStatus = "expired";
        }

        if (newStatus) {
          await supabase
            .from("incentive_disbursements")
            .update({
              status: newStatus,
              claimed_at: claimedAt,
              provider_response: body,
            })
            .eq("id", disbursement.id);
        }
      }
    }

    // Runa webhook format
    if (provider === "runa") {
      const { type, payload } = body;
      const externalRef = payload?.external_reference;

      if (externalRef) {
        const { data: disbursement } = await supabase
          .from("incentive_disbursements")
          .select("id")
          .eq("provider_reference", externalRef)
          .single();

        if (disbursement) {
          let newStatus: string | null = null;
          if (type === "reward.redeemed") newStatus = "claimed";
          if (type === "reward.expired") newStatus = "expired";

          if (newStatus) {
            await supabase
              .from("incentive_disbursements")
              .update({ status: newStatus, claimed_at: newStatus === "claimed" ? new Date().toISOString() : null })
              .eq("id", disbursement.id);
          }
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Webhook processing error";
    console.error("Incentive webhook error:", message);
    // Always return 200 to acknowledge receipt
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
