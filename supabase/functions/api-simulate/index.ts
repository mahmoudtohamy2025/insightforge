import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse } from "../_shared/cors.ts";
import { requireWorkspaceMember } from "../_shared/validation.ts";

/**
 * Unified public API gateway for programmatic simulation access.
 * Authenticates via `X-API-Key` header instead of JWT.
 * Routes to the appropriate simulation engine based on `type` parameter.
 */

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: any) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const apiKey = req.headers.get("X-API-Key") || req.headers.get("x-api-key");
    if (!apiKey) {
      return jsonResponse(req, {
        error: "Missing API key",
        hint: "Include X-API-Key header with your workspace API key",
      }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate API key
    const keyHash = await hashKey(apiKey);
    const keyPrefix = apiKey.substring(0, 8);

    const { data: keyRecord, error: keyError } = await supabase
      .from("workspace_api_keys")
      .select("*")
      .eq("key_hash", keyHash)
      .eq("key_prefix", keyPrefix)
      .eq("is_active", true)
      .single();

    if (keyError || !keyRecord) {
      return jsonResponse(req, { error: "Invalid or expired API key" }, 401);
    }

    // Check expiration
    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      return jsonResponse(req, { error: "API key expired" }, 401);
    }

    // Simple rate limiting: check requests count (resets hourly via cron or approximation)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    if (keyRecord.last_used_at && keyRecord.last_used_at > oneHourAgo && keyRecord.requests_count >= keyRecord.rate_limit) {
      return jsonResponse(req, {
        error: "Rate limit exceeded",
        limit: keyRecord.rate_limit,
        retry_after: "Try again in a few minutes",
      }, 429);
    }

    // Update usage
    const shouldResetCount = !keyRecord.last_used_at || keyRecord.last_used_at < oneHourAgo;
    await supabase.from("workspace_api_keys").update({
      last_used_at: new Date().toISOString(),
      requests_count: shouldResetCount ? 1 : keyRecord.requests_count + 1,
    }).eq("id", keyRecord.id);

    // Parse request body
    const body = await req.json();
    const { type, ...params } = body;

    if (!type) {
      return jsonResponse(req, {
        error: "Missing 'type' parameter",
        valid_types: ["solo", "focus_group", "ab_test", "market_sim", "policy"],
      }, 400);
    }

    // Check scope
    if (!keyRecord.scopes.includes("simulate") && !keyRecord.scopes.includes("*")) {
      return jsonResponse(req, { error: "API key does not have 'simulate' scope" }, 403);
    }

    // Inject workspace_id from the key
    params.workspace_id = keyRecord.workspace_id;

    // Route to appropriate function
    const functionMap: Record<string, string> = {
      solo: "simulate",
      focus_group: "simulate-focus-group",
      ab_test: "simulate-ab-test",
      market_sim: "simulate-market",
      policy: "simulate-policy",
    };

    const targetFunction = functionMap[type];
    if (!targetFunction) {
      return jsonResponse(req, {
        error: `Unknown simulation type: ${type}`,
        valid_types: Object.keys(functionMap),
      }, 400);
    }

    // Call the target Edge Function via Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const internalResponse = await fetch(
      `${supabaseUrl}/functions/v1/${targetFunction}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      }
    );

    const internalData = await internalResponse.json();

    // Wrap in consistent API response format
    if (internalResponse.ok) {
      return jsonResponse(req, {
        data: internalData,
        meta: {
          type,
          api_version: "1.0",
          workspace_id: keyRecord.workspace_id,
          timestamp: new Date().toISOString(),
        },
        errors: null,
      });
    } else {
      return jsonResponse(req, {
        data: null,
        meta: {
          type,
          api_version: "1.0",
          timestamp: new Date().toISOString(),
        },
        errors: [internalData.error || "Simulation failed"],
      }, internalResponse.status);
    }
  } catch (err: any) {
    console.error("API gateway error:", err);
    return jsonResponse(req, {
      data: null,
      meta: { api_version: "1.0" },
      errors: [err.message || "Internal error"],
    }, 500);
  }
});
