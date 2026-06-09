# End-to-end tests (Playwright)

These specs run the real app against a **local Supabase stack** — never prod.
They sign up throwaway users via local GoTrue and exercise the UI; the expensive
edge functions (Stripe checkout, the `simulate` AI call, participant/payout
functions) are **mocked** at the network layer with `page.route`, so no Stripe,
Gemini, or Tremendous credentials are needed.

## What a green run proves (and what it does not)

✅ Proves: routing, page rendering, auth signup → workspace/segment creation,
the billing/settings UI, the incentives/payout admin UI, and the participant
portal flow all wire together correctly against a real Postgres + GoTrue.

❌ Does **not** prove: that the real Stripe webhook charges a card, that the real
`simulate` function returns sensible output, or that a real payout sends — those
integrations are mocked. Do a one-time **manual** pass on the real Stripe/payout
paths before charging a live customer.

## Prerequisites

- Docker running (for the local Supabase stack)
- Supabase CLI (`supabase`) and a one-time `npx playwright install chromium`

## Run

```bash
# 1. Boot the local stack (applies supabase/migrations/* to a fresh local DB)
supabase start

# 2. One-time: create .env.test from the template, then paste the local
#    "Publishable" key from `supabase status` into VITE_SUPABASE_PUBLISHABLE_KEY
cp .env.test.example .env.test
supabase status        # copy the Publishable key into .env.test

# 3. Run the suite. Playwright's webServer boots `npm run dev:test`
#    (vite --mode test → reads .env.test → points at the local stack on :8080).
npm run test:e2e
```

The `webServer` block in `playwright.config.ts` uses `reuseExistingServer: false`
on purpose: it always starts its own `--mode test` server rather than risk
reusing a stray prod-pointed `npm run dev` on :8080 (which would sign up users on
prod). Make sure nothing else is bound to :8080 before running.

## Notes

- Email confirmation is off on the local stack (Supabase CLI default), so signup
  returns a session immediately and the app redirects to `/dashboard`.
- Per-page product tours (`tour_completed_<id>` in localStorage) and the first-sim
  wizard (`has_seen_first_sim`) are pre-dismissed in the specs' `addInitScript`.
- To reset local DB state between debugging runs: `supabase db reset`.
