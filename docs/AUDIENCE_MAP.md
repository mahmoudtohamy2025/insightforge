# Audience map — founder vs product team vs brand manager (v2)

**Date:** 2026-06-12 · **Status:** analysis only, nothing decided · **Question:** are these three products, or three doors into one engine?
**v2:** revised after an adversarial pass that found five holes in v1 — corrected brand-blocker (validity, not pricing), the sample-size problem, the PM collaboration gap, honest MENA-depth claims, and a demand-test method that works at zero traffic.
**Companion to:** [PRD.md](PRD.md) (as-built; see known issue #17) and the 2026-05-19 positioning lock.

---

## The engine, stripped to its primitive

> **stimulus → simulated segment reactions → dominant objection → three next tests**

(`/focus-group`, `/simulate`, `/ab-test` → `suggest-next-test` → Bass projection — PRD §5.4–5.5.)

**The engine fact that colors everything below (v2):** each segment answers with **one** twin — a "focus group" is 2–5 simulated customers, and the A/B winner is a 0.05 average-sentiment margin over 2–5 single responses. Meanwhile the locked positioning promises "asking **50** AI-simulated customers." This n-per-segment gap is (a) an honesty issue for every persona, (b) the credibility ceiling for brand use, and (c) fixable with one engine investment — **multi-twin sampling per segment** — that serves all three audiences at once. It outranks any door-building. (PRD #17.)

---

## Job-to-be-done, per persona

| | **Solo founder** | **Product team (PM)** | **Brand manager** |
|---|---|---|---|
| **The job** | "Should I build/price/position it this way? Tell me today, no research budget." | "Which roadmap option survives contact with users? I need evidence that aligns stakeholders." | "Will this message/claim/campaign land with our segment before media spend?" |
| **The stimulus** | An idea, a price, a positioning sentence | A feature concept, two roadmap options | Ad copy, claims, taglines; eventually visual creative |
| **Output needed** | A decision + next test (the aha loop, verbatim) | A circulating artifact the team can argue about, plus an audit trail | Percentile-style judgment vs. norms ("70th percentile for the category") |
| **Pays** | Own card, $0–49/mo | Company card, $49–149/mo | **Subscription too** (Zappi/quantilope model) — per-study is the *agency* norm, not the in-house one (v1 had this backwards) |
| **Real blocker in our product** | Unvalidated fit (zero live users — lowest build-cost persona, not a proven one) + the "50 customers" promise vs n=2–5 | Results can't be discussed in-app: `comments` CHECK allows pattern/theme/session/survey — **not simulations**; share-links are sessions-only. Today's PM loop = export PDF, email it. | **Validity norms, not pricing and not visuals.** Ad pre-testing runs on benchmark databases; "sentiment 0.42 from 3 personas" is un-actionable for a CMO. Our calibration is alpha with zero norm data — a chicken-and-egg moat we cannot shortcut. |
| **Engine delta** | None beyond multi-twin sampling (shared) | Small: extend comments to simulations (+ a panel) | Visual stimulus is *small* (Gemini 2.5 Flash is multimodal — days of plumbing, v1 overweighted it). Benchmarks are *large* (needs a customer base). |
| **MENA depth (honest)** | Nice-to-have | Nice-to-have | Real but thin as-built: one Ramadan toggle + user-filled `cultural_context` JSONB with "Not specified" fallbacks. AUDIT's "6-layer dialect-aware prompt stack" is not in the shipped prompts. Arabic *stimulus* does work today (Gemini handles it). Don't oversell. |

---

## Where each persona already lives in the codebase

- **Founder** — the entire default experience (`src/lib/founderResearchCopy.ts` frames the sidebar for them). Ship: nothing.
- **Product team** — latent and unmarketed: `/requirements` (research-request intake with statuses, voting, stakeholder workflow — no founder uses this), `/projects` AI research plans, `/insights` patterns + CSV/MD export, PDF export, seats/roles. Gap: simulation comments (above).
- **Brand manager** — latent in `/ab-test` + segment cultural context. Honest scope today: message/claims/copy pre-testing at small n, no visuals, no norms.

## What each door tempts you to revive (pre-committed thresholds)

| Temptation | Status | Revive only when |
|---|---|---|
| Integrations tab (PM: "push to Jira/Slack") | Killed 2026-05-19 | ≥3 paying PM workspaces ask unprompted |
| White-label (agency/brand) | Killed 2026-05-19 | A paying agency asks, with a number attached |
| Benchmark/norms claims to brands | Never existed | Calibration graduates from alpha **and** there's real norm data — never promise percentiles before then |
| Visual-creative stimulus | Never built | A brands door converts on copy-testing first |

---

## Verdict (v2)

**Still three doors, one engine — with a changed build order.** Founder and PM converge on the identical primitive; their differences are vocabulary, templates, artifacts. Brands are the furthest door — not because of pricing (v1 was wrong) or visuals (small), but because decision-grade validity needs norms we can't fabricate.

**The build queue that survives the holes, in order:**
1. **Multi-twin sampling per segment** (engine, needs scoping; token cost scales with N) — one investment that makes the "50 customers" positioning true, gives A/B a defensible n, and is the prerequisite for any brand credibility. PRD #17.
2. **Simulation comments + share** (small; the one genuine PM item).
3. **Three landing-page doors** — only once there is traffic or spend to send through them.

**The demand test (v2 — corrected):** at ~zero traffic, door analytics produce noise for months. The real test is **ten manual outreach conversations per persona** (~2 weeks): pitch each persona their own framing, ask what they'd pay, watch which one leans in. Doors + the PostHog `door` property come *after* something is driving visitors.

**Decision rules:**
- Copy / templates / landing / onboarding per persona → green light.
- Anything touching `supabase/functions/` or the schema for a persona → it's trying to become a second product; check the threshold table first.
- No "50", no "statistical", no percentile/benchmark language in any external material until the engine work above ships (the landing's "statistical preference scores" was reworded 2026-06-12).
