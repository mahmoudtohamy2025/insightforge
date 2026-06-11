// Canonical tier limits for the edge layer — pure data, no imports, so the
// vitest suite can import this file directly.
//
// SOURCE OF TRUTH: src/lib/tierLimits.ts. These numbers must stay identical to
// TIER_LIMITS there and to the DB triggers (check_workspace_member_limit /
// check_workspace_resource_limit in supabase/migrations). Edge functions can't
// import from src/, so the table is mirrored here; src/test/tierParity.test.ts
// fails the suite if the copies diverge. Update all three places together.
//
// -1 = unlimited. aiAnalysis stays true on free (P0.8 — the 50K-token monthly
// trial is the activation engine; the real cap is the rate-limiter's budget).
export const TIER_LIMITS: Record<string, Record<string, number | boolean>> = {
  free:         { members: 3,  sessions: 10,  surveys: 5,   projects: 2,  aiAnalysis: true },
  starter:      { members: 10, sessions: 50,  surveys: 25,  projects: 10, aiAnalysis: true },
  professional: { members: 25, sessions: 200, surveys: 100, projects: 50, aiAnalysis: true },
  enterprise:   { members: -1, sessions: -1,  surveys: -1,  projects: -1, aiAnalysis: true },
};
