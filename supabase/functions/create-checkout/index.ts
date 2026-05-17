import Stripe from "https://esm.sh/stripe@18.5.0";
import { handleCors, getCorsHeaders } from "../_shared/cors.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const STRIPE_PRODUCT_TIER: Record<string, string> = {
  "prod_starter_plan": "starter",
  "prod_professional_plan": "professional",
  "prod_enterprise_plan": "enterprise",
  "prod_U77vT9icIzokqy": "starter",
  "prod_U77wrd6NNDHYW2": "professional",
};

const TIER_RANK: Record<string, number> = {
  free: 0,
  starter: 1,
  professional: 2,
  enterprise: 3,
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { email: user.email });

    const { price_id, workspace_id } = await req.json();
    if (!price_id) throw new Error("price_id is required");
    logStep("Request params", { price_id, workspace_id });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Look up or create Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    }

    const origin = req.headers.get("origin") || "http://localhost:5173";

    if (customerId) {
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 10,
      });

      const activeSubscription = subscriptions.data
        .filter((subscription) => ["active", "trialing", "past_due", "unpaid"].includes(subscription.status))
        .sort((left, right) => {
          const leftProductId = left.items.data[0]?.price?.product as string | undefined;
          const rightProductId = right.items.data[0]?.price?.product as string | undefined;
          const leftTier = (leftProductId && STRIPE_PRODUCT_TIER[leftProductId]) || "free";
          const rightTier = (rightProductId && STRIPE_PRODUCT_TIER[rightProductId]) || "free";

          if (TIER_RANK[rightTier] !== TIER_RANK[leftTier]) {
            return TIER_RANK[rightTier] - TIER_RANK[leftTier];
          }

          return right.created - left.created;
        })[0];

      if (activeSubscription) {
        const portalSession = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: `${origin}/settings?tab=billing`,
        });

        logStep("Existing subscription found, redirecting to portal", {
          customerId,
          subscriptionId: activeSubscription.id,
        });

        return new Response(JSON.stringify({
          url: portalSession.url,
          already_subscribed: true,
          subscription_id: activeSubscription.id,
        }), {
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: price_id, quantity: 1 }],
      mode: "subscription",
      success_url: `${origin}/settings?tab=billing&checkout=success`,
      cancel_url: `${origin}/settings?tab=billing&checkout=cancelled`,
      client_reference_id: workspace_id || undefined,
      metadata: { workspace_id: workspace_id || "" },
    });

    logStep("Checkout session created", { sessionId: session.id });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      status: 500,
    });
  }
});
