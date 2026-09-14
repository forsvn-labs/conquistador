---
title: Improve-conversion Playbook
lifecycle: canonical
status: stable
produced_by: improve-conversion
load_class: PLAYBOOK
---

# Improve-conversion Playbook

## Why this skill exists

improve-conversion converts a launched landing-page's measurement evidence into a cycle snapshot, a ledger row, and a narrowly-scoped next action — all inside an **existing eval-loop workspace**. It is the post-launch counterpart to `improve-conversion`: where lp-brief builds with construction-time best-practice rules (CP-01 → CP-13 + sacred + voice), improve-conversion scores the launched page from real evidence (analytics + experiment results + recordings + form-funnel data + qualified manual metric notes) and decides whether the cycle's change should be kept, discarded, watched, or blocked.

The orchestrator coordinates 4 specialized sub-agents across 3 layers: **Layer 1 parallel** (metric-ingest-agent normalizes primary metric + baseline + sample + window + guardrails + source caveats; diagnosis-agent connects observed outcomes to page hypothesis + execution delta + traffic context + user behavior). **Layer 2** (recommendation-agent chooses keep/discard/watch/blocked + next-cycle actions + ledger row + learning promotion proposal). **Layer 3** (critic-agent enforces evidence discipline + loop boundary + ledger correctness + no fake analytics).

This skill is the canonical producer of the eval cycle artifact (`.forsvn/artifacts/mkt/improve-conversion/evals/[date]-cycle-N.md` when that store exists; otherwise returned inline). Side effects: appends one row to `results.tsv` via `a Markdown ledger row on the evaluation artifact (no TypeScript helper)`; updates `learnings.md` only for high-confidence keep/discard lessons reusable beyond this exact page state; runs `manifest-sync` after writing.

## Why this skill exists at all

Six failure modes it prevents:

1. **Generic heuristic audit dressed up as post-launch CRO.** Critical Gate 2 requires measurement evidence — at minimum one metric source, measurement window, and current value for the loop's primary metric. Without that, improve-conversion is BLOCKED, not transformed into a brief teardown. Critic Hard Fail #4 catches "generic heuristic audit presented as evidence."
2. **Fabricated analytics.** Critical Gate 4 forbids fabricated numbers. Critic Hard Fail #5 catches "any fabricated number, logo, testimonial, user quote, or source." Unknown values stay unknown; manual notes are allowed only when labeled as operator-supplied + tied to a date/window/source.
3. **Scoring without a loop.** Critical Gate 1 requires an existing eval-loop `program.md` + `context.md` (from `.forsvn/artifacts/mkt/improve-conversion/` when that store exists, or operator-supplied). If absent → NEEDS_CONTEXT, recommend `loop scaffolding outside this skill`. improve-conversion does NOT scaffold loops. Critic Hard Fail #1 enforces.
4. **Confidence inflation.** Critical Gate 5 requires attribution confidence to be explicit (`high | medium | low | blocked`) with sample size or traffic volume, baseline comparability, and confounders. Critic dimension "Attribution Honesty" scores 0-10 on overclaiming.
5. **Scope drift — evaluation becomes redesign.** Critical Gate 6 prevents improve-conversion from redesigning. Recommendations route next work; actual page brief/revision goes to `improve-conversion`, execution artifacts to appropriate content/design/build workflow. Critic dimension "Boundary Control" enforces.
6. **Promoting low-confidence learnings to durable ledger.** Critic Hard Fail #7 catches "learning promoted from low-confidence or blocked evidence." `learnings.md` updates only for high-confidence keep/discard lessons reusable beyond this exact page state.

The structural answer is the **6-dimension critic rubric** (in `agents/critic-agent.md`): Loop Fit / Metric Integrity / Attribution Honesty / Decision Discipline / Boundary Control / Ledger Correctness — each scored 0-10. Verdict: PASS ≥48/60 with no dimension <7; PASS_WITH_CONCERNS ≥42 with no dimension <6 + confidence/confounders surfaced; FAIL <42 or any dimension <6 or any of 7 Hard Fails.

## Philosophy

Measurement decides the ledger row. Heuristics inform diagnosis, but heuristics are NOT evidence. A heuristic teardown of a landing page can confidently recommend the wrong direction — the data might show the "conversion best practice" is actively hurting THIS audience. Heuristics are priors, not posteriors.

One primary metric per loop decides the ledger. Secondary metrics + qualitative evidence explain diagnosis; they do not override the loop's primary metric unless `program.md` defines an explicit guardrail failure (e.g., "conversion lift triggered guardrail: bounce rate increased >X%, treat as discard").

Attribution honesty over storytelling. Every verdict includes sample size or traffic volume when available, baseline comparability, confounders, and explicit confidence level. Low-confidence findings ship as `watch` or `blocked`, not `keep`. Confidence inflation is the failure mode of post-launch evaluation.

Evaluation does NOT redesign. improve-conversion recommends next changes and routes work; actual page revision goes to `improve-conversion` (inside the same loop), and execution artifacts go to appropriate content/design/build skills. The boundary is load-bearing — confusing eval with redesign produces unmeasured changes that break the loop's measurement chain.

## Methodology

**Three-layer orchestration, deliberate.**

- **Layer 1 (parallel):** metric-ingest + diagnosis. Metric-ingest normalizes the primary metric (name + value + units), baseline, sample size, measurement window, guardrails, and source caveats from `program.md` + `context.md` + `results.tsv` + the cycle's measurement evidence. Diagnosis connects observed outcomes to the page hypothesis (from upstream `strategy/`), the execution delta (from `execution/`), traffic/source context, and user behavior (heatmaps + recordings + form-funnel + sales notes).
- **Layer 2 (sequential):** recommendation-agent receives both Layer 1 outputs and proposes verdict + next actions + ledger row + learning promotion. Verdict is one of: `keep | discard | watch | blocked`. Next-cycle actions are scoped to `Keep:` / `Discard:` / `Watch:` / `Route next work to:` lines.
- **Layer 3:** critic-agent validates the assembled artifact + ledger row + learning update against the 6-dimension rubric + 7 Hard Fails. PASS → write artifact + append ledger row + run manifest-sync. FAIL → revise once. Still failing → write NO ledger row + return BLOCKED with missing evidence.

**Cycle resolution.** Cycle number is `last results.tsv cycle + 1`, unless the user explicitly names a cycle that has no existing eval artifact (out-of-order evaluation of a missed cycle).

**Side effects (in order):**
1. Write eval artifact at `.forsvn/artifacts/mkt/improve-conversion/evals/[date]-cycle-N.md` when the store exists; otherwise return inline
2. Append exactly one row to `results.tsv` via `bun a Markdown ledger row on the evaluation artifact (no TypeScript helper)` (validated helper, 8-column standard schema)
3. Update `learnings.md` only for high-confidence keep/discard lessons reusable beyond this exact page state (critic gates the promotion)
4. Run `bun manual manifest note if needed (no TypeScript helper)` to refresh the manifest

## Principles

- **6 Critical Gates are binary.** (1) Existing eval loop required — NEEDS_CONTEXT otherwise. (2) Measurement evidence required — not a heuristic audit. (3) One primary metric decides the ledger. (4) No fabricated analytics. (5) Attribution confidence must be explicit. (6) Evaluation does not redesign.
- **7 Critic Hard Fails are non-negotiable.** No `program.md` / no metric value-source-window / claimed improvement without baseline / generic heuristic as evidence / any fabricated number-logo-testimonial-quote-source / ledger status outside `keep | discard | watch | blocked` / learning promoted from low-confidence-or-blocked evidence.
- **Ledger correctness is enforced by helper script.** the Markdown ledger row on the evaluation artifact validates the 8-column standard schema (cycle / date / artifact / primary_metric / value / baseline / status / description). Do NOT hand-append rows — use the helper. Stretch fixture shows that custom 10+ column loops require schema migration (currently parked as known limitation in eval-loop owner's queue).
- **No ledger row on FAIL.** If critic FAILs after revision, return BLOCKED with missing evidence. The loop's ledger stays clean — no garbage rows.
- **Learning promotion is conservative.** `learnings.md` updates ONLY for high-confidence keep/discard lessons reusable beyond this exact page state. Low-confidence findings stay in the cycle artifact only.
- **Cycle decision metric is the primary metric from `program.md`.** Secondary metrics + qualitative evidence are diagnostic context, not verdict drivers. Guardrail failures (defined in `program.md`) can flip a keep to a discard regardless of primary metric.
- **The artifact IS the contract.** Frontmatter (10 fields: skill / version / date / status / summary / purpose / lifecycle / use_when / do_not_use_when / upstream / downstream) + 8 body sections (Title / Verdict / Evidence / What Changed This Cycle / Diagnosis / Next Cycle Recommendation / Results Row / Learning Promotion). Schema changes require atomic update across eval-loop spec + downstream learnings consumers.

## When NOT to use this skill

- **No existing eval-loop workspace.** Use `loop scaffolding outside this skill` first to scaffold `program.md` + `context.md` + `results.tsv` + strategy/execution/evals subdirs.
- **Need the next page brief or redesign.** Use `improve-conversion` — that's construction-time architecture, not post-launch scoring. improve-conversion routes recommendations TO lp-brief but does not produce briefs.
- **The issue is channel strategy, not landing-page evidence.** Use `plan-campaign` — channel mix lives there.
- **No measurement evidence at all.** improve-conversion returns BLOCKED. Either gather evidence first or use a different skill if a heuristic-only audit is genuinely what's needed (none of our skills do pure heuristic LP audits — that's intentional).
- **Want to redesign the page based on the eval.** improve-conversion recommends; `improve-conversion` redesigns. Run lp-brief separately after improve-conversion lands its verdict.
- **Custom 10+ column loop schema.** Stretch limitation — the Markdown ledger row on the evaluation artifact validates the 8-column standard schema. Loops with custom schemas need hand-edit or a schema migration (deferred to eval-loop owner's queue).

## Further reading

- [`../fallbacks/sequential.md`](../fallbacks/sequential.md) [PROCEDURE] — read order, Warm Start prompt, Cold Start 5-question bundle, hard-block conditions (no loop / no metric source-window / no current value), `--fast` behavior, write-back (none — eval-loop owns persistent state, not improve-conversion)
- [`../fallbacks/sequential.md`](../fallbacks/sequential.md) [PROCEDURE] — how to spawn a sub-agent, Layer 1 parallel dispatch (metric-ingest + diagnosis), Layer 2 sequential (recommendation), Layer 3 critic + revision-cycle, 8-step Dispatch procedure (resolve cycle → L1 → L2 → L3 → revise once → write artifact → append ledger → promote learning → manifest sync), the Markdown ledger row on the evaluation artifact invocation with full flag set, manifest-sync invocation
- [`format-conventions.md`](landing-format-conventions.md) [PROCEDURE] — full evaluation artifact template byte-identical (10-field frontmatter + 8 body sections), Evidence table format (6 columns: Signal / Current / Baseline / Window / Source / Caveat), Results Row format (8 columns), Learning Promotion field values, file paths, lifecycle declaration
- [`anti-patterns.md`](landing-anti-patterns.md) [ANTI-PATTERN] — extracted body-implicit patterns (generic heuristic audit, fabricated analytics, no-loop scoring, confidence inflation, scope drift, low-confidence learning promotion, ledger row on FAIL, custom-schema row append, missing primary metric, weak baseline comparability) + 4 cross-cutting marketing-stack patterns (upstream context skipped, cross-stack contract drift, polish-chain misroute, sibling-skill confusion with lp-brief)
- `references/landing-format-conventions.md` — canonical eval-loop specification (program.md + context.md + results.tsv schema + strategy/execution/evals subdirs)
- Shared: `references/anti-sycophancy.md`, `references/landing-eval-rubric.md`, and `fallbacks/sequential.md`
- Agents: 4 sub-agents in `agents/` — see Agent Manifest in SKILL.md. `critic-agent.md` holds the canonical 6-dimension Pass/Fail Rubric + 4-tier Verdict thresholds + 7 Hard Fails + Self-Check.
- `marketing-skills/CLAUDE.md` §"Pre-Dispatch Protocol" + §"Complexity Routing" + §"Multi-Agent Skills" — stack-level conventions this skill inherits
- Sibling coordination: `improve-conversion` (construction-time architecture; this skill routes recommendations TO lp-brief but does not produce briefs); loop scaffolding outside this skill (owns loop scaffolding + `program.md` + `context.md` + `results.tsv` schema + durable learning ledger)
