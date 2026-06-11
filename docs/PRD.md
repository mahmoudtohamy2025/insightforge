# InsightForge — Product Requirements Document

| | |
|---|---|
| **Version** | 1.0 |
| **Date** | 2026-06-10 |
| **Status** | Canonical internal spec, reverse-engineered from the codebase as-built at commit `5c3efc0` |
| **Audience** | Internal — Mahmoud + future dev/AI sessions. Honest about warts, alphas, and parked features. |
| **Maintenance** | Update when a feature ships or a kill/park decision changes. Strategic decisions live in the vault (`decisions.md`, append-only); this doc describes the product those decisions produced. |

> **How to read this doc.** Sections 1–4 are the product thesis. Section 5 is the feature spec (what's live, where it lives, what its rules are). Sections 6–9 are the system: architecture, data, tiers, security. Sections 10–13 are the honest state: test coverage, parked/killed scope, known issues, metrics. Everything is sourced from code or the decision log — nothing aspirational is presented as built.

---

## 1. Product overview

**Positioning (locked 2026-05-19):**

> "We help solo founders and small product teams test product/pricing/positioning ideas in 5 minutes by asking 50 AI-simulated customers from a target segment, instead of burning $5k and 2 weeks on real research."

**Public one-liner** (`index.html` meta): *"InsightForge — AI-Powered Hybrid Research Platform. Turn research into actionable insights. AI-powered surveys, qualitative sessions, theme extraction, and cross-study synthesis — with built-in MENA cultural awareness."*

InsightForge is a multi-tenant SaaS where users create **digital consumer twins** (AI personas defined by demographics, psychographics, behavior, and cultural context) and run them through **simulated focus groups, solo interviews, and A/B tests** to get directional feedback on product ideas in seconds. A **traditional research suite** (surveys, live sessions with transcription, theme extraction, insight synthesis) exists as the optional second step for validating high-stakes decisions with real humans — that hybrid is the differentiator, with the simulator as the headline.

**The aha moment:** type a question → watch a multi-persona focus group respond in ~30 seconds → see the dominant objection → get three concrete next tests, one click each.

**Stack:** Vite + React + TypeScript SPA (Vercel) · Supabase (Postgres + RLS, GoTrue auth, 47 Deno edge functions) · Gemini 2.5 Flash · Stripe subscriptions · PostHog analytics.

---

## 2. Problem & target user

**Problem.** Real market research costs ~$5k and ~2 weeks per question (recruiting, incentives, moderation, synthesis). Founders either skip it and guess, or burn runway on it. Existing AI-persona tools (Synthetic Users, Aaru, Listen Labs) are one-shot answer machines — they don't tell you *what to test next*, and none have MENA-region cultural depth.

**Primary user — the founder/PM (paying customer).** Solo founder or small product team that knows roughly what to test (pricing, feature, positioning, audience, messaging) and wants fast, cheap, directionally-honest feedback. Self-serve signup, self-serve upgrade.

**Secondary users:**
- **Workspace team members** — invited collaborators with roles (`owner`, `admin`, `researcher`, `observer`).
- **Research participants** — real humans, in two distinct shapes (see §7): a workspace-scoped panel (`participants`) the founder manages, and a platform-wide marketplace identity (`participant_profiles`) with its own portal at `/participate/*`. The marketplace's payout rail is **parked** (sandbox-only).
- **Platform operator (super admin)** — Mahmoud, via `/admin/*` console.

**Launch bar (decided 2026-06-03):** public self-serve, English-only.

---

## 3. Goals & non-goals

### Goals
1. **Activation in minutes:** a brand-new signup can run a real focus group immediately — 3 starter segments are auto-seeded at signup, and `/focus-group` can self-configure from a one-sentence idea.
2. **Iteration, not one-shot answers:** every simulation ends with a result-aware "what to test next" loop (dominant objection → coverage of 5 testing axes → 3 concrete follow-up tests).
3. **Honest output:** confidence scores, consensus scores, and calibration against real responses are first-class. No fabricated demo results in the product (the fake "first simulation" wizard was deleted 2026-06-03).
4. **Self-serve monetization:** free tier with a real AI trial (50K tokens/mo ≈ 3 simulations) → Stripe upgrade to Starter $49 / Professional $149.
5. **MENA-aware simulation as differentiation:** cultural context on every segment, Ramadan mode, Arabic-aware project planning (see §5.4, §5.7).

### Non-goals (decided, do not re-litigate without the decision log)
- **No AI startup-coach / task-recommender surface** — the next-test loop lives inside the studio (2026-05-19).
- **No policy simulator, no custom twin builder, no white-label UI, no integrations tab** — killed 2026-05-19 (PR #22). Vestigial DB tables remain (§12).
- **No standalone market simulator page** — the Bass-diffusion math is embedded in Focus Group results instead.
- **No automated participant payouts at launch** — parked 2026-06-02 pending a real customer asking; first payouts will be manual.
- **No multilingual launch** — English-only (2026-06-08); 4 other locales exist behind a one-line gate.
- **No segment marketplace at launch** — parked; plumbing exists, no UI.

---

## 4. Core user journey (the funnel as instrumented)

1. **Land** on `/` (marketing page: 4-tier pricing, honest "Insights in Minutes" claims) or `/demo` (no-signup interactive demo with 3 hard-coded personas calling `public-demo-simulate`).
2. **Sign up** at `/signup` (email/password + workspace name; OAuth: Google, GitHub, Twitter). → PostHog `signup_completed`.
   - DB trigger `handle_new_user()` creates: profile, workspace (owner membership), and **3 starter segments** — "Budget-Conscious Millennials", "Affluent Early Adopters", "Practical Gen X Parents" (exception-wrapped: seed failure can never block signup).
3. **First-run guidance:** onboarding wizard + checklist on `/dashboard`, per-page product tours (5 tours, localStorage-gated), sample-data CTA.
4. **Run the aha loop** on `/focus-group`:
   - Blank-screen escape hatch: type one idea sentence → "Set up for me" (`seed-from-idea`) pre-picks segments, writes an opinionated stimulus, sets rounds, explains why.
   - Configure: 2–5 segments (≥2 enforced), 1–3 discussion rounds, optional 🌙 Ramadan mode, stimulus text.
   - Run (`simulate-focus-group`) → per-round, per-persona responses (sentiment, confidence traffic light, emotion, themes) + aggregate panel (consensus score, avg sentiment/confidence, top themes) → PostHog `focus_group_run`.
   - **What to test next** (`suggest-next-test`): dominant objection headline (+% of personas affected), explored-axes chips (price / feature / messaging / audience / positioning, each covered/open/untested with evidence), "where you are" meta-banner reasoning over the last 5 simulations, and exactly 3 suggestion cards — click one and it prefills the stimulus.
   - **Market projection:** Bass diffusion curve derived from sentiment × confidence × consensus, with editable market size & horizon. PDF export of the whole result.
5. **Hit the paywall** when the monthly token budget or a tier limit is reached → `TierGate` shows upgrade CTA → PostHog `paywall_viewed`, `upgrade_clicked`.
6. **Upgrade** via Settings → Billing → Stripe Checkout (`create-checkout`) → PostHog `checkout_started`, `checkout_completed`; `stripe-webhook` flips `workspaces.tier`; Stripe customer portal for self-serve management.
7. **(Optional second step) Validate with humans:** surveys with public response links, recorded sessions with auto-transcription and theme extraction, calibration of twins against real responses (§5.7–5.8).

---

## 5. Feature spec (as-built)

Conventions: **State** = Live (shipped & reachable) / Alpha (reachable, bannered as incomplete) / Parked (built or partially built, deliberately not activated) / Killed (removed; do not revive casually).

### 5.1 Auth & onboarding — Live

| Requirement | As-built |
|---|---|
| Self-serve signup | `/signup`: email + password + workspace name. OAuth: Google, GitHub, Twitter (`/auth/callback`). Password reset flow at `/forgot-password` → `/reset-password`. |
| Zero-to-runnable workspace | `handle_new_user()` trigger seeds profile + workspace + owner membership + 3 starter segments. New users can run a focus group with no setup. |
| First-run guidance | OnboardingWizard modal (until `onboarding_completed_at`), dashboard checklist, SampleDataCTA, 5 product tours (twins, simulation, focus group, A/B test, insights) with full-screen spotlight; completion stored per-tour in localStorage. |
| Session continuity | Last-visited path persisted to `profiles.last_visited_path` (2s debounce). |

Key files: `src/pages/SignUp.tsx`, `src/hooks/useAuth.tsx`, migration `20260602` (starter-segment seeding).

### 5.2 Workspaces & team — Live

- Multi-tenant: every domain row carries `workspace_id`; RLS restricts to members (§9).
- Roles: `owner`, `admin`, `researcher`, `observer` (`app_role` enum). Owners/admins manage settings, billing, team, API keys.
- Workspace switcher in sidebar; create additional workspaces; selection persisted in localStorage.
- Team tab: invite by email (`invite-member`), role badges, remove member; seat limits per tier enforced by DB trigger `check_workspace_member_limit()`.
- Settings tabs: Profile · Workspace (name, brand colors) · Team · Billing · Activity log · API & Webhooks (owner/admin) · Referrals (mock invite code — see §12).

Key files: `src/hooks/useWorkspace.tsx`, `src/pages/Settings.tsx`.

### 5.3 Digital twins (segments) — Live

The core asset. A **segment profile** = one synthetic consumer persona:

- **Fields:** name, description, `demographics` (age range, gender, location, income, education, occupation), `psychographics` (values, lifestyle, interests), `behavioral_data`, `cultural_context` (region, language). JSONB columns on `segment_profiles`.
- **Management:** `/segments` (Segment Library) — create via form, edit, delete, "Ask a Question" deep-link into `/simulate?segment=<id>`.
- **Calibration badge** per segment from `calibration_score`: New (<0.3) / Calibrating (0.3–0.6) / Calibrated (≥0.6) — fed by the validation system (§5.8).
- **UI rule:** purple = synthetic, everywhere. Human participants are never purple.
- `model_version` defaults to `gemini-2.5-flash`.

### 5.4 AI Studio — Live (the product core)

| Surface | Route | What it does |
|---|---|---|
| **Solo simulate** | `/simulate`, `/simulate/:id` | One segment × one stimulus → response with sentiment (−1..1), confidence (0..1), purchase intent, emotional reaction, key themes. Result-aware next-test suggestions. Saved simulations reloadable. |
| **Focus group** | `/focus-group` | 2–5 segments × 1–3 rounds. Per-round per-persona responses; aggregate consensus/sentiment/confidence/themes; the full aha loop (§4 step 4); Bass-diffusion market projection; PDF export. **The flagship surface.** |
| **A/B test** | `/ab-test` | Two stimulus variants across selected segments → winner + per-segment scores (`simulate-ab-test`). |
| **Compare** | `/simulations/compare` | Side-by-side comparison of past simulations. |

**Ramadan mode** (focus group): toggle that instructs personas to adopt seasonal consumption/spiritual patterns — concrete MENA differentiation, alongside per-segment `cultural_context` woven into every persona prompt.

**Simulation pipeline contract** (edge): `simulate` / `simulate-focus-group` validate JWT + workspace membership → enforce tier (`aiAnalysis`) and rate limits (fail-closed) → build persona prompts from segment JSONB → call Gemini 2.5 Flash (OpenAI-compatible endpoint, 25s timeout, 1 retry on 429/5xx) → write `simulations` row (type `solo` | `focus_group` | `ab_test`) + one `twin_responses` row per persona per round → record token usage. Focus group aggregates: `consensus_score` (purchase-intent unanimity), `avg_sentiment`, `avg_confidence`, counted `top_themes`.

**Next-test loop contract** (`suggest-next-test`): input = current simulation + up to 5 past ones; output = `dominant_objection {headline, affected_pct}`, exactly 5 `explored_axes` (price/feature/messaging/audience/positioning × covered/open/untested + evidence), `meta_recommendation` (null on first run), exactly 3 `suggestions {headline, rationale, stimulus_template, focus_area}` biased toward unexplored axes. Output is schema-sanitized server-side.

**Seed-from-idea contract** (`seed-from-idea`): input = idea (10–1000 chars); output = 1–3 segment IDs (validated against the workspace — hallucinated IDs rejected), a concrete opinionated stimulus, rounds, rationale.

### 5.5 Market projection — Live (embedded)

Bass diffusion model inside Focus Group results (no standalone page — the standalone Market Simulator was killed):
`sentiment01 = (avg_sentiment+1)/2` → `purchase_prob = sentiment01 × avg_confidence`, `WOM = sentiment01 × consensus` → derive Bass `p`/`q` → adoption curve over user-set market size (default 100k) and horizon (default 24 months). KPIs: peak month, 90% saturation, final penetration. The derivation is shown to the user — no black box.

### 5.6 Traditional research suite — Live

The "hybrid" half: real-human research tooling, organized under Projects.

| Feature | Route | As-built behavior |
|---|---|---|
| **Projects** | `/projects`, `/projects/:id` | Container for surveys/sessions. Quick-create or AI-generated research plan (`generate-project-plan` — returns objective, methodology, discussion guide, screener criteria, timeline; explicitly MENA/Arabic-aware: KSA/Gulf context, gender separation, prayer times). |
| **Surveys** | `/surveys`, `/surveys/:id`, public `/s/:surveyId` | Multi-step builder (text, multiple choice, rating…), public anonymous response link, response/analytics tabs, auto-complete at target via DB trigger. AI question generation (`generate-survey-questions`). |
| **Sessions** | `/sessions`, `/sessions/:id`, `/studio/:id` | Real interview/focus-group sessions: schedule, upload audio/video, auto-transcribe (`transcribe-media`: Deepgram nova-2, Whisper fallback; diarization, language detection), live transcription via Web Speech API in Studio, notes (observation/bookmark/action-item), AI follow-up probes, themes, sentiment summary. Shareable read-only snapshot at `/shared/:token` (token-gated RPC, view-counted). |
| **Insights** | `/insights` | Repository: survey breakdowns (charts), cross-session patterns (`synthesize-insights` groups ≥2 sessions' themes into 2–15 patterns with quotes), CSV/Markdown export, project filters. Full-text search machinery exists DB-side (`global_search`, FTS columns) — UI wiring uncertain. |
| **Requirements** | `/requirements`, `/requirements/:id` | Research-request intake: categorized, prioritized, voted, threaded comments, status workflow (submitted → … → completed), linkable to projects/sessions/surveys/simulations. |
| **Methodology** | `/methodology` | Public docs explaining simulation/confidence/validation scoring. |

### 5.7 Participants, incentives & the panel — Live (workspace-scoped)

- **Panel** (`/participants`): workspace-owned respondent records, CSV import, tags, notes, quality score, session linkage.
- **Rewards** (`/incentives`, `/incentives/:id`): incentive programs (cash / gift card / points / donation / lottery / physical), budget tracking with exhaustion auto-pause, per-participant disbursements with status lifecycle (pending → awaiting_approval → processing → sent → claimed/expired), approval threshold (default $100), CSV/JSON export (`incentive-report`), pre-flight budget check (`check-budget`).
- **Disbursement rail:** `disburse-incentive` routes to **Tremendous sandbox** (`testflight.tremendous.com`) when provider=tremendous, else marks for manual handling. **No production payout key is set — nothing real can be paid. This is deliberate (parked decision).**

### 5.8 Validation & calibration — Alpha (bannered)

The trust system that makes "hybrid" credible:

- `/validation` (Alpha banner: "in active development"): global accuracy score, per-segment calibration table, monthly trend, dimension breakdown (sentiment vs themes accuracy), real-vs-twin comparison pairs (`validation-report`).
- **Calibration data:** real responses (from surveys, sessions, or manual upload via CalibrationUploader) matched against twin responses → `accuracy_score` rows in `calibration_data`.
- **Cron:** `cron-calibration` (CRON_SECRET-gated, fail-closed) periodically averages accuracy per segment into `segment_profiles.calibration_score` — which drives the badges in §5.3.
- Decision context: Validation Studies was downgraded-but-kept on the kill list (2026-05-19) because it *is* the hybrid promise; full orchestration backend is roadmap.

### 5.9 Participant marketplace portal — Built, payout parked

A second, participant-facing product surface with separate auth wrapper (`ParticipantRoute`) under `/participate/*`: login/signup, dashboard, study feed (browse active `study_listings`), earnings (ledger + cash-out ≥ $5 via `participant-cashout` → Tremendous **sandbox**), impact stats, referrals (codes + $2/$2 bonuses), profile, and **My Twin** (the participant's own AI profile: archetype, trait bars, calibration accuracy ring, share card).

Supporting machinery: reputation system (tiers newcomer→elite, completion rate, ratings, streaks), study matching with demographic/reputation scoring + hard requirements (`participant-match`), notifications.

**State:** routes and edge functions are live; the **money out is sandbox-only by decision** (2026-06-02: pay the first 2–3 participants by hand when a real customer asks; build the rail after doing it manually). Do not wire a production payout key without that demand signal.

### 5.10 Billing & tiers — Live (verified on prod)

See §8 for the full tier table. Flow: `create-checkout` (Stripe Checkout, subscription mode) → `stripe-webhook` (signature-verified, `verify_jwt=false` — the HMAC *is* the auth) maps product → tier and writes `workspaces.tier` + `subscription_status` + initializes the monthly token-usage row → `check-subscription` powers the Billing tab → `customer-portal` for self-serve management. Real product IDs: Starter `prod_U77vT9icIzokqy`, Professional `prod_U77wrd6NNDHYW2`.

⚠️ The webhook was verified live with test signatures (2026-06-03), but **a real Stripe-test checkout end-to-end (card → webhook → tier flip) has not been manually run** — owed before charging a live customer (§10).

### 5.11 Platform admin — Live (operator-only)

`/admin/*` console gated by `SuperAdminRoute` + `super_admins` table (seeded with the founder's auth UUID, `is_super_admin()` SECURITY DEFINER check): overview KPIs, tenants, users, participants, studies, AI usage/token burn, financials (MRR/churn), platform audit log, system status.

### 5.12 Trust Center & audit — Live, one claim must be fixed

- Immutable `audit_logs` (SOC 2-style trail: action, resource, user, IP, UA) written by triggers (membership changes, API key creation, simulation runs) + explicitly by sensitive edge functions. Workspace-visible at `/trust-center` and in Settings → Activity.
- **Claim honesty (fixed 2026-06-10):** the page previously rendered "SOC 2 Type II" / "ISO 27001" badges plus "AES-256 / TLS 1.3 / EU-US residency" specifics with no certification behind them. All copy is now truthful and attributed — "Built on SOC 2-compliant infrastructure providers (Supabase, Stripe, Vercel)", encryption/hosting described as Supabase-managed — and the admin audit page's "SOC 2 compliant" tagline was reworded. `src/test/trustCenter.test.tsx` fails the suite if certification badges return.

### 5.13 Public & API surfaces — Live

- `/` landing (honest pricing/claims since `37da1af`), `/demo` (3 hard-coded demo personas, `public-demo-simulate`, no signup), `/s/:surveyId` public survey, `/shared/:token` read-only snapshot.
- **API keys** (Settings → API & Webhooks): hashed workspace API keys with scopes (default `simulate`) and per-hour rate limits; `api-simulate` exposes simulation programmatically. Outbound **webhooks** with event subscriptions, HMAC secrets, delivery logs (`dispatch-webhook`).
- **Data rights:** `export-workspace-data` (full export), `erase-participant` (GDPR/PDPL-style erasure), `cleanup-expired-data` (retention; `workspaces.data_retention_days` default 730, `gdpr_enabled`/`pdpl_enabled` flags).

### 5.14 i18n — English-only by decision (machinery kept)

`ENABLED_LANGUAGES = ["en"]` in `src/lib/i18n.tsx` is the single source of truth; the language picker self-hides when ≤1 language is enabled; stale localStorage falls back to `en`. Locale files kept on disk: `en` (760 keys, 100%), `ar`/`fr`/`es`/`de` (~82%, Arabic RTL only cosmetic). **Re-enabling a language = one line + finishing its translation/RTL work.**

### 5.15 Analytics — Live

PostHog (`src/lib/analytics.ts`, no-op without `VITE_POSTHOG_KEY`; autocapture off, manual pageviews). Canonical funnel events:

`signup_completed` → `onboarding_simulation_run` / `simulation_run` / `focus_group_run` → `paywall_viewed` → `upgrade_clicked` → `checkout_started` → `checkout_completed`, plus `$pageview`. Identify on login, reset on logout.

---

## 6. System architecture (summary)

```
Browser SPA (Vite/React, Vercel, SPA rewrite only)
   │  supabase-js (anon key, RLS-bound)        │ Stripe.js redirect
   ▼                                           ▼
Supabase project xwjvsmwefbukaswkwpbf          Stripe (Checkout, Portal, Webhook→stripe-webhook)
   ├─ GoTrue auth (email/pw + Google/GitHub/Twitter)
   ├─ Postgres + RLS (≈45 tables, FTS, pg_cron + pg_net keep-warm @ 06:00 UTC)
   ├─ Storage: avatars (public), session-media (private)
   └─ 47 Deno edge functions
        ├─ AI: Gemini 2.5 Flash via OpenAI-compatible endpoint
        │      (_shared/aiClient.ts: 25s timeout, 1 retry on 429/5xx)
        ├─ Transcription: Deepgram nova-2, Whisper fallback
        ├─ Payouts: Tremendous SANDBOX only
        └─ Observability: Sentry helper wired, DSN unset (parked) → effectively console logs
```

**Edge auth posture (load-bearing, see vault memory):** nearly all functions run `verify_jwt=false` in `config.toml` and do **in-code** `auth.getUser(token)` + `validateWorkspaceMembership()` (queries `workspace_memberships`; service-role clients bypass RLS so this check is the tenant boundary). Exceptions: `cron-calibration` (verify_jwt=true + `x-cron-secret`, fail-closed if secret unset), `marketplace-handler` (verify_jwt=true), `stripe-webhook` (**must stay** verify_jwt=false; Stripe HMAC is the auth — gateway-401 outage of 2026-06-03 is the cautionary tale).

**Fail-closed guarantees:** rate limiter and tier enforcement return 503 on lookup errors (P0.4 — they previously failed open). Tier reads are DB-cache-first (`workspaces.tier`, written only by the webhook) — no Stripe call per request (P0.2).

**CORS:** explicit origin allowlist (insightforge.io, www, Lovable preview, Vercel preview, localhost:8080/5173/3000) — no wildcard.

**Environments:** prod = free-tier Supabase (auto-pause mitigated by keep-warm cron; **no DB backups** until Pro — accepted while data is throwaway). Local: `supabase start` + `.env.test` for the e2e harness (fail-closed preflight refuses non-localhost URLs). CI: GitHub Actions account-frozen (billing); local pre-push gate (tsc + vitest, blocking) covers `main`.

---

## 7. Data model (summary)

50 migrations (2026-03-08 → 2026-06-03). Full catalog in the migrations; the entities that matter:

| Area | Tables | Notes |
|---|---|---|
| Tenancy | `workspaces`, `workspace_memberships`, `profiles`, `super_admins` | `app_role`: owner/admin/researcher/observer. Tier limits enforced by BEFORE INSERT triggers. `user_roles` is legacy (kept for compat). |
| Twins & simulation | `segment_profiles`, `simulations`, `twin_responses`, `calibration_data` | `simulations.type` CHECK still lists `policy`/`market_sim` (vestigial). `twin_responses` = per-persona audit trail incl. persona snapshot. |
| Real research | `projects`, `surveys`, `survey_questions`, `survey_responses`, `sessions`, `session_participants`, `session_transcripts` (FTS), `session_themes` (FTS), `session_notes` (FTS), `session_probes`, `session_media`, `insight_patterns` (FTS), `synthesis_runs`, `pattern_snapshots` (migration committed 2026-06-10, **pending prod apply** — see #13), `requirements` (+comments/votes) | **Naming trap: `sessions` = human research sessions; `simulations` = AI twin runs.** |
| Panel & incentives | `participants`, `participant_tags`, `incentive_programs`, `incentive_disbursements`, `participant_points_ledger` | Workspace-scoped. Budget/spend triggers auto-exhaust programs. |
| Marketplace portal | `participant_profiles`, `study_listings`, `study_participations`, `participant_earnings`, `participant_reputation`, `participant_referrals`, `participant_notifications` | Platform-wide (user-scoped, not workspace-scoped). **Distinct from `participants`** — dual system, by design but undocumented elsewhere. |
| Billing & quota | `workspace_token_usage` (monthly, unique per workspace+period), `workspace_token_usage_log` (per-request, 24h window for per-minute limits; cleanup cron is a TODO) | Written by edge `recordTokenUsage()` + stripe-webhook. |
| Extensibility | `workspace_api_keys`, `api_keys`, `webhooks`, `webhook_deliveries`, `workspace_integrations`, `workspace_branding` | Last two are vestigial UI-side (killed features) but live tables. |
| Audit/infra | `audit_logs`, `workspace_activity`, `keep_warm_heartbeat` | Audit insert-only; triggers on memberships/API keys/simulations. |

**View:** `marketplace_segments` (published segments; `security_invoker=true` since 2026-06-03 — do not revert to DEFINER; any marketplace revival should add an explicit `is_published` RLS policy instead).

**Key functions/triggers:** `handle_new_user()` (signup seeding, exception-wrapped), `is_workspace_member()` / `has_workspace_role()` (SECURITY DEFINER, power most RLS policies), `check_workspace_member_limit()` / `check_workspace_resource_limit()` (tier gates), `get_shared_snapshot(token)` (public token-gated read), `keep_warm()` (pg_cron daily), `global_search()` / `search_transcripts()` (FTS).

---

## 8. Tiers, pricing & quotas (canonical numbers)

Source of truth: `src/lib/tierLimits.ts` + DB triggers (they agree). The edge layer mirrors them in `supabase/functions/_shared/tierLimitsData.ts` (reconciled 2026-06-10 after drifting; `src/test/tierParity.test.ts` fails the suite if the copies diverge again).

| | Free $0 | Starter $49/mo | Professional $149/mo | Enterprise (custom) |
|---|---|---|---|---|
| Members | 3 | 10 | 25 | unlimited |
| Sessions | 10 | 50 | 200 | unlimited |
| Surveys | 5 | 25 | 100 | unlimited |
| Projects | 2 | 10 | 50 | unlimited |
| AI tokens / month | 50,000 (≈3 simulations) | 500,000 | 2,000,000 | 10,000,000 |
| AI requests / minute | 3 | 10 | 30 | 100 |
| Requirements | 5 | 25 | 100 | unlimited |
| Incentive programs / budget | 1 / $500 | 5 / $5,000 | 20 / $50,000 | unlimited |
| Storage / support | 500MB / community | 5GB / email | 25GB / priority | unlimited / dedicated |

**Enforcement is layered:** frontend `TierGate` (UX + paywall events) → DB triggers (hard INSERT gates for members/projects/sessions/surveys) → edge `enforceTierLimit` + `checkRateLimit` (AI access, token budget, per-minute rate; fail-closed 503). Free tier's `aiAnalysis=true` is deliberate (P0.8) — the trial is the activation engine; do not flip it off.

---

## 9. Security & compliance posture

- **RLS on all public tables** (confirmed live 2026-06-02, advisor 0 ERROR-level lints since 2026-06-03). Policies built on `is_workspace_member`/`has_workspace_role`.
- **Tenant boundary in edge functions** = JWT validation + `validateWorkspaceMembership` (mandatory wherever a service-role client is used — service role bypasses RLS). All 22 security-relevant functions migrated to the canonical helper (2026-06-02).
- **Webhook auth:** Stripe HMAC (`constructEventAsync` — Deno requires async). `BYPASS_STRIPE_SIGNATURE` only honored when `SUPABASE_URL` is localhost.
- **Cron auth:** `x-cron-secret`, constant-time compare, fail-closed when unset.
- **Secrets hygiene:** `.env` untracked (public `VITE_*` keys only; `.env.example` committed); Supabase PAT lives in macOS Keychain, never in repo.
- **Data rights:** export, participant erasure, retention window per workspace (GDPR/PDPL flags).
- **Prod-dep CVEs:** 0 (patched 2026-06-08); 2 moderate dev-only vulns (esbuild/vite) outstanding, never shipped to users.
- **Known gaps:** Trust Center badge claims (§5.12); no `vercel.json` security headers (CSP, X-Frame-Options); Sentry code complete but DSN unset (parked) — production error visibility is effectively console logs; no DB backups on free tier.

---

## 10. Quality & verification state (honest scope)

| Layer | State | What it proves |
|---|---|---|
| Types/lint | `tsc -p tsconfig.app.json` + `-p tsconfig.node.json` both clean (0 errors). The gate was repaired 2026-06-10 after the bare root invocation was found to check zero files (#13) — never use bare `npx tsc --noEmit` here. eslint 0 errors (advisory). `noImplicitAny`/`strictNullChecks` are off — TS is partial. |
| Unit/integration | vitest **104/104** | Lib/logic level. |
| E2E | 4 Playwright specs (stripe, workspace-admin, ai-twin, participant) **green against a local Supabase stack** (`supabase start` + `.env.test` + fail-closed preflight; can never hit prod). | UI + auth signup + routing + DB writes wire together on real Postgres+GoTrue. **Stripe, `simulate` AI, and payouts are network-mocked.** |
| Live prod probes | stripe-webhook (bad-sig 400), A4 signup seeding (real GoTrue signup → 3 segments), keep-warm (HTTP 200), advisor lints (0 ERROR) | Individual subsystems verified on prod at ship time. |
| **Owed before charging a live customer** | — | One manual real Stripe-test checkout watching the live webhook flip the tier, and one real payout path exercise. |
| Pre-launch gate | `/e2e-test` 2026-06-08: **SHIP-WITH-CAUTION** (cautions: mocked integrations above; dev-only vulns) | — |
| CI | GitHub Actions frozen (account billing); local pre-push gate (tsc + vitest, blocking) protects `main` | — |

---

## 11. Parked & killed scope (the roadmap discipline)

### Parked — built or designed, deliberately inactive; revival condition attached

| Item | State on disk | Revive when |
|---|---|---|
| **Participant payouts (production)** | Portal + Tremendous sandbox fully wired; no prod key | A real customer asks for real-human validation; pay the first 2–3 by hand first (decision 2026-06-02). |
| **Segment Marketplace** | `marketplace-handler` fn, `is_published`/pricing columns, INVOKER view; **no UI** | Reshape as "Segment Templates" starter library inside Segment Library; needs supply+demand evidence (kill-list memory). |
| **Multilingual UI (ar/fr/es/de)** | Locale files ~82%, picker gated by `ENABLED_LANGUAGES` | Per language: finish translation + (for ar) logical-property RTL sweep; then one-line enable. |
| **Frontend Sentry** | `src/lib/sentry.ts` complete, no-op without DSN | Mahmoud creates DSN + sets Vercel env (parked 2026-06-08). |
| **Supabase Pro ($25/mo)** | Keep-warm cron mitigates pause meanwhile | First paying customer (backups become non-optional). |
| **Validation orchestration backend** | UI alpha + calibration cron live | Roadmap; alpha banner is the honest promise level. |

### Killed 2026-05-19 (PR #22, 2,134 lines) — do not revive without re-opening the decision

Policy Simulator · Custom Twin Builder · White-Label · Integrations Tab · standalone Market Simulator page (math re-embedded in Focus Group). Orphan edge functions deleted (PR #25). Vestigial DB remnants are catalogued in §12 and are harmless.

---

## 12. Known issues & risks (verified 2026-06-10)

1. **Tier-limit three-way drift — FIXED 2026-06-10.** `_shared/tierEnforcement.ts` had drifted from `src/lib/tierLimits.ts` + DB triggers (free 2 vs 3 members, 3 vs 2 projects; professional unlimited vs 200/100/50). Impact was **latent, not live**: the only edge-enforced resource today is `aiAnalysis` (4 callers — simulate, simulate-focus-group, simulate-ab-test, suggest-methodology), so no user was ever actually blocked by the wrong numbers; the DB triggers were always the operative gate. Limits now live in `_shared/tierLimitsData.ts` mirroring the canonical table, with `src/test/tierParity.test.ts` as the divergence tripwire. Zero behavior change → no redeploy needed (no-op-deploy precedent).
2. **Trust Center unbacked certification badges — FIXED 2026-06-10.** See §5.12. Same pass also replaced the landing page's "GDPR Compliant" hero badge with "Data Export & Erasure Built In" (`landing.trustGDPR` in `en.json`/`ar.json` — the capability the product actually has), softened "immutable" → "append-only" (RLS denies update/delete to API clients; service-role technically can), and scoped the hosting claim to workspace data with Stripe/Google named as processors.
3. **README.md is unedited Lovable boilerplate** — says nothing about InsightForge; replace with a real readme (this PRD can seed it).
4. **No security headers** in `vercel.json` (CSP, X-Frame-Options, HSTS).
5. **Observability gap:** Sentry parked → prod errors are invisible beyond console/Supabase logs; no AI-cost dashboard (admin AI-usage page reads DB usage rows only).
6. **Vestigial schema:** `workspace_integrations`, `workspace_branding`, `simulations.type` CHECK values `policy`/`market_sim`, legacy `user_roles`, duplicate API-key tables (`api_keys` vs `workspace_api_keys`). Harmless but confusing; candidates for a cleanup migration when convenient.
7. **Dual participant systems** (`participants` vs `participant_profiles`) — by design (panel vs marketplace) but documented only here; naming invites bugs (`validateWorkspaceMembership` queries `workspace_memberships`, NOT `workspace_members` — a past real bug).
8. **`workspace_token_usage_log` cleanup cron is a TODO** — table grows unbounded (24h of rows is all that's read; old rows are dead weight).
9. **TypeScript strictness off** (`noImplicitAny: false`, `strictNullChecks: false`, ~218 `any`s per AUDIT) — refactor risk multiplier.
10. **No DB backups** (free tier) — accepted while data is throwaway; becomes #1 risk at first paying customer (pairs with Supabase Pro, §11).
11. **Referrals tab uses a mock invite code** derived from workspace ID — cosmetic-only feature; either wire it or remove it before users notice.
12. **2 dev-only moderate vulns** (esbuild/vite) — bump vite at leisure; not in shipped bundle.
13. **The pre-push type-check gate was a no-op — FIXED 2026-06-10.** `.githooks/pre-push` and `ci.yml` ran bare `npx tsc --noEmit`, which resolves the root solution-style `tsconfig.json` (`files: []` + references) and checks **zero files** — every historical "tsc clean" via that path was vacuous. Both now run `tsc -p tsconfig.app.json` + `-p tsconfig.node.json`; verified to block on an induced type error and pass clean. The 7 errors it had been hiding resolved as: (a) `ResearchPatternsTab.tsx` read a `pattern_snapshots` table that **does not exist on the live prod DB** (confirmed via management API) — a two-sided feature whose table was never created (writer `synthesize-insights` inserts non-fatally, reader falls back gracefully, so prod never visibly broke); codified via migration `20260610120000_pattern_snapshots.sql` + hand-added types block (matches the emitter format; next `sync-types` after prod apply reconciles). ⚠️ **Migration NOT yet applied to prod** — until applied, snapshot writes keep no-op'ing and trends use the previous-run fallback, unchanged. (b) `src/services/sessionService.ts` — a 123-line service with **zero callers** written against a nonexistent `scheduled_at` column (`getSessions` would throw, `createSession` would fail behind an `as any`) — deleted.
14. **Participant "Request Data Erasure" button was dead — FIXED 2026-06-10.** Investigation settled the design: `erase-participant` requires an **owner/admin** JWT and erases the workspace-scoped `participants` record — the wrong entity for a marketplace `participant_profiles` identity — so self-serve wiring would have required a whole new erasure pipeline. The smaller honest fix shipped instead: the button is now a real `mailto:enterprise@insightforge.io` link (the product's one published address, also used by BillingTab) and the copy says requests are processed manually. ⚠️ **Verify that mailbox actually exists and is monitored** — two surfaces now depend on it. Same pass added migration `20260610130000_audit_logs_append_only.sql` making the Trust Center's "append-only" claim structural: a trigger blocks all UPDATEs and direct DELETEs on `audit_logs` while allowing the `workspaces` ON DELETE CASCADE (workspace deletion is a live owner feature). **Not yet applied to prod**; before applying, run a local `supabase db reset` and confirm a workspace delete still cascades.
15. **`data_residency` rendered a fabricated "mena" fallback — FIXED 2026-06-10** (`WorkspaceTab.tsx` → "Not set", `AdminTenants.tsx` / `AdminTenantDetail.tsx` → "—"). Still open underneath: the column's DB default is `'mena'`, so most *stored* values say "mena" regardless — whether that matches the Supabase project's actual region is a copy/settings decision for Mahmoud (pairs with #16).
16. **Landing advertises killed/embedded studios** — the "5 Simulation Studios" section still sells "Policy Impact" (killed 2026-05-19, no route) and "Market Simulation" as a standalone studio (embedded-only in Focus Group results). Positioning copy — needs Mahmoud's wording decision, same honesty bar as A2.

---

## 13. Success metrics

- **Activation:** % of signups that run ≥1 simulation or focus group (events: `signup_completed` → `simulation_run`/`focus_group_run`/`onboarding_simulation_run`). The starter-segment seeding + seed-from-idea exist to maximize this.
- **Iteration depth (aha proxy):** simulations per active workspace per week; share of runs initiated from a suggestion card (instrument later — not currently a distinct event).
- **Monetization funnel:** `paywall_viewed` → `upgrade_clicked` → `checkout_started` → `checkout_completed`; MRR/churn visible in `/admin/financials`.
- **Trust:** segments reaching Calibrated (≥0.6) — the hybrid promise becoming measurable.
- **Guardrail metrics:** monthly token spend per workspace vs budget (admin AI-usage), error rate (once Sentry DSN lands).

No fabricated benchmarks: any external claim (accuracy %, market stats) must pass `docs/CLAIMS_TO_VERIFY.md` discipline.

---

## 14. Open questions & near-term owed work

Tracked canonically in the vault (`open-questions.md`); live items as of 2026-06-10:

- **Pay ~$52 GitHub bill** → unfreezes Actions account-wide (Q2; the lock's root cause is the other repo — tiering its CI is Q6).
- **Manual real-Stripe + payout pass** before charging a live customer (the one quality gate automation can't cover; §10).
- Q5 (polished brainstorm docx distribution) — LOW, dormant.

---

## Appendix A — Route map (condensed)

**Public:** `/` · `/login` · `/signup` · `/forgot-password` · `/reset-password` · `/auth/callback` · `/demo` · `/s/:surveyId` · `/shared/:token`
**App (ProtectedRoute):** `/dashboard` · `/projects(/:id)` · `/surveys(/:id)` · `/sessions(/:id)` · `/studio/:id` · `/segments` · `/simulate(/:id)` · `/focus-group` · `/ab-test` · `/simulations/compare` · `/insights` · `/participants` · `/incentives(/:id)` · `/requirements(/:id)` · `/validation` · `/methodology` · `/trust-center` · `/settings`
**Participant (ParticipantRoute):** `/participate/{login,signup,dashboard,studies,earnings,impact,referrals,my-twin,profile}`
**Admin (SuperAdminRoute):** `/admin` · `/admin/{tenants(/:id),users,participants,studies,ai-usage,financials,audit,system}`

## Appendix B — Edge functions (47, by pipeline)

- **Simulation:** `simulate`, `simulate-focus-group`, `simulate-ab-test`, `seed-from-idea`, `suggest-next-test`, `public-demo-simulate`, `api-simulate`, `twin-orchestrator`, `calibrate-segment`
- **Billing:** `create-checkout`, `stripe-webhook`, `check-subscription`, `customer-portal`
- **Research suite:** `generate-project-plan`, `generate-survey-questions`, `distribute-survey`, `submit-survey-response`, `analyze-transcript`, `transcribe-media`, `summarize-session`, `generate-probes`, `synthesize-insights`, `suggest-methodology`, `seed-sample-project`
- **Participants/incentives:** `participant-{signup,profile,match,match-scores,impact,referral,twin-preview,cashout}`, `study-listing`, `study-participate`, `disburse-incentive`, `check-budget`, `incentive-report`, `incentive-webhook`
- **Workspace/admin:** `invite-member`, `list-workspace-members`, `export-workspace-data`, `erase-participant`, `cleanup-expired-data`, `dispatch-webhook`, `marketplace-handler`, `validation-report`, `cron-calibration`

Auth pattern: in-code JWT + `validateWorkspaceMembership` (verify_jwt=false) except `cron-calibration`/`marketplace-handler` (true) and `stripe-webhook` (HMAC). Shared helpers in `_shared/`: `aiClient`, `rateLimiter`, `tierEnforcement`, `tierLimitsData`, `validation`, `cors`, `prompts`, `sentry`.

## Appendix C — Glossary

| Term | Meaning here |
|---|---|
| **Segment / digital twin** | One synthetic consumer persona (`segment_profiles` row); "twin" in UI copy, "segment" in code. |
| **Simulation** | An AI run (`simulations`): solo, focus_group, or ab_test. *Not* a human session. |
| **Session** | A real-human research session (`sessions`): interview or focus group with recording/transcript. |
| **Consensus score** | Purchase-intent unanimity across personas in a focus group (0–1). |
| **Calibration** | Matching twin responses to real responses to score segment accuracy (0–1); drives New/Calibrating/Calibrated badges. |
| **Aha loop** | seed-from-idea → run → dominant objection + explored axes + 3 next tests → one-click re-run. |
| **Panel vs marketplace participant** | `participants` = workspace-owned contact list; `participant_profiles` = platform-wide earning account with portal. |
