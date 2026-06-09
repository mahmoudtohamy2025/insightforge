/**
 * Fail-CLOSED preflight for `npm run dev:test` (the e2e test server).
 *
 * The Playwright specs in e2e/ sign up REAL users. They must run against a LOCAL
 * `supabase start` stack, never PROD. The app is pointed at local Supabase by
 * `.env.test` (gitignored). If `.env.test` is absent — e.g. on a fresh clone —
 * `vite --mode test` silently falls back to `.env`, whose VITE_SUPABASE_URL is
 * the PRODUCTION project, and the suite would sign up real users on prod.
 *
 * This script aborts (exit 1) unless VITE_SUPABASE_URL — resolved exactly the way
 * `vite --mode test` resolves env (.env -> .env.local -> .env.test ->
 * .env.test.local) — points at localhost. Wired as the first half of `dev:test`.
 *
 * Usage (via package.json): "dev:test": "node scripts/assert-local-test-env.mjs && vite --mode test"
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv } from 'vite';

const MODE = 'test';
const ROOT = process.cwd();

/** Abort with a readable, actionable message. */
function die(detail) {
  console.error('\n\x1b[31m✖ [dev:test] refusing to start — e2e safety preflight failed\x1b[0m\n');
  console.error(detail.trim() + '\n');
  console.error('Why: the e2e specs sign up REAL users. Running them against PROD');
  console.error('Supabase would pollute production. See e2e/README.md.\n');
  process.exit(1);
}

// 1. .env.test must exist (clear, specific message when it doesn't).
if (!existsSync(join(ROOT, '.env.test'))) {
  die(
    'No .env.test found. Create it from the committed template:\n\n' +
    '  cp .env.test.example .env.test\n' +
    '  supabase status      # paste the local "Publishable" key into .env.test\n\n' +
    'Then re-run `npm run test:e2e`.'
  );
}

// 2. The EFFECTIVE VITE_SUPABASE_URL (vite's own resolution) must be local.
//    This also catches a .env.test that exists but doesn't override the URL,
//    or a stray .env.test.local pointing at prod.
const env = loadEnv(MODE, ROOT, 'VITE_');
const url = (env.VITE_SUPABASE_URL || '').trim();

const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?(\/.*)?$/i.test(url);

if (!isLocal) {
  die(
    `VITE_SUPABASE_URL resolves to:\n\n  ${url || '(empty)'}\n\n` +
    'That is not a local URL. .env.test must set VITE_SUPABASE_URL to your local\n' +
    'Supabase stack (e.g. http://127.0.0.1:54321) so e2e signups never hit PROD.\n' +
    'See .env.test.example and e2e/README.md.'
  );
}

console.log(`\x1b[32m✓ [dev:test] VITE_SUPABASE_URL is local (${url}) — safe to run e2e.\x1b[0m`);
