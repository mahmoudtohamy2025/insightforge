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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const { program_id, amount_cents, workspace_id } = await req.json();
    if (!program_id || !workspace_id || amount_cents === undefined) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const membershipError = await requireWorkspaceMember(supabase, claimsData.claims.sub, workspace_id);
    if (membershipError) return membershipError;

    const { data: program, error: progError } = await supabase
      .from("incentive_programs")
      .select("total_budget_cents, spent_cents, status, approval_threshold_cents")
      .eq("id", program_id)
      .eq("workspace_id", workspace_id)
      .single();

    if (progError || !program) {
      return new Response(JSON.stringify({ error: "Program not found" }), {
        status: 404,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    if (program.status === "exhausted" || program.status === "closed" || program.status === "paused") {
      return new Response(JSON.stringify({
        allowed: false,
        reason: `Program is ${program.status}`,
        remaining_cents: program.total_budget_cents - program.spent_cents,
      }), {
        status: 200,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const remaining = program.total_budget_cents - program.spent_cents;
    if (amount_cents > remaining) {
      return new Response(JSON.stringify({
        allowed: false,
        reason: "Insufficient budget",
        remaining_cents: remaining,
        requested_cents: amount_cents,
      }), {
        status: 200,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const requiresApproval = program.approval_threshold_cents > 0 && amount_cents >= program.approval_threshold_cents;

    return new Response(JSON.stringify({
      allowed: true,
      requires_approval: requiresApproval,
      remaining_cents: remaining,
      remaining_after_cents: remaining - amount_cents,
    }), {
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
