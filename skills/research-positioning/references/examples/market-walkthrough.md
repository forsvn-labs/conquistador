# Example — AI Code Review Market Walkthrough (Route B, fictional fixture)

> Load when an operator is learning the skill OR when synthesis (cross-analysis + opportunity) needs
> to see a worked example of the dispatch → checkpoint → critic → PASS arc end-to-end.
>
> **This is an explicitly fictional training fixture.** Every competitor, product, trend,
> statistic, review count, and date below is invented for illustration. No real company, product,
> survey, analyst report, or community thread is cited or implied. All evidence carries
> non-attributed source IDs (`MKT-01` … `MKT-n`) that resolve only to this document's provenance
> table. Never reuse these figures or names in real work; rerun the method against live, verifiable
> market data.

---

## Brief

> "Research the AI code review market."

---

## Provenance table (the fixture's spine)

Every trend, sizing input, competitor fact, and customer quote resolves to exactly one row here.
A claim whose source ID is missing from this table is unprovenanced and must fail Gate 1.

| Source ID | Fictional provenance record |
|---|---|
| MKT-01 | Developer-survey class dataset, published month −2, self-selected respondents, bias: early-adopter skew |
| MKT-02 | Analyst-class spending estimate, published month −4, top-down model, bias: vendor-funded studies aggregated |
| MKT-03 | Pricing-page snapshot set, collected day −7, public pages, bias: list prices exclude enterprise discounts |
| MKT-04 | Review-site theme sample, collected day −6, self-selected reviewers, bias: polarized ratings |
| MKT-05 | Practitioner forum threads, collected day −5, organic posts, bias: complaint overrepresentation |
| MKT-06 | Operator-supplied internal win/loss notes, undated, single-company view, bias: one sales org |

In a real run these rows must point to citable, verifiable publications and dated captures instead
of classes.

---

## Step 0: Product Context Check

Checked `research/product-context.md` — not found. Interview initiated.

## Step 1: Scope Interview

- Market: AI-powered code review tools (automated PR review, code quality analysis)
- Geography: global, English-speaking focus
- Timeframe: current snapshot with 2-year trajectory
- Known competitors: three fictional names supplied, more accepted later
- Decision: "We're building a new product and need to know where the gaps are"
- **Route confirmed:** B (Product Positioning, 5–8 competitors, detailed features)

---

## Layer 1 Dispatch (4 agents in parallel)

### trends-agent output (fictional)

| Trend | Direction | Evidence | Quantification | Implication |
|-------|-----------|----------|---------------|-------------|
| AI dev tools adoption | Growing | [MKT-01] | 78% of surveyed developers use AI coding tools (+32% YoY, fictional figure) | Market tailwind |
| Shift-left quality | Accelerating | [MKT-01] | 65% of orgs testing in CI, up from 48% (fictional) | Review moves earlier in pipeline |
| Inference cost decline | Declining | [MKT-02] | ~10x unit-cost drop over two years (fictional) | AI review viable at scale |

All quantified, all within 12 months, all resolvable through the table. Gates 1 + 6 + 7 satisfied.

### sizing-agent output (fictional, Route B optional — operator opted in)

| Metric | Method | Estimate | Source | Confidence |
|--------|--------|----------|--------|-----------|
| TAM | Top-down ([MKT-02] × 8% allocation) | $2.4B–$3.1B (fictional) | MKT-02 | Medium (single-source; bottom-up pending) |
| SAM | Bottom-up (15M developers × $200/seat/yr × 20%) | ~$600M (fictional) | MKT-01 + [MKT-03] | Medium-high |
| SOM | Top-3 entrant revenue × 3x | $30M–$50M 3-yr (fictional) | Estimation; no direct revenue data | Low |

Methodology per metric; ranges not points; confidence reasoned. Gates 8 + 10 satisfied.

### competitor-agent output (fictional companies only)

Five direct competitors mapped (**ReviewPilot, LintMind, MergeGuard, PRSensei, DiffSentry** — all
invented) with threat levels; three adjacent (**RepoCopilot, StaticShield, CodeGraph** — invented).
Feature matrix 7 capabilities × 5 competitors with Stakes/Diff labels; full pricing tables from
[MKT-03]; positioning map axes from [MKT-04] themes; community section from [MKT-05].

All 6 landscape sub-sections produced. Gates 2 + 3 + 9 + 11 satisfied.

### consumer-landscape-agent output (fictional)

Hot topics: hallucinated suggestions, false-positive fatigue [MKT-05]. Sentiment: cautiously
optimistic. Unmet needs: cross-repo understanding, style enforcement, test generation [MKT-05].

---

## Research Checkpoint

Operator confirmed the competitor set and supplied internal intel via [MKT-06]: losses concentrated
on speed against ReviewPilot and compliance against MergeGuard (fictional). Incorporated into gap
identification and risk assessment before Layer 2, with its single-company bias carried forward.

---

## Layer 2 Dispatch (sequential)

### cross-analysis-agent

Gaps across four dimensions, each traced to a source ID: 3 underserved segments [MKT-02, MKT-05],
5 feature gaps [MKT-04, MKT-05], 3 emerging trends [MKT-01, MKT-02], 2 positioning whitespace zones
[MKT-04, MKT-06]. Gate 4 satisfied.

### opportunity-agent

Force-ranked top 3 opportunities, each with Evidence Source + Window + Risk + Why Now (all
fictional): multi-repo context awareness [MKT-04]; self-hosted compliance-first review [MKT-06,
MKT-02]; review-to-test pipeline [MKT-05, MKT-01]. Gate 5 satisfied.

### critic-agent → conditional demonstration

**PASS case:** all 11 gates pass on the fully attributed artifact above — source citation, coverage,
feature depth, gap traceability, opportunity completeness, quantification, recency, confidence
reasoning, adjacent check, sizing methodology, stakes/diff labels.

**FAIL case (provenance missing) — this fixture must not PASS here.** Delete "[MKT-02]" from the
TAM row:

> TAM: Top-down × 8% allocation → $2.4B–$3.1B

No source ID. The verdict is **FAIL**, binary, with fix instructions: reattach the ID and confirm it
resolves to the provenance table, or delete the estimate. An unprovenanced market number fails Gate 1
even if every other gate passes, and inventing a plausible-looking citation to fill the gap is a
worse violation than the missing one. Verdict is binary — no "conditional PASS."

---

## Post-write side effects

Per `fallbacks/sequential.md` (fictional run): wrote `MARKET.md`, then experience write-back to
product / business / goals / audience records with the fictional category and competitor set.

---

## What this example does NOT show

- Real companies, products, surveys, analysts, reviews, or numbers — none exist behind this fixture.
- A first-cycle FAIL beyond the provenance demonstration; see `agents/market-critic-agent.md`
  § "Return B: FAIL."
- Route A / Route C, `--fast` mode, stale-artifact reruns — same structure as a real walkthrough.

---

## Reading the critic verdict format

Same binary contract as `agents/market-critic-agent.md`: PASS returns an 11-item checklist plus
notes; FAIL returns sectioned failures with standard violated, exact fix, and re-dispatch target.
Either all gates pass or the verdict is FAIL — and a provenance gap always fails Gate 1.
