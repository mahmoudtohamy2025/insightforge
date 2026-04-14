/**
 * InsightForge — Create Super Admin User
 * 
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" node scripts/create-super-admin.mjs
 *
 * What this does:
 *   1. Creates auth user: mahmoudtohamy94@gmail.com / Test@2026
 *   2. Creates a "Super Admin" workspace owned by this user
 *   3. Sets the membership role to "owner"
 *   4. Confirms email so no activation step needed
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://pjscposcnznrabswauuw.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error("❌  Missing SUPABASE_SERVICE_ROLE_KEY environment variable.");
  console.error("    Run: SUPABASE_SERVICE_ROLE_KEY=\"your-key\" node scripts/create-super-admin.mjs");
  process.exit(1);
}

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const ADMIN_EMAIL    = "mahmoudtohamy94@gmail.com";
const ADMIN_PASSWORD = "Test@2026";
const WORKSPACE_NAME = "InsightForge Super Admin";
const WORKSPACE_SLUG = "insightforge-superadmin";

async function main() {
  console.log(`\n🛠  Creating super admin user: ${ADMIN_EMAIL}\n`);

  // ── Step 1: Create Auth User ──────────────────────────────────────────────
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,   // skip email verification
    user_metadata: { full_name: "Mahmoud (Super Admin)" }
  });

  if (authError) {
    // If user already exists, try to look them up instead
    if (authError.message?.includes("already been registered") || authError.code === "email_exists") {
      console.warn("⚠️  User already exists — attempting to look up existing user...");
      const { data: listData, error: listError } = await adminClient.auth.admin.listUsers();
      if (listError) throw listError;
      const existing = listData.users.find(u => u.email === ADMIN_EMAIL);
      if (!existing) throw new Error("Could not find existing user.");
      return await setupWorkspace(existing.id);
    }
    throw authError;
  }

  const userId = authData.user.id;
  console.log(`✅  Auth user created!`);
  console.log(`    User ID : ${userId}`);
  console.log(`    Email   : ${authData.user.email}`);

  // ── Step 2: Create Profile Row (if not auto-created by trigger) ─────────
  const { error: profileError } = await adminClient
    .from("profiles")
    .upsert({ id: userId, full_name: "Mahmoud (Super Admin)", email: ADMIN_EMAIL }, { onConflict: "id" });

  if (profileError) {
    console.warn("⚠️  Profile upsert warning (may already exist):", profileError.message);
  } else {
    console.log(`✅  Profile row created/updated.`);
  }

  await setupWorkspace(userId);
}

async function setupWorkspace(userId) {
  // ── Step 3: Check for existing workspace ─────────────────────────────────
  const { data: existingWs } = await adminClient
    .from("workspaces")
    .select("id")
    .eq("slug", WORKSPACE_SLUG)
    .single();

  let workspaceId;

  if (existingWs) {
    workspaceId = existingWs.id;
    console.log(`ℹ️  Workspace already exists: ${workspaceId}`);
  } else {
    // ── Step 4: Create Workspace ─────────────────────────────────────────────
    const { data: wsData, error: wsError } = await adminClient
      .from("workspaces")
      .insert({
        name: WORKSPACE_NAME,
        slug: WORKSPACE_SLUG,
        owner_id: userId,
        plan: "enterprise",
      })
      .select("id")
      .single();

    if (wsError) throw wsError;
    workspaceId = wsData.id;
    console.log(`✅  Workspace created!`);
    console.log(`    Workspace ID : ${workspaceId}`);
    console.log(`    Plan         : enterprise`);
  }

  // ── Step 5: Upsert Membership as Owner ───────────────────────────────────
  const { error: memberError } = await adminClient
    .from("workspace_memberships")
    .upsert({ workspace_id: workspaceId, user_id: userId, role: "owner" }, { onConflict: "workspace_id,user_id" });

  if (memberError) throw memberError;
  console.log(`✅  Membership set to: owner`);

  // ── Done ──────────────────────────────────────────────────────────────────
  console.log(`\n🎉  Super admin setup complete!\n`);
  console.log(`    Login URL : https://pjscposcnznrabswauuw.supabase.co (or your app URL)`);
  console.log(`    Email     : ${ADMIN_EMAIL}`);
  console.log(`    Password  : Test@2026`);
  console.log(`    Role      : owner (enterprise plan)\n`);
}

main().catch(err => {
  console.error("\n❌  Error:", err.message || err);
  process.exit(1);
});
