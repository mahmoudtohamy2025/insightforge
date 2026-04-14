/**
 * Apply the super_admins migration to production Supabase.
 * 
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY="your-key" node scripts/apply-super-admin-migration.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL     = "https://pjscposcnznrabswauuw.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const USER_ID          = "d7466901-d2d8-4198-bc05-90a161a8599d";

if (!SERVICE_ROLE_KEY) {
  console.error("❌  Missing SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  console.log("🛠  Applying super_admins migration...\n");

  // Step 1: Create the super_admins table via RPC (SQL execution)
  const sql = `
    -- Create super_admins table
    CREATE TABLE IF NOT EXISTS public.super_admins (
      user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

    -- Super admins can read their own row
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'super_admins' AND policyname = 'super_admins_select_own'
      ) THEN
        CREATE POLICY "super_admins_select_own"
          ON public.super_admins FOR SELECT TO authenticated
          USING (user_id = auth.uid());
      END IF;
    END $$;

    -- Helper function
    CREATE OR REPLACE FUNCTION public.is_super_admin(uid UUID)
    RETURNS BOOLEAN
    LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
    AS $fn$
      SELECT EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = uid)
    $fn$;

    -- RLS bypass: super admins can read ALL workspaces
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workspaces' AND policyname = 'super_admin_select_all_workspaces') THEN
        CREATE POLICY "super_admin_select_all_workspaces" ON public.workspaces FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workspaces' AND policyname = 'super_admin_update_all_workspaces') THEN
        CREATE POLICY "super_admin_update_all_workspaces" ON public.workspaces FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid()));
      END IF;
    END $$;

    -- RLS bypass: super admins can read ALL memberships
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'workspace_memberships' AND policyname = 'super_admin_select_all_memberships') THEN
        CREATE POLICY "super_admin_select_all_memberships" ON public.workspace_memberships FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
      END IF;
    END $$;

    -- RLS bypass: super admins can read ALL participants
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'participants' AND policyname = 'super_admin_select_all_participants') THEN
        CREATE POLICY "super_admin_select_all_participants" ON public.participants FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
      END IF;
    END $$;

    -- RLS bypass: super admins can read ALL incentive_programs
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'incentive_programs' AND policyname = 'super_admin_select_all_programs') THEN
        CREATE POLICY "super_admin_select_all_programs" ON public.incentive_programs FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
      END IF;
    END $$;

    -- RLS bypass: super admins can read ALL incentive_disbursements
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'incentive_disbursements' AND policyname = 'super_admin_select_all_disbursements') THEN
        CREATE POLICY "super_admin_select_all_disbursements" ON public.incentive_disbursements FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
      END IF;
    END $$;

    -- RLS bypass: super admins can read ALL profiles
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'super_admin_select_all_profiles') THEN
        CREATE POLICY "super_admin_select_all_profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
      END IF;
    END $$;

    -- Insert the first super admin
    INSERT INTO public.super_admins (user_id)
    VALUES ('${USER_ID}')
    ON CONFLICT (user_id) DO NOTHING;
  `;

  // Use the Supabase management API to run raw SQL
  // The REST API doesn't support DDL, so we use the pg_net / rpc approach
  // Actually, the simplest way is via the Supabase SQL endpoint
  
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({})
  });

  // Since we can't run DDL via REST API, let's try the management API
  // or use the postgres connection string approach.
  // Actually the simplest way: use the Supabase SQL Editor API endpoint
  
  const projectId = "pjscposcnznrabswauuw";
  
  // Try Supabase Management API for SQL execution
  const mgmtResponse = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql })
  });

  if (mgmtResponse.ok) {
    const result = await mgmtResponse.json();
    console.log("✅  Migration applied successfully via Management API!");
    console.log(result);
  } else {
    const errorText = await mgmtResponse.text();
    console.log(`⚠️  Management API returned ${mgmtResponse.status}: ${errorText}`);
    console.log("\n📋  The migration SQL couldn't be applied via script.");
    console.log("    Please apply it manually via the Supabase SQL Editor:");
    console.log(`    → https://supabase.com/dashboard/project/${projectId}/sql/new\n`);
    console.log("    Copy the SQL from: supabase/migrations/20260411_super_admin.sql");
    console.log("    Paste it into the SQL Editor and click 'Run'\n");
  }
}

main().catch(err => {
  console.error("❌  Error:", err.message);
  process.exit(1);
});
