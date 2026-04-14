import Stripe from "https://esm.sh/stripe@18.5.0";
import { handleCors, getCorsHeaders } from "../_shared/cors.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { requireWorkspaceMember } from "../_shared/validation.ts";

// ── Stripe Product → Tier Map ──
const STRIPE_PRODUCT_TIER: Record<string, string> = {
  "prod_starter_plan": "starter",
  "prod_professional_plan": "professional",
  "prod_enterprise_plan": "enterprise",
  // Real Stripe product IDs
  "prod_U77vT9icIzokqy": "starter",
  "prod_U77wrd6NNDHYW2": "professional",
};

// Allow override via env (e.g. for enterprise custom product IDs)
const envMapping = Deno.env.get("STRIPE_TIER_MAP");
if (envMapping) {
  try {
    const parsed = JSON.parse(envMapping);
    Object.entries(parsed).forEach(([productId, tier]) => {
      STRIPE_PRODUCT_TIER[productId] = tier as string;
    });
  } catch (_) { /* ignore parse errors */ }
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      logStep("No Stripe customer found");
      return new Response(JSON.stringify({ subscribed: false }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    const hasActiveSub = subscriptions.data.length > 0;
    let productId: string | null = null;
    let subscriptionEnd: string | null = null;
    let tier = "free";

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      productId = subscription.items.data[0].price.product as string;
      tier = STRIPE_PRODUCT_TIER[productId] || "free";

      // Fallback: if product ID isn't in our map, check the product name
      if (tier === "free" && productId) {
        try {
          const product = await stripe.products.retrieve(productId);
          const name = (product.name || "").toLowerCase();
          if (name.includes("enterprise")) tier = "enterprise";
          else if (name.includes("professional") || name.includes("pro")) tier = "professional";
          else if (name.includes("starter")) tier = "starter";
          if (tier !== "free") {
            logStep("Resolved tier from product name", { productName: product.name, tier });
          }
        } catch (_) { /* ignore product lookup errors */ }
      }

      logStep("Active subscription found", { productId, tier, subscriptionEnd });
    } else {
      logStep("No active subscription");
    }

    return new Response(
      JSON.stringify({
        subscribed: hasActiveSub,
        product_id: productId,
        tier,
        subscription_end: subscriptionEnd,
      }),
      {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      status: 500,
    });
  }
});
