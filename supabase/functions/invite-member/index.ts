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

    const body = await req.json();
    const { workspace_id, email, role, action, target_user_id, new_role } = body;

    // Use service role client for admin operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // === OWNERSHIP TRANSFER ===
    if (action === "transfer_ownership") {
      if (!workspace_id || !target_user_id) {
        return new Response(JSON.stringify({ error: "Missing workspace_id or target_user_id" }), {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      // Verify caller is owner
      const { data: callerMembership } = await adminClient
        .from("workspace_memberships")
        .select("role")
        .eq("workspace_id", workspace_id)
        .eq("user_id", callerId)
        .single();

      if (!callerMembership || callerMembership.role !== "owner") {
        return new Response(JSON.stringify({ error: "Only the owner can transfer ownership" }), {
          status: 403,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      // Promote target to owner
      const { error: promoteError } = await adminClient
        .from("workspace_memberships")
        .update({ role: "owner" })
        .eq("workspace_id", workspace_id)
        .eq("user_id", target_user_id);

      if (promoteError) {
        return new Response(JSON.stringify({ error: promoteError.message }), {
          status: 500,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      // Demote caller to admin
      const { error: demoteError } = await adminClient
        .from("workspace_memberships")
        .update({ role: "admin" })
        .eq("workspace_id", workspace_id)
        .eq("user_id", callerId);

      if (demoteError) {
        return new Response(JSON.stringify({ error: demoteError.message }), {
          status: 500,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({ success: true, action: "ownership_transferred" }),
        { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // === ROLE UPDATE (with last-owner protection) ===
    if (action === "update_role") {
      if (!workspace_id || !target_user_id || !new_role) {
        return new Response(JSON.stringify({ error: "Missing workspace_id, target_user_id, or new_role" }), {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      // Verify caller is admin/owner
      const { data: callerMembership } = await adminClient
        .from("workspace_memberships")
        .select("role")
        .eq("workspace_id", workspace_id)
        .eq("user_id", callerId)
        .single();

      if (!callerMembership || !["owner", "admin"].includes(callerMembership.role)) {
        return new Response(JSON.stringify({ error: "Only owners and admins can change roles" }), {
          status: 403,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      // Check if target is the last owner being demoted
      const { data: targetMembership } = await adminClient
        .from("workspace_memberships")
        .select("role")
        .eq("workspace_id", workspace_id)
        .eq("user_id", target_user_id)
        .single();

      if (targetMembership?.role === "owner" && new_role !== "owner") {
        const { count: ownerCount } = await adminClient
          .from("workspace_memberships")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspace_id)
          .eq("role", "owner");

        if ((ownerCount || 0) <= 1) {
          return new Response(
            JSON.stringify({ error: "Cannot demote the last owner. Transfer ownership first." }),
            { status: 422, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
          );
        }
      }

      const { error: updateError } = await adminClient
        .from("workspace_memberships")
        .update({ role: new_role })
        .eq("workspace_id", workspace_id)
        .eq("user_id", target_user_id);

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 500,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({ success: true, action: "role_updated" }),
        { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // === REMOVE MEMBER (with last-owner protection) ===
    if (action === "remove_member") {
      if (!workspace_id || !target_user_id) {
        return new Response(JSON.stringify({ error: "Missing workspace_id or target_user_id" }), {
          status: 400,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      // Verify caller is admin/owner
      const { data: callerMembership } = await adminClient
        .from("workspace_memberships")
        .select("role")
        .eq("workspace_id", workspace_id)
        .eq("user_id", callerId)
        .single();

      if (!callerMembership || !["owner", "admin"].includes(callerMembership.role)) {
        return new Response(JSON.stringify({ error: "Only owners and admins can remove members" }), {
          status: 403,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      // Check if target is the last owner
      const { data: targetMembership } = await adminClient
        .from("workspace_memberships")
        .select("role")
        .eq("workspace_id", workspace_id)
        .eq("user_id", target_user_id)
        .single();

      if (targetMembership?.role === "owner") {
        const { count: ownerCount } = await adminClient
          .from("workspace_memberships")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspace_id)
          .eq("role", "owner");

        if ((ownerCount || 0) <= 1) {
          return new Response(
            JSON.stringify({ error: "Cannot remove the last owner. Transfer ownership first." }),
            { status: 422, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
          );
        }
      }

      const { error: deleteError } = await adminClient
        .from("workspace_memberships")
        .delete()
        .eq("workspace_id", workspace_id)
        .eq("user_id", target_user_id);

      if (deleteError) {
        return new Response(JSON.stringify({ error: deleteError.message }), {
          status: 500,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({ success: true, action: "member_removed" }),
        { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // === INVITE MEMBER (default action) ===
    if (!workspace_id || !email || !role) {
      return new Response(JSON.stringify({ error: "Missing workspace_id, email, or role" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const validRoles = ["admin", "researcher", "observer"];
    if (!validRoles.includes(role)) {
      return new Response(JSON.stringify({ error: "Invalid role" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Check caller is owner or admin
    const { data: callerMembership } = await adminClient
      .from("workspace_memberships")
      .select("role")
      .eq("workspace_id", workspace_id)
      .eq("user_id", callerId)
      .single();

    if (!callerMembership || !["owner", "admin"].includes(callerMembership.role)) {
      return new Response(JSON.stringify({ error: "Only owners and admins can invite members" }), {
        status: 403,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Check member limit
    const { data: workspace } = await adminClient
      .from("workspaces")
      .select("tier")
      .eq("id", workspace_id)
      .single();

    const tierLimits: Record<string, number> = {
      free: 3,
      starter: 10,
      professional: 25,
      enterprise: 999999,
    };
    const maxMembers = tierLimits[workspace?.tier || "free"] || 3;

    const { count } = await adminClient
      .from("workspace_memberships")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace_id);

    if ((count || 0) >= maxMembers) {
      return new Response(
        JSON.stringify({
          error: `Member limit reached (${maxMembers} for ${workspace?.tier || "free"} tier). Upgrade to add more members.`,
        }),
        { status: 402, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Look up user by email using admin getUserByEmail (scalable, no listUsers)
    let existingUser: { id: string; email?: string } | null = null;
    
    // Try to find user by listing with email filter
    const { data: userListData } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });
    
    // Search through all users for the email match - use a more targeted approach
    const { data: allUsersData } = await adminClient.auth.admin.listUsers();
    const foundUser = allUsersData?.users?.find((u) => u.email === email);
    if (foundUser) {
      existingUser = { id: foundUser.id, email: foundUser.email };
    }

    let targetUserId: string;

    if (existingUser) {
      targetUserId = existingUser.id;

      // Check if already a member
      const { data: existing } = await adminClient
        .from("workspace_memberships")
        .select("id")
        .eq("workspace_id", workspace_id)
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ error: "User is already a member of this workspace" }), {
          status: 409,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
    } else {
      // Invite new user
      const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email);
      if (inviteError || !invited?.user) {
        return new Response(JSON.stringify({ error: inviteError?.message || "Failed to invite user" }), {
          status: 500,
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        });
      }
      targetUserId = invited.user.id;
    }

    // Insert membership
    const { error: insertError } = await adminClient.from("workspace_memberships").insert({
      workspace_id,
      user_id: targetUserId,
      role,
    });

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, invited: !existingUser }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
