---
title: Evaluate Outreach Method
lifecycle: canonical
status: stable
load_class: METHOD
---

# Method — Why `results` exists

> Why this skill exists, philosophy, methodology, when NOT to use, history. Cited from COMMAND.md's introduction. Stable reference — update only when philosophy or methodology genuinely shifts.

## Why this skill exists

The outreach loop was one of the three partial loops named in CLOSED-LOOP.md §5: `outreach` authored sequences, but there was no publish skill and no eval skill, so the cycle never closed. Sent sequences had no canonical place to be scored on reply quality, and — critically — no gate caught a sequence that was winning replies while quietly burning the sending domain or breaking opt-out.

`results` exists to:

1. **Close the `outreach` → reply-performance → next-sequence loop.** Every cycle reads the source sequence's hypothesis (subject, opener, value prop, CTA, steps) and scores against real reply data, not best-practice heuristics.
2. **Refuse vanity replies as success.** Opens and raw reply counts are easy to inflate and mean little. `results` scores meaningful replies (positive / meeting-booked / qualified-lead) and names an open-rate spike for what it is.
3. **Hold the deliverability + compliance line.** A reply-winning sequence that elevates bounce/spam rates, degrades sender reputation, or ignores opt-out is a failure regardless of replies — it risks the whole sending domain and legal exposure. This gate blocks a keep no matter how good the replies look.
4. **Promote durable lessons to learnings.md.** Conservatively — channel/segment/offer-scoped, high-confidence only.

## Philosophy

### Measurement over heuristics

A "best-practice audit" of a sent sequence ("the subject could be punchier") is fiction without reply data. `results` refuses to score a cycle when reply evidence is missing — return BLOCKED, not a heuristic verdict.

### Vanity is the enemy

The most common outreach-eval failure is letting a high open rate read as success. Opens are cheap and increasingly untrustworthy (Apple Mail Privacy inflates them); raw reply counts include "unsubscribe" and "not interested." `results` always categorizes replies and rests the verdict on the meaningful half — positive replies, booked meetings, qualified leads. A 70% open rate with zero meetings did not work.

### Deliverability and compliance are not optional

This is the lens that makes outreach eval different from content eval. Cold outreach lives or dies on the sending domain's reputation and on staying inside CAN-SPAM / GDPR / platform ToS. A sequence that books meetings while pushing bounce rate over the safe threshold or ignoring opt-out requests is actively destroying the channel and creating legal risk. The deliverability/compliance gate caps such a cycle at `watch` or `discard` — reply success never rescues a burning domain.

### Causal humility

Diagnosis names plausible drivers tied to evidence. Confounders (sender warmup, list freshness/source, seasonality, domain age, a single big-logo reply) are surfaced, not smoothed.

### One channel + segment per cycle

Cold email to a founders segment and LinkedIn DMs to an ops segment run under different mechanics and benchmarks. `results` scopes each cycle to one channel + segment and reads the metric against that combination. Secondary channels/segments appear as Cross-Channel Context — context only, never the verdict.

### Lane discipline

Organic-post engagement is `measure`'s lane. Paid placements are `results`'s. Authoring the sequence is `outreach`. `results` owns the sent-sequence reply + deliverability evaluation. When the work is a draft or a different surface, route — do not score it here.

### The rubric is provisional

v0.1. Mandatory revision after cycles 2-3. The 7 dimensions (Loop Fit / Metric Integrity / Attribution Honesty / Decision Discipline / Reply-Quality Discrimination / Deliverability & Compliance / Ledger Correctness) are a starting calibration. Operator overrides on the same dim > 3 times triggers revision.

## Methodology

### 4-agent dispatch (mirrors `measure` / `results`)

- **Layer 1 (parallel):** Metric Ingest + Diagnosis. Metric Ingest normalizes reply data + deliverability/compliance into a packet (categorized reply breakdown mandatory); Diagnosis reads the source sequence's hypothesis + Layer-1's packet and names likely drivers + reply-quality + deliverability/compliance signals.
- **Layer 2 (sequential):** Recommendation consumes both Layer 1 outputs and proposes verdict (keep/discard/watch/blocked) with the deliverability/compliance gate applied, next-cycle route, ledger row, learning promotion.
- **Layer 3 (sequential):** Critic enforces the 7-dim rubric. PASS → write artifact + append ledger row + manifest sync. FAIL → revise once (max). After 2 failed revisions, return BLOCKED.

### Outputs land in three places

- `evals/YYYY-MM-DD-cycle-N.md` (primary artifact, 10-field frontmatter + provenance + 8-section body)
- `results.tsv` (one row, 8 columns, channel + segment in description) when a loop exists; otherwise the same row lives on the standalone evaluation artifact
- `learnings.md` (only when critic approves promotion — high-confidence, channel/segment/offer-scoped, durable)

## When NOT to use

- **No existing eval loop.** Still produce a standalone evaluation artifact at `.forsvn/artifacts/mkt/evaluate-outreach/` when that store exists — otherwise return it inline. Do not scaffold a loop. The standalone contract ingests operator-supplied exports, screenshots, and pasted numbers.
- **The outreach is still a draft.** Route to `outreach`. `results` scores only sent + measured sequences.
- **No reply / deliverability evidence.** Return BLOCKED, list missing evidence. `results` does not run as a heuristic audit.
- **Organic-post performance.** Route to `measure`.
- **Paid-ad performance.** Route to `results`.
- **The next action is copy authorship or a list change.** Route to `outreach` / `position`.

## Sibling coordination

- **`outreach`** owns construction-time sequence authoring. `results` reads its artifacts as input; routes the next cycle to `outreach` with hypothesis seeding. `results` does NOT author copy.
- **`position`** owns list/targeting. When the diagnosis points at the list (bounces from a stale list, wrong segment), route to `position`.
- **Later eval-loop runner** owns loop scaffolding. This skill works without a loop; when a loop exists, write into it.
- **`measure` / `results`** are sibling eval lanes — same 4-agent / 7-dim / 8-col structure; `results` mirrors them for cross-eval consistency.

## History / origin

- **2026-06-01 — shipped as one of the three missing evals** named in CLOSED-LOOP.md §5 (`evaluate-asset`, `results`, `evaluate-seo`). The outreach loop's gap was "no publish skill, no eval skill" — this closes the eval half (reply rate + lead quality). 7-dim rubric chosen mirroring `measure`'s 5 generic dims + 2 outreach-specific (Reply-Quality Discrimination + Deliverability & Compliance, replacing content's Engagement-Quality Discrimination + Platform-Fit). 4-agent shape byte-aligned with the eval siblings for cross-eval consistency.
- **Provisional v0.1.** Rubric will be revised after cycles 2-3.

## Acceptance Reminders (cite COMMAND.md, not duplicate)

- 8 Critical Gates (sent-and-measured / source sequence when available / one channel+segment / no fabricated replies / deliverability+compliance evidence / explicit confidence / does-not-write-outreach / loop optional)
- 4-agent dispatch (Metric Ingest + Diagnosis + Recommendation + Critic)
- 7-dim rubric pass gate: aggregate ≥ 49 AND every per-dim ≥ 6
- Critic-override protocol via `the artifact override note` — never relaxes the deliverability/compliance gate
- Generation provenance — `input_artifacts` lists the source `outreach` artifact + icp-research.md + BRAND.md
- Results Row schema byte-identical with the eval siblings (8 cols)
- Learning promotion channel/segment/offer-scoped
