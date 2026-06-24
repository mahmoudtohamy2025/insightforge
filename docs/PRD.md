# InsightForge — Product Requirements Document

| | |
|---|---|
| **Version** | 2.0 |
| **Date** | 2026-06-24 |
| **Status** | Canonical internal spec. Supersedes v1.0 (2026-06-10, as-built). |
| **Lens** | Describes the **fully-functioning product (v1)** as one coherent system. Every requirement carries an honest status tag so the doc doubles as the roadmap to "fully functional." |
| **Audience** | Internal source-of-truth — Mahmoud + future dev/AI sessions. Serves engineering, strategy, and onboarding. |
| **Maintenance** | Flip a status tag when a feature ships, deploys, or is parked/killed. Strategic decisions live in the vault (`decisions.md`, append-only); this doc describes the product those decisions produce. |

> **How to read this.** §1–4 are the thesis (what it is, who for, the rules). §5 is the user journeys. §6 is the feature spec — the heart — written as "what fully-functioning looks like," every requirement tagged. §7–11 are the system (engine, architecture, data, tiers, security). §12 are non-functional requirements. §13 is metrics. **§14 is the consolidated Gap-to-v1 backlog** — the actionable NEEDS-BUILD list, prioritized. §15–17 are parked/killed scope, open questions, appendices.

## Status legend

Every requirement in §6 is tagged with exactly one:

| Tag | Meaning |
|---|---|
| ✅ **LIVE** | Shipped, routed/deployed, and working today. |
| 🔧 **NEEDS-BUILD** | Required for a fully-functioning v1, but not working yet — undeployed, wired-but-broken, or unbuilt. Each names the gap. |
| ⏸️ **PARKED** | Deliberately inactive. Plumbing may exist; a revival condition is attached. |
| ❌ **KILLED** | Removed by decision. Do not revive without re-opening the decision log. |

---

## 1. Product overview

**One-liner (honest, as the system is designed to work):**

> InsightForge is a **hybrid consumer-research platform**: founders, product teams, and brands define **digital consumer twins** (AI personas grounded in demographics, psychographics, behavior, and MENA-aware cultural context), run them through **simulated focus groups, solo interviews, and A/B tests** for directional feedback in minutes — then **validate the high-stakes calls with real humans** (surveys, recorded sessions, theme synthesis, and a paid participant panel). The twins get **calibrated against the real responses**, so confidence compounds over time.

**The aha loop (the activation engine):** type a question → a multi-persona focus group answers in ~30 seconds → see the dominant objection and where the segment splits → get three concrete next tests, one click each → re-run.

**The hybrid loop (the moat):** a synthetic finding worth betting on → push it to real humans (survey or session) → the platform scores how close the twins were → segment calibration rises → next synthetic run is more trustworthy. **No competitor closes this loop with MENA depth.**

**Positioning guardrail (locked 2026-05-19, honesty-corrected 2026-06-10):** sell the *speed-to-iteration* and the *hybrid confidence*, never "statistics." A run samples **dozens** of twins per segment (max ~40 paid), not "50 statistically-valid customers." Output is **qualitative signal with confidence and spread**, not a survey of record.

**Stack:** Vite + React + TypeScript SPA (Vercel) · Supabase (Postgres + RLS, GoTrue auth, 47 Deno edge functions) · Google **Gemini 2.5 Flash** · Stripe subscriptions · PostHog analytics · Tremendous (payouts, sandbox).

---

## 2. Problem & target users

**Problem.** Real market research costs ~$5k and ~2 weeks per question (recruit, incentivize, moderate, synthesize). Founders either skip it and guess, or burn runway. Existing AI-persona tools (Synthetic Users, Aaru, Listen Labs, Outset, Strella) are one-shot answer machines — they don't tell you *what to test next*, they don't *validate against real humans*, and **none have MENA-region cultural depth or Arabic.**

### Primary users — the three doors into one product

| Door | Route | Who | Job-to-be-done |
|---|---|---|---|
| **Founders** | `/for-founders` | Solo founders, pre-PMF | Test pricing/positioning/feature ideas before building, without research budget. |
| **Product teams** | `/for-product-teams` | Small PM/UXR teams | Pressure-test concepts between real research rounds; triage what deserves a real study. |
| **Brands** | `/for-brands` | Brand/marketing teams (MENA focus) | Test messaging/campaigns across culturally-distinct consumer segments fast. |

> Doors are **copy-only variants of one product** (one `PersonaLanding` component, `personaLandingCopy.ts`). They must never grow schema or edge-function differences — that's the "three products" red flag. They exist for attribution and outreach.

### Secondary users
- **Workspace team members** — invited collaborators with roles `owner` / `admin` / `researcher` / `observer`.
- **Research participants** — real humans, in two deliberately distinct shapes (see §6.7): a workspace-scoped **panel** (`participants`) the researcher manages, and a platform-wide **marketplace identity** (`participant_profiles`) that earns money via the `/participate/*` portal.
- **Platform operator (super admin)** — Mahmoud, via the `/admin/*` console.

**Launch bar (decided 2026-06-03):** public self-serve, English-only. MENA/Arabic is the differentiation thesis but is a NEEDS-BUILD for the running UI (§6.13).

---

## 3. Goals & non-goals

### Goals
1. **Activation in minutes** — a brand-new signup runs a real focus group immediately (3 starter segments auto-seeded; `/focus-group` self-configures from one sentence).
2. **Iteration, not one-shot answers** — every simulation ends with a result-aware "what to test next" loop.
3. **Honest, decision-grade output** — confidence, consensus, **per-segment spread (error bars)**, and calibration against real responses are first-class. No fabricated results in-product.
4. **The hybrid confidence loop closes** — synthetic → real validation → calibration → better synthetic. This is the durable moat, not the simulator alone.
5. **MENA as a real capability, not a label** — Arabic UI + dialect/culture-aware twins, live, not cosmetic.
6. **Self-serve monetization** — free tier with a real AI trial (50K tokens/mo ≈ 3 simulations) → Stripe upgrade to Starter $49 / Professional $149.

### Non-goals (decided — do not re-litigate without the decision log)
- ❌ No AI startup-coach / standalone task-recommender — the next-test loop lives inside the studio.
- ❌ No Policy Simulator, Custom Twin Builder, White-Label UI, or Integrations tab — killed 2026-05-19 (PR #22).
- ❌ No standalone Market Simulator page — Bass-diffusion math is embedded in Focus Group results.
- ⏸️ No automated participant payouts at launch — first payouts manual; production rail parked pending a real customer.
- ⏸️ No segment marketplace at launch — plumbing exists, no UI.

---

## 4. Product principles

1. **Honesty over hype.** Banned: "statistical," unbacked compliance badges, fake demo results, advertised-but-killed features. Tripwire tests enforce this (`trustCenter.test.tsx`, `personaLanding.test.ts`).
2. **Qualitative signal, surfaced with its uncertainty.** Always show confidence + spread; never imply survey-grade precision.
3. **Hybrid is the differentiator; the simulator is the headline.** The real-human suite is not a side feature — it is what makes the twins trustworthy.
4. **One product, three doors.** Audience-specific copy, never audience-specific architecture.
5. **MENA depth is the wedge.** Cultural context on every segment, Arabic-first intent, Ramadan/Hijri awareness — built into the prompt path, not bolted on.
6. **Fail closed.** A billing/DB outage denies AI; it never grants free Enterprise.

---

## 5. Core user journeys

### 5.1 Researcher aha loop (the funnel, as instrumented) — ✅ LIVE
1. **Land** on `/`, a persona door (`/for-founders` etc.), or `/demo` (no-signup, real Gemini, 3 demo personas).
2. **Sign up** `/signup` (email/pw + Google/GitHub/Twitter). `handle_new_user()` seeds profile + workspace + **3 starter segments** (exception-wrapped — seed failure never blocks signup). → `signup_completed` (carries `door`).
3. **First-run guidance** — onboarding wizard (runs a *real* simulation), dashboard checklist, product tours, sample-data CTA.
4. **Run the aha loop** `/focus-group` — blank-screen escape hatch (`seed-from-idea`) → configure 2–5 segments × 1–3 rounds (+ optional 🌙 Ramadan mode) → run → per-persona cards + group consensus + **distribution** + market projection → **What to test next** (dominant objection + explored-axes + 3 one-click follow-ups).
5. **Hit the paywall** at the token/tier limit → `TierGate` upgrade CTA.
6. **Upgrade** via Settings → Billing → Stripe Checkout → webhook flips tier.

### 5.2 Hybrid validation loop — ✅ LIVE (calibration backend NEEDS-BUILD verification)
A synthetic finding worth betting on → create a **survey** (public link) or schedule a **session** (record, transcribe, extract themes) → real responses flow into `calibration_data` → `cron-calibration` averages accuracy into each segment's `calibration_score` → **calibration badge** rises (New → Calibrating → Calibrated) → next synthetic run carries earned confidence.

### 5.3 Participant earning loop — 🔧 NEEDS-BUILD (broken as written; payout parked)
A real human signs up at `/participate/signup` → builds a profile + personal "twin" → browses the **study feed** → accepts a study → completes it → **earns** (with streak + referral bonuses) → cashes out ≥ $5. *Today the read paths (dashboard, earnings, impact, profile, referrals) are broken by a POST-vs-GET mismatch and payouts are sandbox-only (§6.7).*

---

## 6. Feature spec (fully-functioning v1, status-tagged)

Conventions: each subsection states **what fully-functioning looks like**, then a requirements table. **Key files** are given so requirements are actionable.

### 6.1 Auth & onboarding

| Requirement | Status | Detail |
|---|---|---|
| Self-serve signup + OAuth | ✅ LIVE | `/signup` email/pw + Google/GitHub/Twitter; reset at `/forgot-password`→`/reset-password`. |
| Zero-to-runnable workspace | ✅ LIVE | `handle_new_user()` seeds profile + workspace + owner membership + 3 starter segments. |
| First-run guidance | ✅ LIVE | Onboarding wizard (runs a real sim), dashboard checklist, sample-data CTA, product tours (spotlight, once-per-tour localStorage). |
| Session continuity | ✅ LIVE | Last path persisted to `profiles.last_visited_path`. |

Key files: `src/pages/SignUp.tsx`, `src/hooks/useAuth.tsx`, migration `20260602_seed_starter_segments_on_signup.sql`.

### 6.2 Workspaces & team

| Requirement | Status | Detail |
|---|---|---|
| Multi-tenant isolation | ✅ LIVE | Every row carries `workspace_id`; RLS restricts to members (§11). |
| Roles & permissions | ✅ LIVE | `owner/admin/researcher/observer`; owners/admins manage settings/billing/team/API keys. |
| Workspace switcher + create | ✅ LIVE | Sidebar switcher; selection persisted. |
| Team invites & seat limits | ✅ LIVE | `invite-member` (invite/update_role/remove/transfer_ownership), last-owner protection, tier seat cap, member listing. |

Key files: `src/hooks/useWorkspace.tsx`, `src/pages/Settings.tsx`, `supabase/functions/invite-member`, `list-workspace-members`.

### 6.3 Segments & digital twins

**Fully-functioning:** a researcher builds rich consumer segments (or imports starter templates), each carrying MENA-aware cultural context, and watches each segment's calibration confidence rise as real validation accrues.

| Requirement | Status | Detail |
|---|---|---|
| Segment Library CRUD | ✅ LIVE | `/segments` — demographics/psychographics/behavioral/cultural JSONB; deep-links into studios. |
| Starter segments on signup | ✅ LIVE | 3 generic segments so a focus group works with zero setup. |
| Calibration badge per segment | ✅ LIVE | New (<0.3) / Calibrating (0.3–0.6) / Calibrated (≥0.6) from `calibration_score`. |
| Manual calibration (paste real response) | 🔧 NEEDS-BUILD | `calibrate-segment` UI is live but the fn is **absent from `config.toml`** — confirm deploy + live round-trip. |
| Continuous calibration cron | ✅ LIVE | `cron-calibration` (CRON_SECRET-gated, verify_jwt=true) averages accuracy into `segment_profiles.calibration_score`. |
| Starter **Segment Templates** library | ⏸️ PARKED | Reshape of the killed Segment Marketplace — curated importable segments inside the Library. Revive with supply+demand evidence. |
| Participant "My Twin" preview | ✅ LIVE | `/participate/my-twin` — archetype + trait bars (partly randomized); a participant-side toy, not the segment engine. |

Key files: `src/pages/SegmentLibrary.tsx`, `src/services/segmentService.ts`, `supabase/functions/{calibrate-segment,cron-calibration}`, migrations `20260327100000_digital_twins.sql`, `20260327110000_calibration_data.sql`.

### 6.4 Simulation studios — the product core

**Fully-functioning:** every studio samples **N distinct twins per segment** and renders the result as a distribution (mean ± spread, objection rate, sample size), not a single flat number — so the user sees *how much the segment agrees*, not just the average.

| Requirement | Status | Detail |
|---|---|---|
| Solo Simulation Studio | ✅ LIVE | `/simulate` — 1 segment × 1 stimulus → persona card (sentiment, confidence, intent, emotion, themes); history reload. **Single-twin by design** (decision: keep solo cheap; multi-twin is the group studios). |
| Focus Group Studio | ✅ LIVE | `/focus-group` — 2–5 segments × 1–3 rounds, Ramadan mode, idea-seed; per-round cards, consensus, market projection, aha loop. |
| A/B Test Studio | ✅ LIVE | `/ab-test` — two variants × segments → winner banner + per-segment metrics + cost. |
| Simulation Comparison | ✅ LIVE | `/simulations/compare` — side-by-side of 2–4 past runs. |
| Idea-seed (blank-screen filler) | ✅ LIVE | `seed-from-idea` — one sentence → picks 1–3 segments (hallucinated IDs rejected), writes stimulus, sets rounds. Confirm deploy (absent from `config.toml`). |
| Aha-loop next-test suggestions | ✅ LIVE | `suggest-next-test` — dominant objection (+% affected), 5 explored-axes, meta-recommendation, 3 one-click follow-ups. Wire it into A/B too (currently focus-group only). Confirm deploy. |
| Market Projection (Bass diffusion) | ✅ LIVE | Client-side adoption curve from sentiment×confidence×consensus; editable market size/horizon; peak month, saturation, penetration. Derivation shown (no black box). |
| **Multi-twin sampling engine** | 🔧 NEEDS-BUILD | `_shared/multiTwin.ts` — N/tier (free 2 / starter 5 / pro 8 / ent 10, capped `segments×twins ≤ 40`); free = 1 cheap array call, paid = N varied independent calls. Wired into focus-group + ab-test, 34 unit tests, reviewed. **NOT deployed to prod (PAT dead) — prod still N=1; live Gemini round-trip + token cost unverified.** |
| **Multi-twin distribution UI** | 🔧 NEEDS-BUILD | Engine returns `sample_size`, `sentiment_stdev`, per-segment mean±stdev, `objection_rate`; **studios still render flat means.** Build the error-bar / spread / "N twins" display. |
| **Honest "dozens" copy revision** | 🔧 NEEDS-BUILD | After deploy+verify, replace "50 customers"/"statistical" with the real number (max ~40 twins → "dozens"). Until deployed, the ban stands. |
| Deploy-confirm all `simulate-*` fns | 🔧 NEEDS-BUILD | `simulate`, `simulate-focus-group`, `simulate-ab-test`, `seed-from-idea`, `suggest-next-test`, `public-demo-simulate` are **all absent from `config.toml`** — the most load-bearing code is the least deploy-certain. Add them or confirm auto-deploy. |
| Canonical MENA prompt stack | 🔧 NEEDS-BUILD | `twin-orchestrator` (6-layer: persona/MENA-culture/category/Hijri/stimulus/calibration) and `_shared/prompts.ts` are **orphaned dead code**; each studio reimplements a drifting inline prompt. Wire one canonical builder to realize the MENA depth the marketing implies. |
| Policy Sim / Custom Twin Builder / standalone Market Sim | ❌ KILLED | 2026-05-19 (PR #22). Vestigial `simulations.type` enum values `policy`/`market_sim` remain (harmless). |

**Simulation pipeline contract** (edge): validate JWT + workspace membership → enforce tier (`aiAnalysis`) + rate limits (fail-closed) → build persona prompts from segment JSONB → call Gemini 2.5 Flash (OpenAI-compatible endpoint, 25s timeout, 1 retry on 429/5xx) → write `simulations` row + one `twin_responses` row per twin per round → record token usage.

Key files: `src/pages/{SimulationStudio,FocusGroupStudio,ABTestStudio,SimulationComparison}.tsx`, `supabase/functions/{simulate,simulate-focus-group,simulate-ab-test,seed-from-idea,suggest-next-test}`, `_shared/{multiTwin,aiClient,prompts}.ts`.

### 6.5 Calibration & validation — the trust/moat loop

**Fully-functioning:** a researcher can see, per segment, how accurately its twins predict real humans, and that score visibly improves studies-over-time.

| Requirement | Status | Detail |
|---|---|---|
| Calibration data capture | ✅ LIVE | Real responses matched to twin responses → `calibration_data` accuracy rows. |
| Validation Studies dashboard | 🔧 NEEDS-BUILD | `/validation` — global accuracy, per-segment table, AI-vs-real chart, monthly trend. Self-labeled **alpha**; its data fn `validation-report` is **not deployed**. Deploy + de-alpha. |
| Validation orchestration backend | ⏸️ PARKED | Full study-orchestration beyond the alpha; roadmap. The alpha banner is the honest promise level. |

Key files: `src/pages/ValidationStudies.tsx`, `supabase/functions/{validation-report,calibrate-segment,cron-calibration}`.

### 6.6 Real-human research suite — the hybrid half (most-deployed subsystem)

| Requirement | Status | Detail |
|---|---|---|
| Projects + AI research plan | ✅ LIVE | `/projects` — container; `generate-project-plan` returns objective/methodology/discussion-guide/screener, **bilingual EN/AR, MENA-aware** (Gulf context, gender separation, prayer times). |
| Surveys lifecycle + editor | ✅ LIVE | `/surveys` — 7 question types, go-live/pause/complete, auto-complete-at-target trigger. |
| AI survey question generation | ✅ LIVE | `generate-survey-questions` — objective → 6–10 questions. |
| Public response collection | ✅ LIVE | `/s/:surveyId` — display logic (`show_if`), piping (`{{Qn}}`), server-side validation, localStorage dedupe. |
| Survey distribution to participants | ✅ LIVE | `distribute-survey` — emails if `RESEND_API_KEY` set, else share-link fallback. |
| Sessions (interview/focus/UX) | ✅ LIVE | `/sessions` — schedule, transcript, notes (observation/bookmark/action-item), participants + incentive linkage, full-text transcript search. |
| AI transcript theme & sentiment | ✅ LIVE | `analyze-transcript` — 3–8 themes (title/desc/confidence/sentiment/quotes) → `session_themes`. |
| AI probe / follow-up generation | ✅ LIVE | `generate-probes` — moderator follow-ups from guide + transcript. |
| Audio/video auto-transcription | 🔧 NEEDS-BUILD | `transcribe-media` (Deepgram nova-2 + Whisper fallback) is **not deployed** and needs a provider key. Manual paste works regardless. |
| Insights hub + cross-session synthesis | ✅ LIVE | `/insights` — survey charts + `synthesize-insights` clustering (≥2 analyzed sessions) into named patterns; CSV/MD export. |
| Pattern-trend snapshots | ✅ LIVE | `pattern_snapshots` table **applied + verified on prod 2026-06-24** — trend badges now backed (was a graceful-fallback gap in v1.0). |
| Threaded comments | ✅ LIVE | Workspace-scoped, mounted on SessionDetail. *(Commenting on simulations is unbuilt — schema doesn't permit that entity.)* |
| Global full-text search | ✅ LIVE | Command-palette ranked search over transcripts/themes/patterns/notes (tsvector GIN). |
| Shareable research snapshot | ✅ LIVE | `/shared/:token` — public read-only branded session summary; print/PDF. |

Key files: `src/pages/{Projects,Surveys,SurveyRespond,Sessions,SessionDetail,Insights}.tsx`, the matching `supabase/functions/*`, migrations `20260403100000_requirements.sql`, `20260610120000_pattern_snapshots.sql`.

### 6.7 Participant marketplace — the hybrid supply side

**Fully-functioning:** real humans sign up, get matched to relevant studies, complete them, and get paid — giving researchers an on-demand validation panel and the platform its calibration data flywheel.

> ⚠️ **Two distinct participant systems by design** (a frequent bug source): `participants` = workspace-owned **panel/contact list** (researcher-side, fully live); `participant_profiles` = platform-wide **marketplace earning accounts** (the `/participate/*` portal).

| Requirement | Status | Detail |
|---|---|---|
| Enterprise "People" panel | ✅ LIVE | `/participants` — researcher CRUD, CSV import/export, quality score, GDPR erase, "open recruiting" → `study_listings`. |
| Participant signup + login | ✅ LIVE | `/participate/signup` (4-step) + role-gated login. *(Step 2–4 enrichment POSTs a GET/PATCH-only fn → later demographics silently dropped; account still created — see method-mismatch fix below.)* |
| Study participation lifecycle | ✅ LIVE | `study-participate` (POST) — accept/submit/approve/reject, earnings, 5/10/15% streak bonuses, referral payout on first study, tier/rating recompute. |
| Per-study match scores | ✅ LIVE | `participant-match-scores` — 0–100 match % powering feed badges/sort. |
| Realtime notification center | ✅ LIVE | `participant_notifications` bell, per-user RLS. *(Stays empty until the match-broadcast bug below is fixed.)* |
| Streaks / weekly bonus | ✅ LIVE | ISO-week streaks; bonus applied server-side. |
| **Fix POST-vs-GET method mismatch** | 🔧 NEEDS-BUILD | Dashboard/Earnings/Impact/Profile invoke `participant-profile`/`participant-impact` (GET/PATCH-only) via default **POST → 405** → empty reads; the StudyFeed read of `study-listing` (GET/POST/PATCH) via POST silently routes into its *create-listing* branch instead — arguably worse. Align client calls (or the fns) and deploy. |
| **Fix study-match broadcast** | 🔧 NEEDS-BUILD | `participant-match` inserts into `notifications` while readers use `participant_notifications` → alerts land where nothing reads. Wrong-table bug; also no caller. |
| Deploy participant fns | 🔧 NEEDS-BUILD | The `participant-*`, `study-listing`, `study-participate` fns are **absent from `config.toml`** — confirm deploy. |
| Earnings + cash-out | 🔧 NEEDS-BUILD | `participant-cashout` (≥$5) attempts a Tremendous **sandbox** order; also reads via the broken profile path. Fix reads + (separately) the payout rail. |

Key files: `src/pages/participant/*`, `supabase/functions/{participant-signup,participant-profile,participant-match,participant-match-scores,participant-impact,participant-referral,participant-cashout,study-listing,study-participate}`, migrations `20260405_participant_portal.sql`, `20260409110000_referrals.sql`, `20260409120000_streaks.sql`.

### 6.8 Incentives & payouts

| Requirement | Status | Detail |
|---|---|---|
| Incentive programs | ✅ LIVE | `/incentives` — cash/gift_card/points/etc., budgets, spent %, auto-pause on exhaustion; admin/owner gated. |
| Incentive disbursement | ✅ LIVE | `disburse-incentive` — membership + budget checks, approval threshold (default $100), Tremendous **sandbox** order for non-manual providers. |
| Incentive webhook | ✅ LIVE | `incentive-webhook` — provider callbacks flip status (dormant; sandbox). |
| Incentive budget pre-check | ⏸️ PARKED | `check-budget` deployed but no UI caller. |
| Incentive report export | 🔧 NEEDS-BUILD | `incentive-report` (CSV/JSON) not deployed + no UI; page export is client-side. Wire or retire. |
| **Production payout rail** | ⏸️ PARKED | Both cashout + disburse hit Tremendous **sandbox**; no prod key **by decision** (2026-06-02 — pay first 2–3 participants by hand when a real customer asks, then build the rail). |

Key files: `src/pages/{Incentives,IncentiveDetail}.tsx`, `supabase/functions/{disburse-incentive,incentive-webhook,check-budget,incentive-report}`.

### 6.9 Billing, tiers & monetization — the SaaS spine (solid)

| Requirement | Status | Detail |
|---|---|---|
| 4-tier subscriptions | ✅ LIVE | Free $0 / Starter $49 / Professional $149 / Enterprise custom (§10). |
| Edge tier enforcement | ✅ LIVE | `tierEnforcement.ts` — reads `workspaces.tier` (cache-first), 403 on caps, **fails closed** to free/503. |
| Token budget + rate limiting | ✅ LIVE | `rateLimiter.ts` — monthly token budgets (50K→10M) + req/min caps; meters post-call; fails closed. |
| Stripe Checkout / Webhook / Status / Portal | ✅ LIVE | `create-checkout`, `stripe-webhook` (verify_jwt=false — HMAC is the auth), `check-subscription`, `customer-portal`. Real product IDs mapped. |
| **Manual end-to-end Stripe pass** | 🔧 NEEDS-BUILD | Webhook verified with test sigs, but a real card→webhook→tier-flip has **never been run manually**. Owed before charging a live customer. |
| Usage meter | ✅ LIVE | Settings → Billing shows usage incl. AI tokens. |
| Tier-limit error → upgrade prompt | 🔧 NEEDS-BUILD | `parseTierLimitError` regex may not match the structured JSON edge error → upgrade prompt may not fire. Verify the contract. |

Key files: `src/lib/{tierLimits,tierLimitError}.ts`, `_shared/{tierLimitsData,tierEnforcement,rateLimiter}.ts`, `supabase/functions/{create-checkout,stripe-webhook,check-subscription,customer-portal}`.

### 6.10 Programmatic API & webhooks

**Fully-functioning:** a customer generates an API key in Settings and calls the simulation engine programmatically; events fire outbound webhooks. **Today this is dead plumbing behind a real-looking Settings tab.**

| Requirement | Status | Detail |
|---|---|---|
| API key management UI | ✅ LIVE | Settings → API & Webhooks — generate/list/revoke (`sk_live_` + hash, shown once) + cURL/Python docs. |
| **Unify API-key tables** | 🔧 NEEDS-BUILD | UI writes `api_keys`; gateway `api-simulate` authenticates against `workspace_api_keys` (no writer) → **issued keys can't call the API.** Pick one table; wire issuance to it. |
| **Deploy + fix API gateway** | 🔧 NEEDS-BUILD | `api-simulate` is **absent from `config.toml`** (deploy unconfirmed); 2 of 5 routes (`market_sim`→`simulate-market`, `policy`→`simulate-policy`) target functions that **don't exist** (404). Deploy; map only real engines. |
| Outbound webhooks | ⏸️ PARKED | `dispatch-webhook` deployed but **zero callers + no register UI**. Either wire events + a registration UI, or hide the tab until then. |

Key files: `src/pages/Settings.tsx` (API tab), `supabase/functions/{api-simulate,dispatch-webhook}`, migrations `20260311090000_api_keys.sql`, `20260328100000_api_keys_table.sql`.

### 6.11 Admin / super-admin console

| Requirement | Status | Detail |
|---|---|---|
| Super-Admin Command Center | ✅ LIVE | `/admin` — platform KPIs, tier bars, live audit feed, pending-payout alert. Gated by `super_admins` + RLS. |
| Tenant directory + deep-dive | ✅ LIVE | `/admin/tenants(/:id)` — tier filter, inline tier-change, CSV; 7-tab drill-down, suspend/reactivate. ⚠️ **"Delete Workspace Permanently" button has no onClick (stub).** |
| User / participant / studies directories | ✅ LIVE | `/admin/{users,participants,studies}` — read-only cross-tenant. |
| AI & token usage | ✅ LIVE | `/admin/ai-usage` — token/cost analytics (hard-coded $0.40/1M blended), heatmap, per-workspace quota. |
| Financial governance | ✅ LIVE | `/admin/financials` — bulk approve/reject payouts (flips status), budgets, earnings health. |
| Audit trail | ✅ LIVE | `/admin/audit` — append-only `audit_logs` viewer, filters, CSV, anomaly banner. |
| System configuration | 🔧 NEEDS-BUILD | `/admin/system` — 8 feature-flag toggles are **local `useState` only** (page itself says "connect a `platform_config` table"). Super-admin add/remove is the only persisted write. Persist the flags. |
| Projects / Requirements / Dashboard | ✅ LIVE | `/projects`, `/requirements` (Kanban + voting + comments + tours), `/dashboard` (real counts, onboarding, velocity chart). |
| Orphaned `AdminSettings` duplicate | ❌ KILLED | Superseded by AdminSystem; no route, zero imports — delete. |
| White-label branding | ❌ KILLED | `workspace_branding` schema-only remnant; no write path, nothing applies it. |

### 6.12 Trust, compliance & data rights

| Requirement | Status | Detail |
|---|---|---|
| Trust Center | ✅ LIVE | `/trust-center` — last 50 audit rows + security-posture cards. Copy is honesty-corrected (no unbacked SOC2/ISO/AES badges). |
| **Append-only audit immutability** | ✅ LIVE | `audit_logs` BEFORE UPDATE/DELETE trigger **applied + verified on prod 2026-06-24** (binds even service role; allows workspace cascade). *Upgraded from RLS-only since v1.0.* |
| Methodology page | ✅ LIVE | `/methodology` — honest digital-twin pipeline, model table, confidence/Bass formulas, limitations/ethics. |
| GDPR workspace data export | ✅ LIVE | `export-workspace-data` — full JSON export, logged. |
| GDPR participant erasure | ✅ LIVE | `erase-participant` — owner/admin deletes a *panel* `participants` record + scrubs quotes. *(Marketplace `participant_profiles` erasure is a `mailto:` — see backlog.)* |
| Trust Center "Export CSV" button | 🔧 NEEDS-BUILD | Has **no onClick** → clicking does nothing. Wire or remove. |
| Data retention purge | 🔧 NEEDS-BUILD | `cleanup-expired-data` is reachable but **never scheduled → never runs.** Add a pg_cron schedule. |
| Frontend Sentry observability | ⏸️ PARKED | Code complete; `initSentry()` no-ops without `VITE_SENTRY_DSN`. Revive when Mahmoud sets a DSN. |
| Supabase Pro / DB backups | ⏸️ PARKED | Prod is free-tier, no backups; keep-warm cron mitigates pause. Revive at first paying customer. |

### 6.13 Internationalization / MENA layer

**Fully-functioning:** the running UI is available in Arabic (RTL), and twins reason in MENA cultural context — the wedge made real.

| Requirement | Status | Detail |
|---|---|---|
| i18n engine | ✅ LIVE | `t()`/language/direction, lazy locale load, dir/lang + persistence. |
| MENA-aware research-plan generation | ✅ LIVE | `generate-project-plan` is bilingual EN/AR with Gulf context. |
| Ramadan mode (focus group) | ✅ LIVE | Seasonal-pattern toggle on twins. |
| **Enable Arabic UI** | 🔧 NEEDS-BUILD | `ENABLED_LANGUAGES=['en']`; `ar.json` ~82% + RTL still cosmetic. Finish ar translation + logical-property RTL sweep + flip the flag. **This is the wedge — highest strategic priority of the NEEDS-BUILD set.** |
| Other locales (fr/es/de) | ⏸️ PARKED | Files exist ~82%; enable per-language after translation is complete. |

Key files: `src/lib/i18n.tsx`, `src/locales/*`.

### 6.14 Growth surfaces

| Requirement | Status | Detail |
|---|---|---|
| Landing page | ✅ LIVE | `/` — hero, animated persona cards, pricing, CTA; honesty-corrected copy. |
| Three persona doors + attribution | ✅ LIVE | `/for-founders`·`/for-product-teams`·`/for-brands` — door stored to localStorage, `door_viewed` fired, attributed at signup. |
| Public demo | ✅ LIVE | `/demo` — real Gemini, 3 personas, 3/hr IP limit. *(Confirm `public-demo-simulate` deploy.)* |
| Landing InlineDemo | ✅ LIVE | ⚠️ **Scripted mock** (hardcoded response + fake spinner). Acceptable as a teaser, but the real demo is `/demo`. |
| PostHog analytics | ✅ LIVE | Funnel events wired; **inert without `VITE_POSTHOG_KEY`** — set the key to actually measure the funnel. |
| Founder-mode plain-language nav | ✅ LIVE | People/Interviews/Rewards/Confidence relabeling, tested. |
| Researcher notification bell | ✅ LIVE | `notifications` table, realtime, mark-read. |
| Mock "Referrals" tab (researcher Settings) | 🔧 NEEDS-BUILD | Invite code derived from workspace ID + static count; **no backend.** Wire a real researcher referral, or remove. |
| Index placeholder scaffold | ❌ KILLED | Leftover "Blank App" page, unreferenced — delete. |

---

## 7. AI architecture & the engine

**Single provider/model.** Every simulation runs on Google **`gemini-2.5-flash`** via Gemini's OpenAI-compatible Chat Completions endpoint, one `GEMINI_API_KEY`, through `_shared/aiClient.ts` (25s timeout, 1 retry on 429/5xx). Structured outputs use forced OpenAI-style tool-calls. **No Anthropic/OpenAI/Claude path anywhere in the engine.** Transcription is the only other AI: Deepgram nova-2 + Whisper fallback.

**Twin generation.** A per-segment persona system prompt is built from `segment_profiles` JSONB (with "Not specified" fallbacks) + the stimulus; Gemini returns `{response, sentiment −1..1, confidence, key_themes[], purchase_intent, emotional_reaction}`, persisted to `simulations.results` + one `twin_responses` row per twin.

**Multi-twin (PRD #17, `_shared/multiTwin.ts`)** — used by `simulate-focus-group` + `simulate-ab-test` only; solo `/simulate` is always one twin. **N per tier: free 2 / starter 5 / professional 8 / enterprise 10**, clamped so `segments × twins ≤ 40` (`MAX_TWINS_PER_RUN`; max paid run ≈ 40, **not 50**). Free uses **array mode** (one call returns N correlated draws — cheap); paid uses **varied mode** (N independent calls, each with a deterministic age-spread + one of 10 attitudinal leanings — genuinely independent draws), concurrency-capped at 8. `aggregateDistribution` rolls twins into mean/stdev sentiment, cross-segment consensus, objection rate, top themes, `sample_size`; under-counts reported honestly, never padded. **Status: code-complete, NOT deployed (§6.4) — prod is effectively N=1.**

---

## 8. System architecture

```
Browser SPA (Vite/React, Vercel, SPA rewrite)
   │  supabase-js (anon key, RLS-bound)        │ Stripe.js redirect
   ▼                                           ▼
Supabase project xwjvsmwefbukaswkwpbf          Stripe (Checkout, Portal, Webhook→stripe-webhook)
   ├─ GoTrue auth (email/pw + Google/GitHub/Twitter)
   ├─ Postgres + RLS (~45 tables, FTS, pg_cron + pg_net keep-warm)
   ├─ Storage: avatars (public), session-media (private)
   └─ 47 Deno edge functions
        ├─ AI: Gemini 2.5 Flash (OpenAI-compatible; _shared/aiClient.ts)
        ├─ Transcription: Deepgram nova-2 + Whisper fallback (undeployed)
        ├─ Payouts: Tremendous SANDBOX only (parked)
        └─ Observability: Sentry helper wired, DSN unset (parked)
```

**Edge auth posture (load-bearing):** nearly all functions run `verify_jwt=false` and do in-code `auth.getUser(token)` + `validateWorkspaceMembership()` (queries `workspace_memberships`; service-role bypasses RLS, so this check is the tenant boundary). Exceptions: `cron-calibration` + `marketplace-handler` (verify_jwt=true), `stripe-webhook` (**must stay** verify_jwt=false — HMAC is the auth; the 2026-06-03 gateway-401 outage is the cautionary tale).

**Fail-closed guarantees:** rate limiter + tier enforcement return 503 on lookup error; tier reads are DB-cache-first (`workspaces.tier`, written only by the webhook).

**Environments:** prod = free-tier Supabase (auto-pause mitigated by keep-warm cron; **no DB backups** until Pro). Local e2e: `supabase start` + `.env.test` (fail-closed preflight refuses non-localhost). CI: GitHub Actions account-frozen (billing); local pre-push gate (`tsc -p tsconfig.app.json` + `-p tsconfig.node.json` + vitest, blocking) protects `main`.

---

## 9. Data model (summary)

52 migrations (2026-03-08 → 2026-06-10). Entities that matter:

| Area | Tables | Notes |
|---|---|---|
| Tenancy | `workspaces`, `workspace_memberships`, `profiles`, `super_admins` | Tier limits via BEFORE INSERT triggers. `user_roles` legacy. |
| Twins & simulation | `segment_profiles`, `simulations`, `twin_responses`, `calibration_data` | `simulations.type` CHECK still lists vestigial `policy`/`market_sim`. |
| Real research | `projects`, `surveys`(+`survey_questions`/`survey_responses`), `sessions`(+`session_participants`/`session_transcripts`/`session_themes`/`session_notes`/`session_probes`/`session_media`), `insight_patterns`, `synthesis_runs`, `pattern_snapshots` (**applied 2026-06-24**), `requirements`(+comments/votes) | **Naming trap: `sessions` = human; `simulations` = AI.** |
| Panel & incentives | `participants`, `participant_tags`, `incentive_programs`, `incentive_disbursements`, `participant_points_ledger` | Workspace-scoped. |
| Marketplace portal | `participant_profiles`, `study_listings`, `study_participations`, `participant_earnings`, `participant_reputation`, `participant_referrals`, `participant_notifications` | Platform-wide (user-scoped). **Distinct from `participants`.** |
| Billing & quota | `workspace_token_usage` (monthly), `workspace_token_usage_log` (per-request; cleanup is a TODO) | Written by `recordTokenUsage()` + webhook. |
| Extensibility | `workspace_api_keys` (gateway reads, no writer), `api_keys` (UI writes), `webhooks`, `webhook_deliveries`, `workspace_integrations`, `workspace_branding` | Last two vestigial (killed). API-key split = §6.10. |
| Audit/infra | `audit_logs` (append-only trigger live), `workspace_activity`, `keep_warm_heartbeat` | |

**View:** `marketplace_segments` (`security_invoker=true` since 2026-06-03 — do not revert to DEFINER).

**Key functions/triggers:** `handle_new_user()`, `is_workspace_member()`/`has_workspace_role()` (SECURITY DEFINER, power RLS), tier-limit triggers, `get_shared_snapshot(token)`, `keep_warm()`, `global_search()`/`search_transcripts()`, `audit_logs` append-only trigger.

---

## 10. Tiers, pricing & quotas (canonical numbers)

Source of truth: `src/lib/tierLimits.ts` + DB triggers + `_shared/tierLimitsData.ts` (mirrored; `src/test/tierParity.test.ts` fails the suite if they diverge).

| | Free $0 | Starter $49/mo | Professional $149/mo | Enterprise (custom) |
|---|---|---|---|---|
| Members | 3 | 10 | 25 | unlimited |
| Sessions | 10 | 50 | 200 | unlimited |
| Surveys | 5 | 25 | 100 | unlimited |
| Projects | 2 | 10 | 50 | unlimited |
| AI tokens / month | 50,000 (≈3 sims) | 500,000 | 2,000,000 | 10,000,000 |
| AI requests / minute | 3 | 10 | 30 | 100 |
| **Twins / segment** (multi-twin) | 2 | 5 | 8 | 10 |

**Enforcement is layered:** frontend `TierGate` (UX + paywall events) → DB triggers (hard INSERT gates) → edge `enforceTierLimit` + `checkRateLimit` (AI/token/rate; fail-closed 503). Free `aiAnalysis=true` is deliberate (the 50K-token trial is the activation engine).

---

## 11. Security & compliance posture

- **RLS on all public tables** (advisor 0 ERROR-level lints). Policies built on `is_workspace_member`/`has_workspace_role`.
- **Tenant boundary in edge functions** = JWT validation + `validateWorkspaceMembership` (mandatory wherever a service-role client is used).
- **Webhook auth:** Stripe HMAC (`constructEventAsync`); signature bypass only when `SUPABASE_URL` is localhost.
- **Cron auth:** `x-cron-secret`, constant-time compare, fail-closed when unset.
- **Audit immutability:** append-only trigger live on prod (§6.12).
- **Secrets hygiene:** `.env` untracked (public `VITE_*` only); Supabase PAT in macOS Keychain.
- **Data rights:** export, panel-participant erasure, retention window per workspace (GDPR/PDPL flags).
- **Known gaps:** no `vercel.json` security headers (CSP/X-Frame-Options/HSTS); Sentry DSN unset (prod errors ≈ console logs); no DB backups on free tier; marketplace-participant self-erasure is `mailto:` only.

---

## 12. Non-functional requirements

| Dimension | Target | Status |
|---|---|---|
| Type safety | `tsc` clean on app + node projects | ✅ (strict mode off — `noImplicitAny`/`strictNullChecks` false; ~218 `any`s — refactor risk) |
| Unit/integration tests | green on every push | ✅ vitest (159/159 at last session) |
| E2E | core flows green on local stack | ✅ 4 Playwright specs (Stripe/AI/payout **mocked**) |
| Observability | prod errors visible | 🔧 NEEDS-BUILD (Sentry DSN unset) |
| Security headers | CSP/X-Frame/HSTS | 🔧 NEEDS-BUILD (`vercel.json`) |
| Backups | daily DB backup | ⏸️ PARKED (Supabase Pro) |
| CI | automated gate on PRs | 🔧 NEEDS-BUILD (Actions account-frozen; local pre-push gate compensates) |
| Performance | sim result < ~30s p95 | ✅ (25s Gemini timeout + 1 retry) — re-confirm under multi-twin fan-out |

---

## 13. Success metrics

- **Activation:** % of signups that run ≥1 simulation/focus group (`signup_completed` → `simulation_run`/`focus_group_run`).
- **Iteration depth (aha proxy):** simulations per active workspace per week; share of runs launched from a suggestion card (instrument as a distinct event — currently not tracked).
- **Hybrid adoption:** % of workspaces that run ≥1 real survey/session; segments reaching **Calibrated (≥0.6)** — the moat becoming measurable.
- **Monetization funnel:** `paywall_viewed` → `upgrade_clicked` → `checkout_started` → `checkout_completed`; MRR/churn in `/admin/financials`.
- **Door attribution:** signup → activation → paid, split by `door` (founders/product-teams/brands) — which audience converts.
- **Guardrail:** monthly token spend vs budget; error rate (once Sentry lands).

> No fabricated benchmarks — any external claim (accuracy %, market stats) must pass `docs/CLAIMS_TO_VERIFY.md`.

---

## 14. Gap-to-v1 backlog (the NEEDS-BUILD list, prioritized)

The consolidated, ordered path from "as it runs today" to "fully functioning v1." Each item links to its §6 requirement.

### P0 — unblock the core promise
1. **Generate a fresh Supabase PAT** (Mahmoud-only) — hard blocker on everything deploy-related.
2. **Deploy + verify multi-twin** (§6.4) — `simulate-focus-group` + `simulate-ab-test`; confirm the live Gemini round-trip and real `tokens_used` vs the scoping cost table. *Until done, prod is N=1 and the "50/statistical" copy ban stands.*
3. **Confirm all `simulate-*` fns are actually deployed** (§6.4) — the most load-bearing code is the least config-certain.
4. **Multi-twin distribution UI** (§6.4) — surface mean±stdev / spread / "N twins"; then ship the honest "dozens" copy.

### P1 — make the hybrid + monetization real
5. **Manual end-to-end Stripe pass** (§6.9) — card → webhook → tier flip, before charging anyone.
6. **Deploy + verify calibration/validation** (`calibrate-segment`, `validation-report`) and de-alpha `/validation` (§6.5) — this is the moat loop.
7. **Fix the participant marketplace** (§6.7) — the POST-vs-GET 405 mismatch (Dashboard/Earnings/Impact/Profile/Referrals), the wrong-table match broadcast, and deploy the `participant-*` fns.
8. **Enable Arabic UI** (§6.13) — finish `ar.json` + RTL sweep + flip `ENABLED_LANGUAGES`. The wedge made real.

### P2 — close the dead-plumbing & polish gaps
9. **Make the programmatic API functional** (§6.10) — unify the API-key tables, deploy `api-simulate`, drop the 404 routes.
10. **Wire the canonical MENA prompt stack** (§6.4) — realize `twin-orchestrator`/`prompts.ts` or formally retire them.
11. **Schedule `cleanup-expired-data`** (§6.12) so retention actually runs.
12. **Persist admin feature flags** + wire the delete-workspace button (§6.11).
13. **Deploy `transcribe-media`** + set a provider key (§6.6).
14. **Decide webhooks** (wire or hide), **decide referrals tab** (wire or remove), **wire Trust Center Export CSV** (§6.10/6.14/6.12).

### P3 — hygiene
15. Replace the boilerplate `README.md`; set `VITE_POSTHOG_KEY` (measure the funnel); add `vercel.json` security headers; delete dead code (`AdminSettings`, Index scaffold, vestigial tables); bump dev-only vite vulns.

### Standing (Mahmoud-owned, not code)
- Pay ~$52 GitHub bill → unfreezes Actions.
- Set Sentry DSN → revive observability.
- Supabase Pro + backups → at first paying customer.

---

## 15. Parked & killed scope

### Parked — built/designed, deliberately inactive
| Item | State | Revive when |
|---|---|---|
| Production participant payouts | Portal + Tremendous sandbox wired; no prod key | A customer asks; pay first 2–3 by hand first. |
| Segment Templates (ex-Marketplace) | `marketplace-handler` + view; no UI | Reshape as a starter-template library with supply+demand evidence. |
| Multilingual fr/es/de | Locales ~82% | Per language: finish translation, then enable. |
| Frontend Sentry | Code complete, no DSN | DSN + Vercel env set. |
| Supabase Pro / backups | Keep-warm mitigates pause | First paying customer. |
| Validation orchestration backend | Alpha UI + cron live | Roadmap beyond alpha. |
| Outbound webhooks | Deployed, no callers/UI | Real event wiring + registration UI. |
| Incentive budget pre-check | Deployed, no caller | Wire into the disbursement flow. |

### Killed 2026-05-19 (PR #22) — do not revive without re-opening the decision
Policy Simulator · Custom Twin Builder · White-Label UI · Integrations Tab (Slack/Zapier/Jira) · standalone Market Simulator page. Vestigial DB remnants (`workspace_integrations`, `workspace_branding`, `simulations.type` enum values) are harmless cleanup candidates.

---

## 16. Open questions & near-term owed work

Tracked canonically in the vault (`open-questions.md`). Live as of 2026-06-24:
- **Generate a fresh Supabase PAT** — the hard blocker on all deploys.
- **Manual real-Stripe + payout pass** before charging a live customer.
- **Pay ~$52 GitHub bill** → unfreezes Actions (root cause is the other repo).
- Whether the Supabase MCP (connected this session) offers a deploy path around the dead PAT — worth a probe.

---

## Appendix A — Route map

**Public:** `/` · `/for-founders` · `/for-product-teams` · `/for-brands` · `/login` · `/signup` · `/forgot-password` · `/reset-password` · `/auth/callback` · `/demo` · `/s/:surveyId` · `/shared/:token`
**App (ProtectedRoute):** `/dashboard` · `/projects(/:id)` · `/surveys(/:id)` · `/sessions(/:id)` · `/studio/:id` · `/segments` · `/simulate(/:id)` · `/focus-group` · `/ab-test` · `/simulations/compare` · `/insights` · `/participants` · `/incentives(/:id)` · `/requirements(/:id)` · `/validation` · `/methodology` · `/trust-center` · `/settings`
**Participant (ParticipantRoute):** `/participate/{login,signup,dashboard,studies,earnings,impact,referrals,my-twin,profile}`
**Admin (SuperAdminRoute):** `/admin` · `/admin/{tenants(/:id),users,participants,studies,ai-usage,financials,audit,system}`

## Appendix B — Edge functions (47, by pipeline)

- **Simulation:** `simulate`, `simulate-focus-group`, `simulate-ab-test`, `seed-from-idea`, `suggest-next-test`, `public-demo-simulate`, `api-simulate`, `twin-orchestrator`, `calibrate-segment`
- **Billing:** `create-checkout`, `stripe-webhook`, `check-subscription`, `customer-portal`
- **Research suite:** `generate-project-plan`, `generate-survey-questions`, `distribute-survey`, `submit-survey-response`, `analyze-transcript`, `transcribe-media`, `summarize-session`, `generate-probes`, `synthesize-insights`, `suggest-methodology`, `seed-sample-project`
- **Participants/incentives:** `participant-{signup,profile,match,match-scores,impact,referral,twin-preview,cashout}`, `study-listing`, `study-participate`, `disburse-incentive`, `check-budget`, `incentive-report`, `incentive-webhook`
- **Workspace/admin/infra:** `invite-member`, `list-workspace-members`, `export-workspace-data`, `erase-participant`, `cleanup-expired-data`, `dispatch-webhook`, `marketplace-handler`, `validation-report`, `cron-calibration`

> **Deploy reality:** functions in `supabase/config.toml` are deploy-declared; many `simulate-*` and `participant-*` fns are **absent** from it (§14 P0.3). Auth pattern: in-code JWT + `validateWorkspaceMembership` (verify_jwt=false) except `cron-calibration`/`marketplace-handler` (true) and `stripe-webhook` (HMAC).

## Appendix C — Glossary

| Term | Meaning here |
|---|---|
| **Segment / digital twin** | One synthetic consumer persona (`segment_profiles` row); "twin" in UI, "segment" in code. |
| **Simulation** | An AI run (`simulations`): solo, focus_group, or ab_test. *Not* a human session. |
| **Session** | A real-human research session (`sessions`): interview/focus group with recording/transcript. |
| **Multi-twin** | N distinct sampled twins per segment (vs N=1); produces a distribution, not a point estimate. |
| **Consensus score** | Agreement *across segments* (0–1); computed from per-segment means so within-segment spread doesn't deflate it. |
| **Calibration** | Matching twin responses to real responses to score segment accuracy (0–1); drives New/Calibrating/Calibrated badges. |
| **Aha loop** | seed-from-idea → run → dominant objection + explored axes + 3 next tests → one-click re-run. |
| **Hybrid loop** | synthetic finding → real-human validation → calibration → more trustworthy synthetic. The moat. |
| **Panel vs marketplace participant** | `participants` = workspace-owned contact list; `participant_profiles` = platform-wide earning account with portal. |
| **Door** | A persona-specific landing variant (`/for-*`); copy only, never architecture. |
