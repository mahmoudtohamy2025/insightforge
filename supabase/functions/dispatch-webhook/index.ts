import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { workspace_id, event_type, payload } = await req.json();

    if (!workspace_id || !event_type) {
      return new Response(
        JSON.stringify({ error: "workspace_id and event_type required" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Get active webhooks for this workspace that subscribe to this event
    const { data: webhooks, error: whError } = await supabase
      .from("webhooks")
      .select("id, url, secret_hash, events")
      .eq("workspace_id", workspace_id)
      .eq("status", "active");

    if (whError) throw whError;

    const matching = (webhooks || []).filter(
      (wh: any) => wh.events.length === 0 || wh.events.includes(event_type)
    );

    const results = [];

    for (const wh of matching) {
      const body = JSON.stringify({
        event: event_type,
        workspace_id,
        payload: payload || {},
        timestamp: new Date().toISOString(),
      });

      // HMAC-SHA256 signature
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(wh.secret_hash),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
      const signature = Array.from(new Uint8Array(signatureBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      let responseStatus = 0;
      let responseBody = "";
      let success = false;

      try {
        const resp = await fetch(wh.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-InsightForge-Signature": `sha256=${signature}`,
            "X-InsightForge-Event": event_type,
          },
          body,
        });
        responseStatus = resp.status;
        responseBody = await resp.text().catch(() => "");
        success = resp.ok;
      } catch (fetchErr: any) {
        responseBody = fetchErr.message || "Network error";
      }

      // Log delivery
      await supabase.from("webhook_deliveries").insert({
        webhook_id: wh.id,
        event_type,
        payload: payload || {},
        response_status: responseStatus,
        response_body: responseBody.slice(0, 2000),
        success,
      });

      results.push({ webhook_id: wh.id, success, status: responseStatus });
    }

    return new Response(
      JSON.stringify({ dispatched: results.length, results }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("dispatch-webhook error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
