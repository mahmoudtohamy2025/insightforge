import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Map stripe products to our internal tiers
const STRIPE_PRODUCT_TIER: Record<string, string> = {
  "prod_starter_plan": "starter",
  "prod_professional_plan": "professional",
  "prod_enterprise_plan": "enterprise",
};

// Allow override via env
const envMapping = Deno.env.get("STRIPE_TIER_MAP");
if (envMapping) {
  try {
    const parsed = JSON.parse(envMapping);
    Object.entries(parsed).forEach(([productId, tier]) => {
      STRIPE_PRODUCT_TIER[productId] = tier as string;
    });
  } catch (_) { /* ignore parse errors */ }
}

/**
 * P0.3 — Determine whether signature-bypass is safe to honor in this environment.
 *
 * The bypass is ONLY allowed when the function is running against a local
 * Supabase instance (`supabase start` serves on http://localhost:54321 or
 * http://127.0.0.1:54321). In any other environment — production, preview
 * deploys, staging — the bypass is refused even if BYPASS_STRIPE_SIGNATURE=true
 * is set.
 *
 * Rationale: if the env var ever leaks to a production Supabase project
 * (operator error, copy-paste from a .env.local, accidental promotion of
 * a CI env var), the bypass would let anyone with the webhook URL forge
 * `customer.subscription.updated` events and grant themselves any tier.
 * Requiring an additional non-production signal closes that hole.
 *
 * If you need to E2E-test against a remote/deployed function, do not use
 * this bypass — use Stripe's real test-mode webhooks instead.
 */
function isBypassSafeForThisEnvironment(): boolean {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  return supabaseUrl.includes("//localhost:") || supabaseUrl.includes("//127.0.0.1:");
}

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    console.error("No Stripe signature found");
    return new Response("No Stripe signature found", { status: 400 });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  // P0.3 — Resolve bypass intent ONCE, gated by environment. Both prior call
  // sites (config-error guard + signature-verify branch) now consult this
  // single source of truth so the env var cannot accidentally activate the
  // bypass in production.
  const bypassRequested = Deno.env.get("BYPASS_STRIPE_SIGNATURE") === "true";
  const bypassAllowed = bypassRequested && isBypassSafeForThisEnvironment();

  if (bypassRequested && !bypassAllowed) {
    console.error(
      "[SECURITY] BYPASS_STRIPE_SIGNATURE=true was set, but this environment is not a " +
      "local Supabase instance. Ignoring bypass; real Stripe signature verification will " +
      "be used. If you are running E2E tests, run them against `supabase start` " +
      "(localhost:54321) and not against a deployed function. SUPABASE_URL=" +
      (Deno.env.get("SUPABASE_URL") ?? "<not set>")
    );
  }

  if (!bypassAllowed && (!stripeKey || !webhookSecret)) {
    console.error("Missing Stripe environment variables");
    return new Response("Server configuration error", { status: 500 });
  }

  let stripe: any = null;
  if (!bypassAllowed) {
    stripe = new Stripe(stripeKey!, { apiVersion: "2025-08-27.basil" });
  }

  try {
    const body = await req.text();
    // Verify webhook signature (P0.3: only bypass when bypassAllowed; never re-read the env var here).
    let event;
    if (bypassAllowed) {
      event = JSON.parse(body);
      console.log("⚠️ Bypassing Stripe signature verification (local E2E testing only)");
    } else {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    }
    
    console.log(`Processing Stripe event: ${event.type}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Handle the event
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        
        // Find the product related to this subscription
        const productId = subscription.items.data[0]?.price?.product as string;
        const tier = STRIPE_PRODUCT_TIER[productId] || "free";
        const status = subscription.status;

        console.log(`Updating customer ${customerId} to tier: ${tier}, status: ${status}`);

        // Token limits
        const TOKEN_ALLOCATION: Record<string, number> = {
          starter: 500_000,
          professional: 5_000_000,
          enterprise: 50_000_000, // Effectively unlimited in UI
          free: 0,
        };
        const tokensToAllocate = status === "active" ? (TOKEN_ALLOCATION[tier] || 0) : 0;

        // Fetch workspace to get id
        const { data: wsData } = await supabase
          .from("workspaces")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        // Update the workspace tied to this customer
        const { error } = await supabase
          .from("workspaces")
          .update({ 
            tier: status === "active" ? tier : "free",
            subscription_status: status 
          })
          .eq("stripe_customer_id", customerId);

        if (error) {
          console.error("Error updating workspace tier:", error);
          throw error;
        }

        // Initialize or update token usage record for this period
        if (wsData?.id) {
           const now = new Date();
           const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
           // Attempt to insert the token usage record tracking budget
           await supabase
             .from("workspace_token_usage")
             .upsert({
                workspace_id: wsData.id,
                period_start: periodStart,
             }, { onConflict: "workspace_id, period_start", ignoreDuplicates: true });
        }

        break;
      }
      
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const clientReferenceId = session.client_reference_id; // Usually mapped to workspace ID

        if (clientReferenceId && customerId) {
          console.log(`Mapping workspace ${clientReferenceId} to Stripe customer ${customerId}`);
          const { error } = await supabase
            .from("workspaces")
            .update({ stripe_customer_id: customerId })
            .eq("id", clientReferenceId);
            
          if (error) {
            console.error("Error linking Stripe customer to workspace:", error);
            throw error;
          }
        }
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), { 
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error(`Webhook signature verification or processing failed: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }
});
