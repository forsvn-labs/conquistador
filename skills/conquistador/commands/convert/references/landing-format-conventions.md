---
title: Improve-conversion Format Conventions
lifecycle: canonical
status: stable
produced_by: convert
load_class: PROCEDURE
---

# Post-launch evaluation format

> Format rules for the `convert` cycle artifact + results.tsv row + learnings.md promotion. Cited from COMMAND.md "Artifact Contract" + "Evaluation Artifact Template" + "Results Row Discipline" sections. Schema changes require one coordinated update of this file, the loop files, and their readers.

## Output locations

Paths assume the host has a `.forsvn` artifact store. When it does not, use operator-supplied loop
files and return artifacts inline using the same schema.

| Path | Lifecycle | Behavior |
|---|---|---|
| `.forsvn/artifacts/mkt/improve-conversion/evals/YYYY-MM-DD-cycle-N.md` | evaluation | Primary artifact, one per cycle |
| `.forsvn/artifacts/mkt/improve-conversion/results-ledger.md` | evaluation | Append exactly one 8-column row in the format below |
| `.forsvn/artifacts/mkt/improve-conversion/learnings.md` | learning | Update ONLY for high-confidence keep/discard lessons reusable beyond this exact page state; critic gates the promotion |

## File naming

- **Eval artifact:** `YYYY-MM-DD-cycle-N.md` — ISO date + cycle number resolved from `last results.tsv cycle + 1` (or explicit cycle when out-of-order)
- **Slug** = the eval-loop slug (from `program.md` frontmatter)
- **Cycle number** = `last results.tsv cycle + 1`, unless user explicitly names a cycle that has no existing eval artifact (rare out-of-order case)

## Frontmatter schema (10 fields)

```yaml
---
skill: convert
version: 1
date: YYYY-MM-DD
status: done | done_with_concerns | blocked | needs_context
summary: "[page] cycle N landing-page evaluation"
purpose: "Post-launch evidence snapshot for a landing-page eval loop"
lifecycle: evaluation
use_when: "Deciding whether to keep, discard, watch, or block the current landing-page cycle"
do_not_use_when: "Designing the next page revision without reading the latest loop context and results"
upstream: ".forsvn/artifacts/mkt/improve-conversion/program.md, context.md, strategy/, execution/, metric source"
downstream: "results.tsv, learnings.md, next diagnosis cycle"
---
```

Date format: ISO `YYYY-MM-DD`. `lifecycle: evaluation` is required (eval-loop spec — see `references/landing-format-conventions.md`).

## Body section structure (8 sections, in order)

1. **Title** — H1 `# [Page] Cycle N Evaluation`
2. **Verdict** — 4 bullets: Status / Confidence / Primary metric / Decision (one sentence)
3. **Evidence** — table (Signal / Current / Baseline / Window / Source / Caveat columns)
4. **What Changed This Cycle** — strategy/execution artifact links or operator notes
5. **Diagnosis** — Likely Drivers + Confounders (two H3 subsections)
6. **Next Cycle Recommendation** — Keep / Discard / Watch / Route-next-work-to lines
7. **Results Row** — fenced TSV block with the 8-column row (cycle / date / artifact / primary_metric / value / baseline / status / description)
8. **Learning Promotion** — Promote to learnings.md (yes/no) + Lesson + Expiry/caveat

## Full evaluation artifact template (byte-identical)

Save to `.forsvn/artifacts/mkt/improve-conversion/evals/YYYY-MM-DD-cycle-N.md`:

```markdown
---
skill: convert
version: 1
date: YYYY-MM-DD
status: done | done_with_concerns | blocked | needs_context
summary: "[page] cycle N landing-page evaluation"
purpose: "Post-launch evidence snapshot for a landing-page eval loop"
lifecycle: evaluation
use_when: "Deciding whether to keep, discard, watch, or block the current landing-page cycle"
do_not_use_when: "Designing the next page revision without reading the latest loop context and results"
upstream: ".forsvn/artifacts/mkt/improve-conversion/program.md, context.md, strategy/, execution/, metric source"
downstream: "results.tsv, learnings.md, next diagnosis cycle"
---

# [Page] Cycle N Evaluation

## Verdict

- Status: keep | discard | watch | blocked
- Confidence: high | medium | low | blocked
- Primary metric: [name] = [value] vs [baseline]
- Decision: [one sentence]

## Evidence

| Signal | Current | Baseline | Window | Source | Caveat |
|---|---:|---:|---|---|---|
| primary metric |  |  |  |  |  |

## What Changed This Cycle

- [strategy/execution artifact or operator note]

## Diagnosis

### Likely Drivers

- [driver tied to evidence]

### Confounders

- [traffic mix, seasonality, campaign change, tracking issue, sample size]

## Next Cycle Recommendation

- Keep:
- Discard:
- Watch:
- Route next work to:

## Results Row

```tsv
cycle	date	artifact	primary_metric	value	baseline	status	description
N	YYYY-MM-DD	evals/YYYY-MM-DD-cycle-N.md	metric	value	baseline	keep|discard|watch|blocked	description
```

## Learning Promotion

- Promote to `learnings.md`: yes | no
- Lesson:
- Expiry / caveat:
```

## Evidence table format

Six columns mandatory:

| Signal | Current | Baseline | Window | Source | Caveat |

- **Signal** — name of the metric (primary metric mandatory; secondary metrics optional below)
- **Current** — current cycle's value with units (right-aligned in markdown)
- **Baseline** — comparison value with units (right-aligned)
- **Window** — measurement window (date range, traffic count, or sample N)
- **Source** — tool/system the metric came from (GA4 / Mixpanel / Posthog / Hotjar / manual operator notes / etc.)
- **Caveat** — sample-size warning, tracking-issue note, attribution caveat, source freshness flag

Unknown values stay unknown. Manual notes are allowed only when labeled as operator-supplied + tied to a date/window/source.

## Results Row format (8 columns mandatory)

```text
cycle	date	artifact	primary_metric	value	baseline	status	description
```

Rules:

- `artifact` is relative to the loop folder, e.g. `evals/2026-05-13-cycle-2.md`
- `status` must be `keep`, `discard`, `watch`, or `blocked` (Critic Hard Fail #6 otherwise)
- `description` is one sentence without tabs
- Append the row in this order of fields:

```text
cycle	date	evals/YYYY-MM-DD-cycle-N.md	<primary metric>	<current value>	<baseline value>	<keep|discard|watch|blocked>	<one sentence without tabs>
```

- Do NOT append a row if the Critic verdict is FAIL. Return `BLOCKED`.

### Known limitation — custom schemas

The standard row has 8 columns. A loop with a custom schema (for example, guardrail values in each row) needs its own row format; ask the loop owner before appending, and never force a standard row into a custom ledger.

## Learning Promotion rules

`learnings.md` is the loop's **durable** record of validated lessons. Promotion is conservative — most cycles do NOT promote.

| Promotion | Criteria |
|---|---|
| **yes** | High-confidence (`confidence: high` in verdict) AND status = `keep` or `discard` AND lesson is reusable beyond this exact page state (e.g., "Audience X rejects pricing density above 5 tiers" generalizes; "Hero CTA color #FF6 lifts conversion 4% on this exact page" does not) |
| **no** | Low-confidence OR `watch`/`blocked` status OR lesson is page-specific (won't generalize) |

Critic Hard Fail #7 enforces — learning promoted from low-confidence-or-blocked evidence triggers FAIL. Critic owns gate-keeping on promotion.

Lesson format:

```markdown
## YYYY-MM-DD — [one-line lesson]

- **Cycle:** [loop-slug] cycle N
- **Evidence:** [primary metric delta with sample size + confidence]
- **Expiry / caveat:** [when does this lesson stop being true? — e.g., "if pricing tiers drop below 3, retest"]
```

## Side effects (executed in order after critic PASS)

1. **Write eval artifact** at `.forsvn/artifacts/mkt/improve-conversion/evals/YYYY-MM-DD-cycle-N.md` when the store exists; otherwise return inline
2. **Append the ledger row** in the 8-column format
3. **Update learnings.md** ONLY if critic approved promotion (high-confidence keep/discard reusable lesson)

If critic FAIL after revision: skip all side effects. Return BLOCKED with missing evidence.

## Cross-stack contract

This skill produces:
- `evals/[date]-cycle-N.md` — consumed by future `convert` cycles (read prior cycles for trend), by the next diagnosis cycle (which reads the latest evaluation for its hypothesis), and by humans reviewing loop progress
- `results.tsv` row — appended to the loop's ledger; consumed by any skill reading the loop's status (dashboard skills, ledger-summary skills, downstream campaign-plan retrospectives)
- `learnings.md` update — high-confidence lessons reusable beyond this page state; consumed by future diagnosis cycles, `campaign`, and humans

The evaluation reads loop-local strategy and execution artifacts. A page brief from `copy` or the `landing` play enters the loop only when it is copied into the loop's `strategy/` folder.

Schema changes (frontmatter fields, body section structure, Evidence table columns, Results Row columns, learnings.md format) require one coordinated update of this file and its readers — never silently drift.
