# InsightForge

InsightForge is a **hybrid consumer-research platform**. Researchers define **digital consumer twins** — AI personas grounded in demographics, psychographics, behavior, and (optionally) MENA cultural context — and run them through **simulated focus groups, solo interviews, and A/B tests** for directional feedback in minutes. The same workspace then **validates** high-stakes findings with real humans (surveys, recorded sessions, AI theme synthesis) and **calibrates** the twins against those real responses, so confidence compounds over time.

The simulator is the headline; the real-human validation loop is the differentiator. Output is **qualitative signal surfaced with its uncertainty** (confidence, consensus, and per-segment spread) — not survey-grade statistics.

## Stack

- **Frontend:** Vite + React 18 + TypeScript, shadcn-ui (Radix), Tailwind CSS, React Router, TanStack Query — deployed on Vercel.
- **Backend:** Supabase — Postgres with Row-Level Security, GoTrue auth (email/password + Google/GitHub/Twitter), Storage, and Deno **edge functions**.
- **AI:** Google **Gemini 2.5 Flash** (via the OpenAI-compatible endpoint) for all simulations; Deepgram/Whisper for transcription.
- **Billing:** Stripe subscriptions. **Analytics:** PostHog. **Payouts:** Tremendous (sandbox).

## Local development

```bash
npm i            # install dependencies (Node >= 20, npm >= 10)
npm run dev      # start the Vite dev server
npm run test     # run the vitest unit/integration suite
npm run build    # production build
npm run lint     # eslint
```

End-to-end tests run against a **local** Supabase stack (never prod) — see [`e2e/README.md`](e2e/README.md):

```bash
supabase start                 # local Postgres + GoTrue (Docker)
cp .env.test.example .env.test # then paste the local key from `supabase status`
npm run test:e2e               # Playwright; a fail-closed guard refuses non-localhost
```

`npm run sync-types` regenerates `src/integrations/supabase/types.ts` from the live schema.

## Tiers

| | Free $0 | Starter $49/mo | Professional $149/mo | Enterprise |
|---|---|---|---|---|
| AI tokens / month | 50,000 | 500,000 | 2,000,000 | 10,000,000 |
| Twins / segment | 2 | 5 | 8 | 10 |
| Members · Projects | 3 · 2 | 10 · 10 | 25 · 50 | unlimited |

Limits live in `src/lib/tierLimits.ts`, mirrored for the edge layer in `supabase/functions/_shared/tierLimitsData.ts` (a parity test fails the suite if they diverge). The free tier includes a real AI trial — the 50K-token budget is the activation engine.

## Canonical spec

[`docs/PRD.md`](docs/PRD.md) is the canonical product spec — the whole product described as a fully-functioning v1, with every requirement tagged LIVE / NEEDS-BUILD / PARKED / KILLED, plus a prioritized gap-to-v1 backlog. Read it before making non-trivial changes.
