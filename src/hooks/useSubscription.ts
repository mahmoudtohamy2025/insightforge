import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { getTierFromProductId } from "@/lib/tierLimits";

interface SubscriptionState {
  subscribed: boolean;
  productId: string | null;
  tier: string;
  subscriptionEnd: string | null;
  isLoading: boolean;
}

/**
 * Determines the effective tier for the current workspace.
 *
 * Priority order:
 *   1. Workspace `tier` column (set via Super Admin "Change Tier")
 *   2. Backend-resolved tier from Stripe subscription (`check-subscription` edge function)
 *   3. Frontend fallback mapping from Stripe product_id
 *   4. Default: "free"
 *
 * This ensures that both admin-overridden tiers AND Stripe-managed tiers work.
 */
export function useSubscription() {
  const { session } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [state, setState] = useState<SubscriptionState>({
    subscribed: false,
    productId: null,
    tier: "free",
    subscriptionEnd: null,
    isLoading: true,
  });

  const checkSubscription = useCallback(async () => {
    if (!session) {
      setState((s) => ({ ...s, isLoading: false }));
      return;
    }

    // 1. Check workspace's own tier column (set by Super Admin)
    const workspaceTier = currentWorkspace?.tier;
    if (workspaceTier && workspaceTier !== "free") {
      // Workspace has an admin-assigned tier — use it directly
      setState({
        subscribed: true,
        productId: null,
        tier: workspaceTier,
        subscriptionEnd: null,
        isLoading: false,
      });
      return;
    }

    // 2. Fall back to Stripe subscription check
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) throw error;

      // Use backend-resolved tier (has full mapping including enterprise).
      // Fall back to local mapping, then to "free".
      const stripeTier =
        data?.tier ||
        (data?.product_id ? getTierFromProductId(data.product_id) : null) ||
        (data?.subscribed ? "starter" : "free");

      setState({
        subscribed: data?.subscribed || false,
        productId: data?.product_id || null,
        tier: stripeTier,
        subscriptionEnd: data?.subscription_end || null,
        isLoading: false,
      });
    } catch (err) {
      console.error("Failed to check subscription:", err);
      setState((s) => ({ ...s, tier: workspaceTier || "free", isLoading: false }));
    }
  }, [session, currentWorkspace?.tier]);

  useEffect(() => {
    checkSubscription();

    // P0.2 — Replace 60-second polling with a Supabase Realtime listener on the
    // workspaces row. The Stripe webhook (supabase/functions/stripe-webhook)
    // updates workspaces.tier whenever a subscription changes. We subscribe to
    // UPDATE events on the current workspace row and re-run checkSubscription
    // only when the row actually changes.
    //
    // Before: 100 users × 3 tabs × every 60s = 300 invokes/min from idle alone.
    //         Each invoke fanned out to a Stripe API call inside the check-
    //         subscription edge function. Stripe rate-limit-bomb at any scale.
    // After:  zero invokes from idle; the hook re-runs only on legitimate
    //         tier-change events pushed by Postgres → Realtime.
    if (!currentWorkspace?.id) return;

    const channel = supabase
      .channel(`workspace-tier:${currentWorkspace.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "workspaces",
          filter: `id=eq.${currentWorkspace.id}`,
        },
        () => {
          checkSubscription();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [checkSubscription, currentWorkspace?.id]);

  return { ...state, refetch: checkSubscription };
}
