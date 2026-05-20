# Claims to verify before external use

This checklist captures every unverified factual claim in `InsightForge_Digital_Consumer_Twins_Brainstorming.docx` (the strategic brainstorm at the repo root). Source: a Codex CLI polishing pass from April 2026 that explicitly flagged each one — see [project_kill_list_decisions.md memory file](https://github.com/mahmoudtohamy2025/insightforge) for context.

**How to use this:**

1. **Before any external send** (investor deck, enterprise prospect, conference talk, blog post): work top-to-bottom through the 🔴 and 🟡 items. Replace flagged claims with sourced versions, or remove them.
2. **Before the 90-day strategic execution starts:** clear the 🟠 legal block with IP counsel.
3. **🟢 items** are fine to defer — they're directional and don't carry external-blame risk.

When you verify an item, replace `- [ ]` with `- [x]` and append the source in italics. e.g.:

```
- [x] Simile raised $100M Series A in February 2026 — *TechCrunch, 2026-02-14*
```

---

## 🔴 Competitor funding, valuation, and customer claims

Public-record claims (or should be) — easy to fact-check, brutal if wrong.

- [ ] **Simile raised $100M Series A in February 2026** to build AI digital twins
- [ ] **Aaru crossed $1B valuation** (which year / which round?)
- [ ] **Listen Labs: $69M Series B, $100M total raised**
- [ ] **Listen Labs: 1M+ interviews completed, Microsoft and Robinhood as clients**
- [ ] **Synthetic Users: $50M+ raised, $1B valuation reported**
- [ ] **Yabble: 300K+ personas, 50+ countries, self-serve**
- [ ] **Toluna: 70M+ real panel base; Booking.com reportedly saves 50% using it**
- [ ] **Strella / similar: synthetic from 79M real panelists**
- [ ] **Remesh / similar: 1M+ personas, 15 markets, 9 languages**
- [ ] **Qualtrics added synthetic respondents** as a platform toggle — when launched? Product name (Edge Audiences)?
- [ ] **Simile validates against the US General Social Survey** (GSS)

## 🔴 Accuracy / replication metrics cited per competitor

These read as authoritative but every one is flagged.

- [ ] Simile **85% GSS replication accuracy** (via Gallup partnership)
- [ ] **80–85%** accuracy band — whose claim, on what task?
- [ ] **55–65%** accuracy band
- [ ] **65–75%** accuracy band
- [ ] **60–70%** accuracy band
- [ ] **85–90%** accuracy band
- [ ] InsightForge's own **70% minimum accuracy threshold** for GA — confirm this is the right floor (AUDIT.md notes ~67% on net-new questions is realistic)

## 🟡 Industry / market-size stats

Specific enough that someone will Google them.

- [ ] **"$1.5B+ in venture funding flowed into synthetic consumer research over the past 18 months"** — needs Pitchbook/Crunchbase aggregation
- [ ] **Gartner forecast: by 2028, 60% of product marketing teams will use synthetic customer personas** — find the actual Gartner report ID/title
- [ ] Every funding figure in the Section 2 competitor table

## 🟠 MENA white-space claims (the core competitive thesis)

These are the moat claims. If wrong, the whole strategic positioning weakens.

- [ ] **"No Western platform offers truly Arabic-native cognition today"** — verify by checking the actual Arabic capabilities of Simile, Aaru, Ditto, Synthetic Users
- [ ] **"Few competitors model Ramadan / MENA consumption cycles"** — same check
- [ ] **"Ditto reportedly covers 50+ countries but calibrates against largely Western census inputs"** — verify the Ditto coverage and calibration claim
- [ ] **"There is no clear leader building culturally grounded synthetic MENA consumers"** — check MENA-specific research-tech startups (not just the big global names)
- [ ] **"12–18 month advantage if execution starts soon"** — what's the basis for the 12–18 number?
- [ ] **Gulf expat population claims**: Indian, Filipino, Pakistani, Western expat shares per Gulf country (UAE, Saudi, Qatar, Kuwait) — verify ranges

## 🟡 InsightForge pricing / margin / cost assumptions

Internal-facing, but if shared in a pitch, every number gets scrutinized.

- [ ] **Tier pricing**: Explorer $500–$800, Professional $2,000–$3,500, Enterprise $8,000–$15,000 — is this the actual plan or a guess?
- [ ] **"MENA agency research leads currently spend $5,000–$20,000 per traditional focus group"** — source from Nielsen MENA / GfK / regional research firm benchmarks
- [ ] **"If twins can replace even 30% of exploratory focus-group work"** — basis for the 30%?
- [ ] **Margins: 75–90% gross margin claim** on the add-on
- [ ] **"$10M+ to train own LLM to compete meaningfully"** — confirm or change to a sourced range
- [ ] **"Simile API at $100K+/yr"** — confirm Simile's actual enterprise pricing

## 🟡 Token / API cost assumptions

Easy to verify against provider pricing pages.

- [ ] **Anthropic Claude Sonnet at $3 / 1M input tokens, $15 / 1M output tokens** — confirm against current Anthropic pricing
- [ ] **Token estimates per session type**: 15K (survey), 50K (conversation), 200K (group sim), 2M (full study) — sanity-check against actual usage logs once available
- [ ] **Implied API cost ranges**: $0.05–$0.15, $0.15–$0.50, $0.50–$2.00, $5–$15 — these flow from the token estimates; if those are off, these are off

## 🟠 Legal / regulatory references

The polisher explicitly asked for IP-counsel review. Don't quote these as cleared until counsel says so.

- [ ] **Saudi PDPL** (Personal Data Protection Law) — confirm what it actually says about cross-border training data
- [ ] **UAE Data Protection Law** — same
- [ ] **Egypt PDPL** — same
- [ ] **Patentability of MENA cultural-modeling framework** (prompt patterns, parameter taxonomies, calibration methods) — needs IP-counsel review; don't claim defensibility until then
- [ ] **Consent framework for using real-participant data to train twins** — needs counsel review before promising "structural advantage"

## 🟢 Internal-only assumptions (low risk if wrong, but check before scaling)

- [ ] **Composite strategic score 31/36 (86%)** — your own scoring; document the rubric if you cite the score externally
- [ ] **Phase timeline 0–3 / 3–6 / 6–9 / 9–12 months** in Section 9 — confirm realistic given current team capacity
- [ ] **Traffic-light confidence thresholds: Green >80%, Yellow 60–80%, Red <60%** — confirm this matches the calibration math you'll actually ship

---

## Where this file came from

- Source doc: [`../InsightForge_Digital_Consumer_Twins_Brainstorming.docx`](../InsightForge_Digital_Consumer_Twins_Brainstorming.docx)
- Polished comparison version: lives in the Codex CLI worktree (`~/.codex/worktrees/8a5b/`) — not committed to this repo by intent. It exists as a snapshot, not a source of truth.
- Audit context: [`../AUDIT.md`](../AUDIT.md) — references some of the same competitor names and provides additional strategic framing.
