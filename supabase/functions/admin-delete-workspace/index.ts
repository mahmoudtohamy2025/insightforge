// A10 — secure super-admin workspace deletion.
//
// verify_jwt=false: authenticates in-code (getUser on the caller's JWT) and gates
// on the super_admins table, then deletes with the service role. Deletes the
// audit-triggering child (workspace_memberships) FIRST — while the workspace row
// still exists, so the membership_removed audit insert succeeds — then deletes the
// workspace, whose ON DELETE CASCADE clears everything else. Robust whether or not
// migration 20260624000001's trigger fix is applied.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse(req, { error: "Unauthorized" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: { user }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !user) return jsonResponse(req, { error: "Unauthorized" }, 401);

    // Super-admin gate.
    const { data: sa } = await admin
      .from("super_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!sa) return jsonResponse(req, { error: "Forbidden — super admin only" }, 403);

    const { workspace_id } = await req.json().catch(() => ({}));
    if (!workspace_id || typeof workspace_id !== "string") {
      return jsonResponse(req, { error: "workspace_id (string) is required" }, 400);
    }

    // Ordered delete (see header). simulations have no delete-trigger so they
    // would cascade fine, but we clear them explicitly too for predictability.
    await admin.from("simulations").delete().eq("workspace_id", workspace_id);
    await admin.from("workspace_memberships").delete().eq("workspace_id", workspace_id);
    const { error: delErr } = await admin.from("workspaces").delete().eq("id", workspace_id);
    if (delErr) return jsonResponse(req, { error: delErr.message }, 500);

    return jsonResponse(req, { success: true, workspace_id });
  } catch (e) {
    return jsonResponse(req, { error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
