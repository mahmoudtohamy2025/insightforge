/**
 * InsightForge — Finalize Super Admin Setup
 *
 * The auth user was already created:
 *   User ID : d7466901-d2d8-4198-bc05-90a161a8599d
 *   Email   : mahmoudtohamy94@gmail.com
 *
 * The handle_new_user() trigger auto-created a workspace + owner membership.
 * This script:
 *   1. Confirms the workspace exists and prints its ID
 *   2. Ensures the membership role is "owner"
 *   3. Upgrades workspace tier to "enterprise"
 *   4. Updates the profile full_name
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY="your-key" node scripts/finalize-super-admin.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL       = "https://pjscposcnznrabswauuw.supabase.co";
const SERVICE_ROLE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;
const USER_ID            = "d7466901-d2d8-4198-bc05-90a161a8599d";

if (!SERVICE_ROLE_KEY) {
  console.error("❌  Missing SUPABASE_SERVICE_ROLE_KEY");
  console.error("    Run: SUPABASE_SERVICE_ROLE_KEY=\"your-key\" node scripts/finalize-super-admin.mjs");
  process.exit(1);
}

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  console.log(`\n🛠  Finalizing super admin for user: ${USER_ID}\n`);

  // ── 1. Find the workspace auto-created by the trigger ────────────────────
  const { data: membership, error: memErr } = await adminClient
    .from("workspace_memberships")
    .select("workspace_id, role")
    .eq("user_id", USER_ID)
    .single();

  if (memErr || !membership) {
    console.error("❌  Could not find workspace membership:", memErr?.message);
    process.exit(1);
  }

  const workspaceId = membership.workspace_id;
  console.log(`✅  Found workspace: ${workspaceId}`);
  console.log(`    Current role   : ${membership.role}`);

  // ── 2. Ensure role is "owner" ────────────────────────────────────────────
  if (membership.role !== "owner") {
    const { error: roleErr } = await adminClient
      .from("workspace_memberships")
      .update({ role: "owner" })
      .eq("user_id", USER_ID)
      .eq("workspace_id", workspaceId);

    if (roleErr) throw roleErr;
    console.log(`✅  Role upgraded to: owner`);
  } else {
    console.log(`✅  Role already: owner`);
  }

  // ── 3. Upgrade workspace tier to enterprise ──────────────────────────────
  const { error: tierErr } = await adminClient
    .from("workspaces")
    .update({ tier: "enterprise", updated_at: new Date().toISOString() })
    .eq("id", workspaceId);

  if (tierErr) throw tierErr;
  console.log(`✅  Workspace tier set to: enterprise`);

  // ── 4. Update profile name ───────────────────────────────────────────────
  const { error: profileErr } = await adminClient
    .from("profiles")
    .update({ full_name: "Mahmoud (Super Admin)" })
    .eq("id", USER_ID);

  if (profileErr) {
    console.warn("⚠️  Profile update warning:", profileErr.message);
  } else {
    console.log(`✅  Profile name updated`);
  }

  // ── Done ─────────────────────────────────────────────────────────────────
  console.log(`\n🎉  Super admin setup complete!\n`);
  console.log(`    Email      : mahmoudtohamy94@gmail.com`);
  console.log(`    Password   : Test@2026`);
  console.log(`    User ID    : ${USER_ID}`);
  console.log(`    Workspace  : ${workspaceId}`);
  console.log(`    Role       : owner`);
  console.log(`    Tier       : enterprise\n`);
}

main().catch(err => {
  console.error("\n❌  Error:", err.message || err);
  process.exit(1);
});
