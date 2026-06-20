# Scoping — multi-twin sampling per segment (PRD #17, AUDIENCE_MAP build item #1)

**Date:** 2026-06-12 · **Status:** DECIDED + BUILT (code-complete; deploy + live token verification owed).

**Decisions locked 2026-06-12 (Mahmoud):** sampling = **hybrid** (free → single-call array, paid → varied sub-personas); N per tier = **free 2 / starter 5 / professional 8 / enterprise 10**; scope = **focus-group + A/B together**.

**Built:** `supabase/functions/_shared/multiTwin.ts` (pure, 34 unit tests) + wired into `simulate-focus-group` and `simulate-ab-test`. Concurrency-capped (≤8 in-flight), resilient to partial Gemini failures, distribution-aware aggregate. Independent review: 0 CRITICAL, 2 HIGH (fixed). **Not yet deployed** (prod PAT was down); the per-call token estimate (~1k) is still unconfirmed against a real run — verify at deploy.

---

The engine asks **one** twin per segment, so a "focus group" is 2–5 simulated customers and the positioning's "50 AI-simulated customers" is false (PRD #17). This is the design + cost analysis for fixing it. **Nothing here is built yet.**

---

## 1. How it works today (verified in code)

- **Focus group** (`simulate-focus-group/index.ts`): `K` segments × `R` rounds = **K×R Gemini calls**. Round 0 runs in parallel (`segments.map` → `Promise.all`); rounds 1+ are sequential (each twin sees the others' prior round). One call = one persona's reaction (`callGemini`, `gemini-2.5-flash`, structured output). Typical run K=3, R=2 → 6 calls.
- **A/B** (`simulate-ab-test/index.ts`): per segment, one call per variant → **2K calls**. Winner declared on a **0.05 average-sentiment margin** across those K responses (same small-n weakness).
- **Aggregation:** `consensus_score = 1 − stdev(all sentiments)`; the "sample" whose spread you're measuring is **the segments**, not consumers.

### The load-bearing insight (changes the whole risk picture)

Rate limiting counts **edge-function invocations, not Gemini calls.** `checkRateLimit` runs once per request; `recordTokenUsage` runs once at the end and increments `request_count` by **1** per run (`rateLimiter.ts`). So adding N twins/segment:

- ❌ does **not** consume more of the per-minute limit (free = 3 *runs*/min, unchanged), and
- ✅ **only** consumes more of the **monthly token budget**.

That makes this a pure cost-vs-credibility dial — no rate-limit redesign needed. The one mechanical caveat: round 0's `Promise.all` would fan out to K×N concurrent Gemini calls (up to 5×N), which hits **Gemini's** own RPM — so the build needs a concurrency cap (batch the fan-out), independent of the budget question.

---

## 2. The cost dial (the decision)

Token budgets/month: **free 50k · starter 500k · pro 2M · enterprise 10M.** Assuming **~1,000 tokens/call** (estimate from prompt sizes — persona ~450 + stimulus + structured output; **confirm against `simulations.tokens_used` once prod access is back**), for a typical K=3, R=2 run:

| N (twins/segment) | calls/run | tokens/run | **free** runs/mo | **starter** runs/mo |
|---|---|---|---|---|
| **1 (today)** | 6 | ~6k | ~8 | ~83 |
| 3 | 18 | ~18k | ~2–3 | ~27 |
| 5 | 30 | ~30k | ~1 | ~16 |
| 8 | 48 | ~48k | **<1 — breaks the trial** | ~10 |
| 10 | 60 | ~60k | **0 — exceeds budget** | ~8 |

**The headline:** N divides how many runs a free user gets. At **N≥5 the free trial dies** unless N is tier-scaled or the free budget rises. A single max-size run (K=5, R=3) at N=10 = 150 calls ≈ 150k tokens — fine for pro, ~3 runs for starter, impossible for free.

**Recommendation: tier-scaled N**, so paid users get statistical power and free keeps a usable trial:

| Tier | Suggested N | Why |
|---|---|---|
| free | **2** | keeps ~4 runs/mo (vs 8 today) — trial survives, "focus group" stops meaning "one person" |
| starter | **5** | ~16 runs/mo; the first n with a real distribution |
| professional | **8** | ~10 full runs/mo; credible spread |
| enterprise | **10** | headroom |

Caps regardless of tier: total twins per run `K×N ≤ 40` and a concurrency cap of ~8 simultaneous Gemini calls.

---

## 3. Sampling strategy (quality vs build)

How do you get N *distinct* reactions from one segment?

| | **A. Temperature-only** | **B. Varied sub-personas** (recommended) | **C. Single-call array** |
|---|---|---|---|
| Method | Same persona prompt, N times, rely on sampling temperature | Perturb one axis per twin within the segment (age within range, one psychographic) so each is a distinct individual | One call: "role-play N distinct people from this segment," return an array |
| Tokens | N× (full multiplier above) | N× (full multiplier) | **~1× + larger output** (cheapest) |
| Concurrency risk | High (K×N calls) | High (K×N calls) | **None** (1 call/segment) |
| Validity | Weak — twins cluster, false consensus | **Best** — realistic within-segment spread | Medium — LLMs caricature/correlate when generating N people at once; output-token cap limits N |
| Build | Trivial | Moderate (perturbation logic + prompt) | Moderate (array schema + parsing) |

**B** gives the most defensible distribution (the actual point of the exercise). **C** is the budget/concurrency-friendly fallback that keeps the free trial cheap — worth considering specifically for the free/starter tiers. **A** isn't worth it.

---

## 4. The upside (why this is worth doing)

With N per segment you can finally report **distributions, not point estimates**: mean sentiment **± stdev** per segment, within-segment agreement vs the old between-segment-only consensus, and "X of N twins raised this objection." That error-bar reporting is exactly the credibility floor the brand door needs — and it makes the aha-loop's "dominant objection, % affected" statistically honest. The `twin_responses` table already stores one row per twin (`twin_index`), so the raw data model needs only a richer `twin_index` scheme (round × segment × twin) — **no schema migration.**

---

## 5. Scope & non-goals

- **In scope:** `simulate-focus-group` (primary) and `simulate-ab-test` (same mechanism gives the winner a defensible n). `simulate` (solo) stays N=1 by definition.
- **No schema change**, **no rate-limit change**, **no new edge function** — this is internal to the two functions + the aggregation. Stays inside the "doors not products" rule.
- **Not** building benchmarks/norms (that's the brand moat, gated separately) or visual stimulus.
- Frontend: results UI should show the new spread (error bars / "N twins") — a follow-up after the engine returns it.

---

## 6. Decisions needed before coding

1. **Sampling strategy** — B (varied sub-personas, best validity) or C (single-call, cheapest/free-tier-safe), or B-for-paid / C-for-free?
2. **N per tier** — adopt the 2 / 5 / 8 / 10 table, or different?
3. **Scope** — focus-group only now, or focus-group + A/B together?

Once set: implement behind the existing token accounting (it already meters per run), verify a real run's `tokens_used` against the table above, and update the "50" positioning + landing copy to match what the engine now actually does.
