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

    const url = new URL(req.url);
    const workspace_id = url.searchParams.get("workspace_id");
    const program_id = url.searchParams.get("program_id");
    const format = url.searchParams.get("format") || "csv";
    const start_date = url.searchParams.get("start_date");
    const end_date = url.searchParams.get("end_date");

    if (!workspace_id) {
      return new Response(JSON.stringify({ error: "Missing workspace_id" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const membershipError = await requireWorkspaceMember(supabase, claimsData.claims.sub, workspace_id);
    if (membershipError) return membershipError;

    let query = supabase
      .from("incentive_disbursements")
      .select("*, participants(full_name, email), incentive_programs(name, currency)")
      .eq("workspace_id", workspace_id)
      .order("created_at", { ascending: false });

    if (program_id) query = query.eq("program_id", program_id);
    if (start_date) query = query.gte("created_at", start_date);
    if (end_date) query = query.lte("created_at", end_date);

    const { data: disbursements, error } = await query;
    if (error) throw error;

    if (format === "csv") {
      const headers = [
        "ID", "Participant Name", "Participant Email", "Program",
        "Amount", "Currency", "Status", "Reason",
        "Delivery Method", "Sent At", "Claimed At", "Created At"
      ];

      const rows = (disbursements || []).map((d: Record<string, any>) => [
        d.id,
        d.participants?.full_name || "",
        d.participants?.email || d.recipient_email || "",
        d.incentive_programs?.name || "",
        (d.amount_cents / 100).toFixed(2),
        d.currency,
        d.status,
        d.reason,
        d.delivery_method,
        d.sent_at ? new Date(d.sent_at).toISOString() : "",
        d.claimed_at ? new Date(d.claimed_at).toISOString() : "",
        new Date(d.created_at).toISOString(),
      ]);

      const csvContent = [headers, ...rows]
        .map((row) => row.map((cell: unknown) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");

      return new Response(csvContent, {
        status: 200,
        headers: {
          ...getCorsHeaders(req),
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="incentives-report-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    // JSON format
    return new Response(JSON.stringify({ data: disbursements, count: disbursements?.length || 0 }), {
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
