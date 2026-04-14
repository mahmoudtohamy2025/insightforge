import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getTierFromProductId } from "@/lib/tierLimits";

interface SubscriptionState {
  subscribed: boolean;
  productId: string | null;
  tier: string;
  subscriptionEnd: string | null;
  isLoading: boolean;
}

export function useSubscription() {
  const { session } = useAuth();
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

    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) throw error;

      // Use backend-resolved tier (has full mapping including enterprise).
      // Fall back to local mapping, then to "free".
      const tier =
        data?.tier ||
        (data?.product_id ? getTierFromProductId(data.product_id) : null) ||
        (data?.subscribed ? "starter" : "free");

      setState({
        subscribed: data?.subscribed || false,
        productId: data?.product_id || null,
        tier,
        subscriptionEnd: data?.subscription_end || null,
        isLoading: false,
      });
    } catch (err) {
      console.error("Failed to check subscription:", err);
      setState((s) => ({ ...s, isLoading: false }));
    }
  }, [session]);

  useEffect(() => {
    checkSubscription();
    const interval = setInterval(checkSubscription, 60000);
    return () => clearInterval(interval);
  }, [checkSubscription]);

  return { ...state, refetch: checkSubscription };
}

