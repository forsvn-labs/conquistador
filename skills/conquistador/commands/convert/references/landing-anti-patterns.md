---
title: Improve-conversion Anti-Patterns
lifecycle: canonical
status: stable
produced_by: convert
load_class: ANTI-PATTERN
---

# Post-launch evaluation anti-patterns

> Re-read before any cycle artifact ships. The first 10 patterns are improve-conversion-specific failure modes (extracted from Critical Gates + Hard Fails + body-implicit constraints). The last 4 are cross-cutting marketing-stack patterns. Ownership column cites by **dimension name** (Loop Fit / Metric Integrity / Attribution Honesty / Decision Discipline / Boundary Control / Ledger Correctness — the 6 critic dimensions from `agents/landing-critic-agent.md`) or **Hard Fail #N** (7 explicit Hard Fails from landing-critic-agent.md).

## Section 1 — LP-eval pipeline patterns (10)

### 1. Generic heuristic audit dressed up as post-launch CRO

**Pattern:** `convert` is invoked without measurement evidence. Output is a best-practice teardown of the launched page ("hero needs message-match, CTA is buried, no objection handling") presented as a cycle verdict.

**Why it fails:** Heuristic teardowns are construction-time priors, not post-launch posteriors. They can confidently recommend the wrong direction — the data might show the "conversion best practice" is actively hurting THIS audience. Generic heuristic audits as evidence is Hard Fail #4.

**Instead:** Hard-block when measurement evidence is missing. Return BLOCKED (or NEEDS_CONTEXT if loop is missing entirely). Recommend gathering measurement evidence first. If a heuristic reading is what the user needs, run the conversion diagnosis lens and label it a heuristic reading, not a cycle verdict.

**Owned by:** Critical Gate 2 (measurement evidence required) + Critic dimension "Metric Integrity" + Critic Hard Fail #4 (generic heuristic audit presented as evidence).

---

### 2. Fabricated analytics

**Pattern:** Eval artifact contains a primary metric value that isn't sourced from the named tool. Operator filled in "conversion: 4.2%" without checking GA4. Or the artifact cites "Hotjar recording shows X" but no recording exists.

**Why it fails:** Fabricated analytics poison the loop. Downstream cycles trust the prior eval's numbers; a fabricated baseline corrupts every subsequent comparison. The loop's measurement chain breaks silently and the team loses trust in the entire eval-loop infrastructure.

**Instead:** Unknown values stay unknown. Manual notes are allowed only when labeled as operator-supplied AND tied to a date/window/source ("operator note: 2026-05-15 sales-call retrospective — 3 of 8 prospects mentioned pricing tier confusion"). Hard Fail #5 catches "any fabricated number, logo, testimonial, user quote, or source."

**Owned by:** Critical Gate 4 (no fabricated analytics) + Critic dimension "Metric Integrity" + Critic Hard Fail #5.

---

### 3. Scoring without an existing eval-loop

**Pattern:** User invokes `convert` on a slug that has no eval-loop `program.md` (checked at `.forsvn/artifacts/mkt/improve-conversion/program.md` when that store exists, against operator-supplied files otherwise). `convert` tries to score anyway.

**Why it fails:** Without `program.md`, the primary metric is undefined. Without `context.md`, the baseline + measurement window assumptions are missing. Without `results.tsv`, the cycle number can't be resolved. `convert` that proceeds without the loop scaffolding produces a verdict that's structurally meaningless.

**Instead:** Critical Gate 1 fires BEFORE any other work — if `program.md` and `context.md` do not exist, return NEEDS_CONTEXT immediately and recommend `loop scaffolding outside this skill`. `convert` does NOT scaffold loops.

**Owned by:** Critical Gate 1 (existing eval loop required) + Critic Hard Fail #1 (no existing loop `program.md` — store path or operator-supplied equivalent).

---

### 4. Confidence inflation

**Pattern:** Verdict claims `confidence: high` on a sample of N=14 conversions. Or claims a cycle "kept" because primary metric ticked up 2% with no baseline comparability check. Or omits guardrail metrics entirely.

**Why it fails:** Inflated confidence is the failure mode of post-launch evaluation. Low-sample wins shipped as `keep` get promoted to `learnings.md`, then influence the next cycle's hypothesis — and a noise-driven decision compounds into a deliberate-looking strategy. The eval-loop's signal-to-noise ratio collapses.

**Instead:** Every verdict includes sample size or traffic volume when available, baseline comparability, confounders, and explicit confidence level (`high | medium | low | blocked`). Low-confidence findings ship as `watch` or `blocked`, not `keep`. Critic dimension "Attribution Honesty" scores 0-10 on overclaiming.

**Owned by:** Critical Gate 5 (attribution confidence must be explicit) + Critic dimension "Attribution Honesty".

---

### 5. Scope drift — evaluation becomes redesign

**Pattern:** `convert` recommends specific copy changes ("change hero headline to 'Pricing without the runaround'"), specific layout changes ("move social proof above the fold"), or specific asset replacements ("replace founder photo with team shot"). The eval artifact reads like a brief.

**Why it fails:** the evaluation recommends; the diagnosis lens drafts the revision. Confusing the two produces unmeasured changes that break the loop's measurement chain — the next cycle can't isolate which recommendation drove the delta because they were bundled into the eval rather than scoped through the diagnosis lens's hypothesis gate. Boundary Control matters for compounding learning.

**Instead:** `convert`'s "Next Cycle Recommendation" uses scoped lines (Keep: / Discard: / Watch: / Route next work to:). "Route next work to: conversion diagnosis with hypothesis: ['headline message-match to direct-traffic source']" routes the work without doing the work. Critical Gate 6 (Evaluation does not redesign) + Critic dimension "Boundary Control" enforce.

**Owned by:** Critical Gate 6 (evaluation does not redesign) + Critic dimension "Boundary Control" + Responsibility Split (the evaluation lens owns post-launch evidence; the diagnosis lens and `copy` own the revision).

---

### 6. Promoting low-confidence learnings to durable ledger

**Pattern:** Cycle verdict is `keep` with `confidence: low`. Recommendation-agent proposes promoting the lesson to `learnings.md`. Critic approves it (or misses the low-confidence flag).

**Why it fails:** `learnings.md` is the loop's durable record of validated lessons. Polluting it with low-confidence lessons creates a false-positive trail that downstream cycles + future diagnosis cycles treat as ground truth. The next strategy cycle bakes in a noise-driven assumption.

**Instead:** Promotion criteria: high-confidence (`confidence: high` in verdict) AND status = `keep` or `discard` AND lesson is reusable beyond this exact page state. Critic Hard Fail #7 catches "learning promoted from low-confidence or blocked evidence." When in doubt, do NOT promote — the cycle artifact itself preserves the finding for future trend analysis without polluting the durable ledger.

**Owned by:** Recommendation-agent (initial proposal self-check) + Critic dimension "Decision Discipline" + Critic Hard Fail #7.

---

### 7. Ledger row appended on FAIL

**Pattern:** Critic FAIL after revision. Recommendation-agent's ledger row is appended anyway (maybe because the operator appended it before checking the verdict).

**Why it fails:** Garbage ledger rows corrupt the loop's history. Downstream cycles trust `results.tsv` as the canonical sequence of cycle outcomes — a FAILed verdict that nonetheless appended a row makes the loop's history a lie.

**Instead:** **Do NOT append a row if the Critic verdict is FAIL. Return BLOCKED.** Side effects (write artifact + append ledger + promote learning) are gated on critic PASS. The row format does not enforce the FAIL-no-row rule; the orchestrator does.

**Owned by:** Orchestrator (Layer 3 critic gate — FAIL after revision skips side effects) + Critic dimension "Ledger Correctness".

---

### 8. Custom-schema row appended via standard helper

**Pattern:** Loop has a custom 10+ column `results.tsv` (e.g., includes guardrail values + sample size + variant split per row). The orchestrator writes a standard 8-column row into it, producing malformed TSV.

**Why it fails:** Schema mismatch breaks the loop's ledger. The standard row is strict about its 8 columns to prevent silent corruption.

**Instead:** Standard loops use the 8-column row. Custom-schema loops need the loop owner's row format; ask before appending.

**Owned by:** Orchestrator (detect custom schema before append; flag to eval-loop owner) + `landing-format-conventions.md` § "Known limitation — custom schemas".

---

### 9. Missing primary metric source-window

**Pattern:** Eval artifact's Evidence table has a Current value but no Source or no Window. "Conversion: 4.2%" appears with no GA4/Mixpanel/Posthog tool name and no measurement window.

**Why it fails:** A metric without source + window is not measurement — it's an assertion. Critic Hard Fail #2 catches "no current primary metric value, source, or measurement window."

**Instead:** Every Evidence row must include Signal + Current + Baseline + Window + Source + Caveat. Source is the tool/system the metric came from. Window is the date range, traffic count, or sample N. Caveat flags sample-size warnings, tracking issues, attribution caveats, or source freshness.

**Owned by:** Metric-ingest-agent (self-check on Evidence table population) + Critic dimension "Metric Integrity" + Critic Hard Fail #2.

---

### 10. Weak baseline comparability

**Pattern:** Cycle 3 evaluation compares cycle 3 conversion vs cycle 1 baseline, ignoring cycle 2's mid-period traffic-source change. Or compares Monday cycle vs Friday baseline without seasonality adjustment. Or compares post-launch cycle vs pre-launch traffic with different audience mix.

**Why it fails:** Baseline comparability is the foundation of every metric verdict. A "lift" against an incomparable baseline is statistical fiction. Critic Hard Fail #3 catches "claimed improvement without baseline or prior-cycle comparison."

**Instead:** Diagnosis-agent surfaces confounders explicitly — traffic mix, seasonality, campaign change, tracking issue, sample size. Critic dimension "Attribution Honesty" scores 0-10 on whether confounders are stated without overclaiming. When baseline is genuinely incomparable, ship as `watch` or `blocked` with the confounder noted — do NOT claim a lift.

**Owned by:** Diagnosis-agent (Confounders subsection in Diagnosis section) + Critic dimension "Attribution Honesty" + Critic Hard Fail #3.

---

## Section 2 — Cross-cutting marketing-stack patterns (4)

### 11. Upstream context skipped — no loop scaffolded

**Pattern:** User invokes `convert` directly without running `loop scaffolding outside this skill` first. Loop directory doesn't exist or is empty.

**Why it fails:** Without `program.md` defining the primary metric + `context.md` defining baseline assumptions + `results.tsv` for cycle resolution, `convert` has no structural foundation. Critical Gate 1 catches this hard.

**Instead:** `convert` returns NEEDS_CONTEXT immediately, recommends `loop scaffolding outside this skill`. The eval-loop skill owns loop scaffolding; `convert` owns post-launch evidence inside an existing loop.

**Owned by:** Orchestrator (Pre-Dispatch hard gate — fires BEFORE Cold Start questioning) + Critical Gate 1 + Critic Hard Fail #1 + Responsibility Split (`loop scaffolding outside this skill` owns loop setup).

---

### 12. Cross-stack contract drift

**Pattern:** eval-loop skill updates the `results.tsv` schema (e.g., adds a `confidence` column) without updating `convert`'s the Markdown ledger row on the evaluation artifact invocation or `format-conventions.md` § "Results Row format". Two versions of "what a row contains" exist.

**Why it fails:** Schema drift produces silent breakage — `convert`'s helper invocation errors on the new column, OR appends rows without the new column (corrupting downstream consumers expecting it). Symptoms appear when a downstream dashboard skill or trend-analysis tool reads `results.tsv` and finds inconsistent row shapes.

**Instead:** Schema changes require atomic update of `references/landing-format-conventions.md` + `convert` `format-conventions.md` + the Markdown ledger row on the evaluation artifact helper + every other consumer of `results.tsv`. Bump `convert` `version` when the schema changes (currently v0.1.0 — provisional-rubric signal, expected to bump after cycles of real use).

**Owned by:** Operator (during refactor + new-feature work) + eval-loop owner (canonical schema in `references/landing-format-conventions.md`) + `convert` landing-eval-method § "Cross-stack contract".

---

### 13. Polish-chain misroute

**Pattern:** User invokes `editorial-polish` or `polish-vn` on the eval artifact ("make the diagnosis sound less robotic"). Polish chain runs on what is supposed to be a structured operational document.

**Why it fails:** `convert` OUTPUT is an evidence snapshot + ledger row + learning promotion proposal — structured operational data consumed by downstream cycles. Running editorial-polish on it recursively redefines what "evaluation" means — verdicts become prose paragraphs, Evidence tables get prose-ified, etc. Downstream readers (future `convert` cycles, dashboard tools) can no longer parse it.

**Instead:** editorial-polish and vn-tone run on USER-FACING copy (blog posts, ad copy, cold-outreach emails). They do NOT run on operational artifacts like cycle evaluations. If the eval artifact reads "robotic," that's correct register — operational documents prioritize parseability over style.

**Owned by:** Orchestrator (chain position note in playbook — `convert` is operational; editorial-polish/vn-tone are for user-facing copy) + chain-position discipline.

---

### 14. Mixing the two lenses

**Pattern:** The user wants a launched page fixed, and the evaluation lens returns NEEDS_CONTEXT for a missing loop. Or the user wants a cycle verdict, and the diagnosis lens returns a rewrite.

**Why it fails:** The diagnosis lens finds the break and drafts a revision with one test. The evaluation lens scores a launched change inside a loop. Each one answers a different request.

**Instead:** Choose the lens from the request in `COMMAND.md`. When both are wanted, run the evaluation first, then the diagnosis lens for the revision, and keep their verdicts separate.

**Owned by:** `COMMAND.md` lens selection + Critic dimension "Boundary Control".

---

## Cross-references

- Rubric ownership: [landing critic agent](../agents/landing-critic-agent.md) (six dimensions, verdict thresholds, and the seven hard fails).
- Procedure: [sequential fallback](../fallbacks/sequential.md) (gates fire before any cold-start questions; critic FAIL means no side effects).
- Format: [landing format conventions](landing-format-conventions.md) (frontmatter, body sections, evidence table, results row, learning promotion; catches patterns 6–9).
