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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }
    const callerId = claimsData.claims.sub as string;

    const { workspace_id } = await req.json();
    if (!workspace_id) {
      return new Response(JSON.stringify({ error: "Missing workspace_id" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller is a member of this workspace
    const { data: callerMembership } = await adminClient
      .from("workspace_memberships")
      .select("role")
      .eq("workspace_id", workspace_id)
      .eq("user_id", callerId)
      .single();

    if (!callerMembership) {
      return new Response(JSON.stringify({ error: "Not a member of this workspace" }), {
        status: 403,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Get all memberships
    const { data: memberships, error: membershipsError } = await adminClient
      .from("workspace_memberships")
      .select("id, user_id, role, created_at, profiles(full_name, avatar_url)")
      .eq("workspace_id", workspace_id);

    if (membershipsError) {
      return new Response(JSON.stringify({ error: membershipsError.message }), {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Get emails for all member user_ids using admin API
    const userIds = (memberships || []).map((m: any) => m.user_id);
    const emailMap: Record<string, string> = {};

    // Fetch users individually by ID (no listUsers bulk call)
    for (const uid of userIds) {
      const { data: userData } = await adminClient.auth.admin.getUserById(uid);
      if (userData?.user?.email) {
        emailMap[uid] = userData.user.email;
      }
    }

    // Count owners for last-owner detection
    const ownerCount = (memberships || []).filter((m: any) => m.role === "owner").length;

    const members = (memberships || []).map((m: any) => ({
      id: m.id,
      user_id: m.user_id,
      role: m.role,
      full_name: m.profiles?.full_name || null,
      email: emailMap[m.user_id] || "",
      avatar_url: m.profiles?.avatar_url || null,
      is_last_owner: m.role === "owner" && ownerCount === 1,
    }));

    return new Response(JSON.stringify({ members }), {
      status: 200,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
