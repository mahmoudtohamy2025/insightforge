# Claims to verify before external use

This checklist captures every unverified factual claim in `InsightForge_Digital_Consumer_Twins_Brainstorming.docx` (the strategic brainstorm at the repo root). Source: a Codex CLI polishing pass from April 2026 that explicitly flagged each one — see [project_kill_list_decisions.md memory file](https://github.com/mahmoudtohamy2025/insightforge) for context.

---

## ✅ Verification pass — 2026-05-30

A web fact-check was run on the 🔴 / 🟡 / 🟠 items below. **Verdict tags used inline:**

- **✅ VERIFIED** — confirmed against a real source; safe to keep as written (box checked).
- **❌ WRONG** — claim is false or misattributed; **fix or cut in the `.docx`** (box left unchecked).
- **⚠️ NO SOURCE** — could not be verified after genuine searching; cut it or relabel it as an estimate (box left unchecked).
- **📝 INTERNAL** — your own modeling assumption; not web-verifiable. Present as an assumption, never as an established fact.
- **⚖️ COUNSEL** — legal item; a factual summary is provided but it is **not legal clearance**. Counsel review still required.

**Headline finding — corrected 2026-05-30 after reading the live `.docx`.** An earlier pass (sourced from the April 2026 Codex paraphrase) suspected the competitor table misattributed five stats. **Reading the actual document disproved that — the live doc attributes them correctly.** The misattribution was in the *checklist's source phrasing*, not your document:

| The April paraphrase pinned… | …but the live doc correctly credits | Stat |
|---|---|---|
| "Synthetic Users" $50M+/$1B | **Aaru** | $50M+, $1B valuation |
| "Yabble" 300K personas / 50+ countries | **Ditto** | 300K+ personas / 50+ countries |
| "Toluna" Booking.com saves 50% | **Qualtrics Edge Audiences** | Booking.com ~50% cost reduction |
| "Strella" synthetic from 79M panelists | **Toluna** | 79M-participant panel |
| "Remesh" 1M personas / 15 markets / 9 langs | **Toluna** | 1M personas / 15 markets / 9 languages |

So **no edit was needed for these** — the doc's Section 2.1 table is already right (the names Yabble / Strella / Remesh don't even appear as funding rows in the doc).

**Genuine doc errors — FIXED in the `.docx` on 2026-05-30 (clean edits; pre-edit backup at `../InsightForge_Digital_Consumer_Twins_Brainstorming.backup-2026-05-30.docx`):**
- ✅ **Gartner stat removed** — the fabricated "60% of product marketing teams by 2028" was deleted from both the intro (§1) and the conclusion (§10).
- ✅ **Gallup / 85% attribution fixed** — the Simile row now reads "85% GSS replication accuracy (Stanford, 2024); Gallup research partnership," crediting the benchmark to Stanford rather than Gallup.

**Also fixed in the doc 2026-05-30 (per follow-up go-ahead):**
- ✅ **"$1.5B+ VC" softened to "hundreds of millions"** — in both the intro (§1) and the conclusion (§10). The inflated $1.5B figure (vs ~$150M actually documented) is gone.
- ✅ **Aaru "$1B+ valuation" → "$1B headline valuation (blended lower)"** — corrected in the intro and in the Section 2.1 table cell ("$50M+ ($1B headline)").

All four genuine doc errors (Gartner ×2, Gallup/85%, $1.5B ×2, Aaru ×2) are now corrected in `InsightForge_Digital_Consumer_Twins_Brainstorming.docx`. The competitor-attribution table needed no changes — it was already correct. Pre-edit backup: `../InsightForge_Digital_Consumer_Twins_Brainstorming.backup-2026-05-30.docx`.

---

**How to use this:**

1. **Before any external send** (investor deck, enterprise prospect, conference talk, blog post): work top-to-bottom through the 🔴 and 🟡 items. Replace flagged claims with sourced versions, or remove them.
2. **Before the 90-day strategic execution starts:** clear the 🟠 legal block with IP counsel.
3. **🟢 items** are fine to defer — they're directional and don't carry external-blame risk.

---

## 🔴 Competitor funding, valuation, and customer claims

Public-record claims (or should be) — easy to fact-check, brutal if wrong.

- [x] **Simile raised $100M Series A in February 2026** to build AI digital twins — **✅ VERIFIED.** $100M Series A led by Index Ventures (w/ Bain Capital Ventures, Fei-Fei Li, Andrej Karpathy), announced Feb 12 2026. *[SiliconANGLE, 2026-02-12](https://siliconangle.com/2026/02/12/ai-digital-twin-startup-simile-raises-100m-funding/). (Primary press release not directly retrieved — treat round detail as well-corroborated secondary.)*
- [ ] **Aaru crossed $1B valuation** (which year / which round?) — **✅ VERIFIED w/ nuance — adjust wording.** It was a **Series A in Dec 2025** led by Redpoint at a **$1B *headline* valuation**; a multi-tier round meant the *blended* valuation was **below $1B**. Don't say "crossed $1B" flat — say "$1B headline valuation, Series A, Dec 2025." *[TechCrunch, 2025-12-05](https://techcrunch.com/2025/12/05/ai-synthetic-research-startup-aaru-raised-a-series-a-at-a-1b-headline-valuation/).*
- [x] **Listen Labs: $69M Series B, $100M total raised** — **✅ VERIFIED.** $69M Series B led by Ribbit Capital (Jan 2026), $100M total, $500M valuation. *[PRNewswire, 2026-01](https://www.prnewswire.com/news-releases/listen-labs-raises-69-million-series-b-to-bring-customer-voices-into-every-decision-302661000.html).*
- [x] **Listen Labs: 1M+ interviews completed, Microsoft and Robinhood as clients** — **✅ VERIFIED.** "Interviewed over one million people"; named clients incl. Microsoft, Robinhood, Sweetgreen, Perplexity. *[PRNewswire, 2026-01](https://www.prnewswire.com/news-releases/listen-labs-raises-69-million-series-b-to-bring-customer-voices-into-every-decision-302661000.html).*
- [ ] **Synthetic Users: $50M+ raised, $1B valuation reported** — **❌ WRONG — misattribution.** No source supports this for Synthetic Users; its backers are accelerator-tier (Comcast LIFT Labs, Urban Innovation Fund). **The $1B / $50M+ figures belong to Aaru.** Either cut, or correct to Synthetic Users' real (early-stage) funding. *[Crunchbase — Synthetic Users](https://www.crunchbase.com/organization/synthetic-users); [TechCrunch — Aaru $1B](https://techcrunch.com/2025/12/05/ai-synthetic-research-startup-aaru-raised-a-series-a-at-a-1b-headline-valuation/).*
- [ ] **Yabble: 300K+ personas, 50+ countries, self-serve** — **❌ WRONG — misattribution.** "300K+ personas / 50+ countries" is **Ditto's** figure. Yabble cites ~**60M consumers in 45 countries** (and was acquired by YouGov, Aug 2024). *Self-serve IS correct.* *[Yabble](https://www.yabble.com/virtual-audiences).*
- [ ] **Toluna: 70M+ real panel base; Booking.com reportedly saves 50% using it** — **❌ PARTIALLY WRONG.** Panel is **79M** (so "70M+" is directionally fine but imprecise). **The "Booking.com saves ~50%" case is Qualtrics Edge Audiences, NOT Toluna.** Move it. Toluna's own cited savings are ~25–40%. *[Qualtrics Community, 2025-12-18](https://community.qualtrics.com/announcements-2/a-new-way-to-get-research-insights-online-synthetic-panels-with-edge-audiences-32914).*
- [ ] **Strella / similar: synthetic from 79M real panelists** — **❌ WRONG.** Strella **pivoted away from** synthetic respondents (no willingness to pay) and now runs AI-moderated live interviews ($14M Series A; Amazon, Chobani). The **79M panel is Toluna's.** *[VentureBeat, 2025-10](https://venturebeat.com/technology/amazon-and-chobani-adopt-strellas-ai-interviews-for-customer-research-as).*
- [ ] **Remesh / similar: 1M+ personas, 15 markets, 9 languages** — **❌ WRONG — misattribution.** "1M+ personas / 15 markets / 9 languages" is **Toluna's** (Oct 2025 announcement). Remesh uses *real* participants in live dialogue, not a synthetic-persona library. *[Bernama/Toluna, 2025-10](https://www.bernama.com/misc/rss/news.php?id=2481914).*
- [x] **Qualtrics added synthetic respondents** as a platform toggle — when launched? Product name (Edge Audiences)? — **✅ VERIFIED.** Product is **Edge Audiences** (credit-based subscription); synthetic panels rolled out as **Q4 2025 Public Preview**. *[Qualtrics Community, 2025-12-18](https://community.qualtrics.com/announcements-2/a-new-way-to-get-research-insights-online-synthetic-panels-with-edge-audiences-32914).*
- [x] **Simile validates against the US General Social Survey** (GSS) — **✅ VERIFIED.** Founders' paper "Generative Agent Simulations of 1,000 People" validates agents against the GSS. *[arXiv 2411.10109, 2024-11](https://arxiv.org/abs/2411.10109).*

## 🔴 Accuracy / replication metrics cited per competitor

These read as authoritative but every one is flagged.

- [ ] Simile **85% GSS replication accuracy** (via Gallup partnership) — **❌ PARTIALLY WRONG — fix attribution.** The 85% GSS figure is real but comes from the **Stanford 2024 paper**, *not* from Gallup. A Gallup–Simile partnership does exist (May 2026) but Gallup makes **no 85% claim**. Say "85% GSS replication (Stanford, 2024)"; don't credit it to Gallup. *[arXiv 2411.10109](https://arxiv.org/abs/2411.10109); [Gallup, 2026-05-11](https://news.gallup.com/opinion/methodology/709373/gallup-begins-research-synthetic-responses.aspx).*
- [ ] **80–85%** accuracy band — whose claim, on what task? — **✅ partially sourceable.** Fits Simile/Stanford ~85% on GSS replication. *[arXiv 2411.10109](https://arxiv.org/abs/2411.10109).*
- [ ] **55–65%** accuracy band — **⚠️ NO SOURCE.** Not traceable to any named vendor/task. Cut or source.
- [ ] **65–75%** accuracy band — **⚠️ NO SOURCE.** Same.
- [ ] **60–70%** accuracy band — **⚠️ NO SOURCE.** Same.
- [ ] **85–90%** accuracy band — **⚠️ WEAK SOURCE.** Closest is Aaru ~90% median correlation vs an EY 2025 report, but only a single secondary source (page 403'd on direct fetch). Treat as unconfirmed.
- [ ] InsightForge's own **70% minimum accuracy threshold** for GA — **📝 INTERNAL.** Your own target. AUDIT.md notes ~67% on net-new questions is realistic — so 70% may be slightly optimistic. Keep as a stated design target, not a benchmark.

## 🟡 Industry / market-size stats

Specific enough that someone will Google them.

- [ ] **"$1.5B+ in venture funding flowed into synthetic consumer research over the past 18 months"** — **⚠️ NO SOURCE / likely overstated.** No aggregation supports $1.5B for *synthetic consumer research*. Documented rounds among the named players total ~$150M (~10× lower). The $1.5B may be a confusion with the broader synthetic-**data** market ($1.8B→$8.2B projection). Cut or replace with the real per-round figures.
- [ ] **Gartner forecast: by 2028, 60% of product marketing teams will use synthetic customer personas** — **❌ WRONG.** No such Gartner prediction exists. The real "60% by 2028" line is **"60% of *brands* will use *agentic AI* to deliver one-to-one interactions by 2028"** — different subject entirely. Remove or replace. *[Gartner, 2026-01-15](https://www.gartner.com/en/newsroom/press-releases/2026-01-15-gartner-predicts-60-percent-of-brands-will-use-agentic-ai-to-deliver-streamlined-one-to-one-interactions-by-2028).*
- [ ] Every funding figure in the Section 2 competitor table — **❌ AUDIT REQUIRED.** Given the misattribution pattern above, re-check every row against the corrected mapping before reuse.

## 🟠 MENA white-space claims (the core competitive thesis)

These are the moat claims. If wrong, the whole strategic positioning weakens.

- [ ] **"No Western platform offers truly Arabic-native cognition today"** — **✅ SUPPORTED (directional).** None of Simile, Aaru, Ditto, or Synthetic Users advertise Arabic-native / MENA-specific modeling. Caveat: "truly Arabic-native cognition" is marketing language, and Simile's own site 403'd (couldn't inspect directly) — this is absence-of-advertised-capability, not proof of absence. *[Synthetic Users](https://www.syntheticusers.com/); [FishDog comparison](https://fish.dog/news/synthetic-research-platforms-compared-ditto-vs-evidenza-vs-simile-vs-artificial-societies).*
- [ ] **"Few competitors model Ramadan / MENA consumption cycles"** — **✅ SUPPORTED (absence of evidence).** No competitor materials reference Ramadan / MENA seasonal modeling. "Few" is consistent with "none of the named global players advertise it."
- [ ] **"Ditto reportedly covers 50+ countries but calibrates against largely Western census inputs"** — **⚠️ HALF-SUPPORTED — soften.** "50+ countries" is **confirmed** (Ditto's own materials). "Largely Western census inputs" is **not substantiated** — Ditto doesn't state it. Documented coverage names NA/Europe/APAC/LatAm (no MENA), which is suggestive but not proof. Reword to "no MENA-specific calibration advertised." *[askditto.io](https://askditto.io/how-we-build-digital-twins).*
- [ ] **"There is no clear leader building culturally grounded synthetic MENA consumers"** — **✅ PARTIALLY SUPPORTED.** No purpose-built synthetic-MENA-consumer leader found. But adjacent, funded Arabic-AI players exist who could pivot in: Lucidya (Arabic NLP/analytics), DOO (KSA, AI CX), Nanovate (Cairo, Arabic AI). Reword to "no clear leader in synthetic MENA consumers *specifically*, though adjacent Arabic-AI startups are funded."
- [ ] **"12–18 month advantage if execution starts soon"** — **📝 INTERNAL / UNVERIFIABLE.** No external basis for the 12–18 number; it's a judgment call. Present as your estimate, not a fact.
- [ ] **Gulf expat population claims**: Indian, Filipino, Pakistani, Western expat shares per Gulf country (UAE, Saudi, Qatar, Kuwait) — **✅ MOSTLY SOURCEABLE.** Foreigner share (GLMM mid-2022): UAE 87.1%, Qatar 87.9%, Kuwait 67.3%, Saudi 41.6%. Major Asian/Arab community shares are sourceable (UAE: Indian ~38%, Pakistani ~16.7%, Filipino ~6.1%). **Western-expat percentages are NOT cleanly sourced** — Westerners are a small single-digit minority everywhere; use counts, not invented percentages. *[GLMM, mid-2022](https://gulfmigration.grc.net/gcc-total-population-and-percentage-of-nationals-and-non-nationals-in-gcc-countries-national-statistics-mid-2022/).*

## 🟡 InsightForge pricing / margin / cost assumptions

Internal-facing, but if shared in a pitch, every number gets scrutinized.

- [ ] **Tier pricing**: Explorer $500–$800, Professional $2,000–$3,500, Enterprise $8,000–$15,000 — **📝 INTERNAL.** Your own plan/estimate. Label as proposed pricing, not market fact.
- [ ] **"MENA agency research leads currently spend $5,000–$20,000 per traditional focus group"** — **⚠️ NO MENA SOURCE.** No Nielsen MENA / GfK / regional benchmark publishes a Gulf per-group price. General (US-centric) benchmarks overlap the range ($2K–$15K/group; $10K–$30K/project). Relabel as "general industry benchmark" or find a regional source. *[Drive Research, 2023](https://www.driveresearch.com/market-research-company-blog/how-much-does-a-focus-group-cost-focus-groups-syracuse-ny/).*
- [ ] **"If twins can replace even 30% of exploratory focus-group work"** — **📝 INTERNAL.** Assumption; no external basis. Label as such.
- [ ] **Margins: 75–90% gross margin claim** on the add-on — **📝 INTERNAL.** Your own model. Label as projected.
- [ ] **"$10M+ to train own LLM to compete meaningfully"** — **✅ VERIFIED (conservative floor).** Frontier final training runs are $50M–$200M+ (Epoch AI; growing ~2.4×/yr). "$10M+" is true as a minimum; for a genuinely competitive/frontier model the honest number is tens-to-hundreds of millions. *[Epoch AI](https://epoch.ai/blog/how-much-does-it-cost-to-train-frontier-ai-models).*
- [ ] **"Simile API at $100K+/yr"** — **⚠️ NO OFFICIAL SOURCE.** Simile publishes no pricing. "$100K+" traces to a third-party *estimate* ($100K–$250K+/yr), explicitly "educated guesses." Attribute as a third-party estimate; don't imply it's official. (And don't confuse it with Simile's $100M *funding* round.) *[FishDog, 2026](https://fish.dog/news/simile-ai-pricing-what-does-it-cost-in-2026).*

## 🟡 Token / API cost assumptions

Easy to verify against provider pricing pages.

- [x] **Anthropic Claude Sonnet at $3 / 1M input tokens, $15 / 1M output tokens** — **✅ VERIFIED.** Current Anthropic pricing: Sonnet 4.6 / 4.5 / 4 all $3 input / $15 output per MTok (base). Specify which Sonnet version when you cite it. *[Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing) (retrieved 2026-05-30).*
- [ ] **Token estimates per session type**: 15K (survey), 50K (conversation), 200K (group sim), 2M (full study) — **📝 INTERNAL.** Sanity-check against real usage logs once available.
- [ ] **Implied API cost ranges**: $0.05–$0.15, $0.15–$0.50, $0.50–$2.00, $5–$15 — **📝 INTERNAL.** These flow from the token estimates above; if those move, these move.

## 🟠 Legal / regulatory references

The polisher explicitly asked for IP-counsel review. Don't quote these as cleared until counsel says so. **The summaries below are factual only — ⚖️ NOT legal clearance.**

- [ ] **Saudi PDPL** (Personal Data Protection Law) — **⚖️ COUNSEL.** Royal Decree M/19 (2021), amended M/148 (2023); SDAIA Transfer Regs (Aug 2024). Art. 29 permits cross-border transfer for defined purposes incl. "scientific research," but transfers "must not cause prejudice to national security or vital interests of Saudi Arabia" and need an adequacy determination / approved safeguards. **AI training-data use is not specifically addressed.** Counsel must confirm whether training on Saudi personal data qualifies. *[K&L Gates summary](https://www.kslaw.com/news-and-insights/international-personal-data-transfers-under-saudi-arabias-data-protection-law).*
- [ ] **UAE Data Protection Law** — **⚖️ COUNSEL.** Federal Decree-Law 45/2021 (in force Jan 2022). Art. 22–23: transfer to "adequate" countries, else via contract / explicit consent / contractual necessity / public interest. Executive Regulations historically pending — confirm current status. Training-data use not specifically addressed. *[US Trade.gov](https://www.trade.gov/market-intelligence/united-arab-emirates-allows-cross-border-data-flows-personal-data).*
- [ ] **Egypt PDPL** — **⚖️ COUNSEL.** Law 151/2020; Executive Regs via Decree 816/2025, compliance deadline ~Nov 2026. **Most restrictive of the three:** cross-border transfer requires a PDPC license/permit + adequacy + data-subject consent. Training-data use not specifically addressed. *[Al Tamimi](https://www.tamimi.com/law_update_articles/from-policy-to-practice-egypt-issues-executive-regulations-of-the-personal-data-protection-law/).*
- [ ] **Patentability of MENA cultural-modeling framework** (prompt patterns, parameter taxonomies, calibration methods) — **⚖️ COUNSEL.** Needs IP-counsel review; don't claim defensibility until then.
- [ ] **Consent framework for using real-participant data to train twins** — **⚖️ COUNSEL.** Needs counsel review before promising "structural advantage."

## 🟢 Internal-only assumptions (low risk if wrong, but check before scaling)

- [ ] **Composite strategic score 31/36 (86%)** — **📝 INTERNAL.** Your own scoring; document the rubric if cited externally.
- [ ] **Phase timeline 0–3 / 3–6 / 6–9 / 9–12 months** in Section 9 — **📝 INTERNAL.** Confirm realistic vs current team capacity.
- [ ] **Traffic-light confidence thresholds: Green >80%, Yellow 60–80%, Red <60%** — **📝 INTERNAL.** Confirm this matches the calibration math you'll actually ship.

---

## Verification provenance (2026-05-30)

- Fact-check run via four parallel web-research passes (competitor funding · accuracy/market-size · pricing/cost · MENA/legal). Each verdict cites a retrievable source; "NO SOURCE" means none was found after genuine searching — no source was invented.
- **Confidence caveats:** Simile's $100M (primary press release not retrieved — strong secondary), the Aaru ~90%/EY accuracy figure (single secondary, page 403'd), and the Gartner press page (403 on direct fetch, confirmed via title/URL + corroborating coverage) should be treated as well-corroborated-but-not-primary.
- **Legal items are factual summaries, not clearance.** Any plan to train on or transfer Gulf/Egyptian personal data needs qualified IP + data-protection counsel per jurisdiction.

## Where this file came from

- Source doc: [`../InsightForge_Digital_Consumer_Twins_Brainstorming.docx`](../InsightForge_Digital_Consumer_Twins_Brainstorming.docx)
- Polished comparison version: lives in the Codex CLI worktree (`~/.codex/worktrees/8a5b/`) — not committed to this repo by intent. It exists as a snapshot, not a source of truth.
- Audit context: [`../AUDIT.md`](../AUDIT.md) — references some of the same competitor names and provides additional strategic framing.
