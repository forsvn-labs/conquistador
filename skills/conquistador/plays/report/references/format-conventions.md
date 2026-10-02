---
title: Content-Eval Format Conventions
lifecycle: canonical
status: stable
produced_by: evaluate-content
load_class: PROCEDURE
---

# Content-Eval Format Conventions

> Format rules for the evaluate-content cycle artifact + results.tsv row + learnings.md promotion. Cited from SKILL.md "Artifact Contract" + "Evaluation Artifact Template" + "Results Row Discipline" sections. Schema changes require atomic update across `_shared/eval-loop-spec.md` + write-social (which produces the source artifact read by evaluate-content) + eval-loop owner.

Uses the shared evaluation conventions for frontmatter, the 8-column Results Row and the 6-column
Evidence table. Persistence follows the parent learning standard below.

## Persistence consent

Follow the [shared learning standard](../../../standards/learning.md). Before any persistent write,
show the exact entry and destination and obtain explicit user approval. This applies to the eval
artifact, ledger row, learning entry and any override note or manifest change. Use an approved
private project store outside the product installation. Reuse approval only while its exact
content and destination remain unchanged.

A critic PASS is a quality check, not write permission. Accepting the content, approving publication
or requesting a revision does not authorize persistence. Until consent exists, return the proposed
content in the conversation and leave files unchanged. Approval to save an evaluation or ledger row
does not authorize a learning write. In the template, promotion `yes` means eligible to propose;
it never means permission to write.

## Output locations

| Path | Lifecycle | Behavior |
|---|---|---|
| `.forsvn/loops/[slug]/evals/YYYY-MM-DD-cycle-N.md` | evaluation | Propose one artifact per cycle and primary platform; save only after exact-content and destination approval |
| `.forsvn/loops/[slug]/results.tsv` | evaluation | Validate one 8-column row; append only after exact-row and destination approval |
| `.forsvn/loops/[slug]/learnings.md` | learning | Propose only eligible high-confidence keep/discard lessons; require separate exact-entry and destination approval before writing |

## File naming

- **Eval artifact:** `YYYY-MM-DD-cycle-N.md` — ISO date + cycle number resolved from `last results.tsv cycle + 1` (or explicit cycle when out-of-order)
- **Slug** = the eval-loop slug (from `program.md` frontmatter)
- **Cycle number** = `last results.tsv cycle + 1`, unless the user explicitly names a cycle that has no existing eval artifact (rare out-of-order case)
- **One cycle = one primary platform.** If the operator runs evaluate-content twice for the LinkedIn and Instagram cuts of the same content, the cycles are numbered sequentially (cycle-3 linkedin, cycle-4 instagram) — NOT cycle-3-linkedin and cycle-3-instagram. The ledger row's description disambiguates by including the primary-platform tag.

## Frontmatter schema (10 fields + generation provenance per D8)

```yaml
---
skill: evaluate-content
version: 1
date: YYYY-MM-DD
status: done | done_with_concerns | blocked | needs_context
summary: "[content-or-primary-platform] cycle N content evaluation"
purpose: "Post-publish evidence snapshot for an organic-content eval loop, scoped to one primary platform"
lifecycle: evaluation
use_when: "Deciding whether to keep, discard, watch, or block the current content cycle"
do_not_use_when: "Authoring next-cycle copy without reading the latest loop context and results"
upstream: ".forsvn/loops/[slug]/program.md, context.md, strategy/, execution/, docs/forsvn/artifacts/marketing/copy/[platform]-[date]-[slug].md, metric source"
downstream: "results.tsv, learnings.md, write-social next-cycle brief"
provenance:
  skill: evaluate-content
  run_date: YYYY-MM-DD
  input_artifacts:
    - docs/forsvn/artifacts/marketing/copy/[platform]-[date]-[slug].md
    - brand/BRAND.md
    - research/icp-research.md
  output_eval: null
---
```

Date format: ISO `YYYY-MM-DD`. `lifecycle: evaluation` is required (eval-loop spec — see `_shared/eval-loop-spec.md`). `provenance` block is the D8 generation-provenance contract — see `_shared/artifact-contract-template.md` § Generation provenance.

## Body section structure (8 sections, in order)

1. **Title** — H1 `# [Content or Primary-Platform] Cycle N Evaluation`
2. **Verdict** — 5 bullets: Status / Confidence / Primary-Platform / Primary metric / Decision (one sentence)
3. **Evidence** — table (Signal / Current / Baseline / Window / Source / Caveat columns) — scoped to the primary platform; content signals (engagement rate, saves, shares, comments, click-through, conversions, reach) populated as rows
4. **What Changed This Cycle** — source write-social artifact link + hook/format/visual/CTA/posting changes since prior cycle
5. **Diagnosis** — Likely Drivers + Engagement-Quality Signals + Cross-Platform Context + Confounders (4 H3 subsections)
6. **Next Cycle Recommendation** — Keep / Discard / Watch / Route-next-work-to lines (component granularity, not "the content plan")
7. **Results Row** — fenced TSV block with the 8-column row (cycle / date / artifact / primary_metric / value / baseline / status / description) — description includes the primary platform
8. **Learning Promotion** — Promote to learnings.md (yes/no) + Lesson + Expiry/caveat (platform/format scoped)

## Full evaluation artifact template

Proposed destination, subject to persistence consent: `.forsvn/loops/[slug]/evals/YYYY-MM-DD-cycle-N.md`.

```markdown
---
skill: evaluate-content
version: 1
date: YYYY-MM-DD
status: done | done_with_concerns | blocked | needs_context
summary: "[content-or-primary-platform] cycle N content evaluation"
purpose: "Post-publish evidence snapshot for an organic-content eval loop, scoped to one primary platform"
lifecycle: evaluation
use_when: "Deciding whether to keep, discard, watch, or block the current content cycle"
do_not_use_when: "Authoring next-cycle copy without reading the latest loop context and results"
upstream: ".forsvn/loops/[slug]/program.md, context.md, strategy/, execution/, docs/forsvn/artifacts/marketing/copy/[platform]-[date]-[slug].md, metric source"
downstream: "results.tsv, learnings.md, write-social next-cycle brief"
provenance:
  skill: evaluate-content
  run_date: YYYY-MM-DD
  input_artifacts:
    - docs/forsvn/artifacts/marketing/copy/[platform]-[date]-[slug].md
    - brand/BRAND.md
    - research/icp-research.md
  output_eval: null
---

# [Content or Primary-Platform] Cycle N Evaluation

## Verdict

- Status: keep | discard | watch | blocked
- Confidence: high | medium | low | blocked
- Primary-Platform: linkedin | instagram | x | facebook | threads | ...
- Primary metric: [name] = [value] vs [baseline]
- Decision: [one sentence — includes the primary platform]

## Evidence

| Signal | Current | Baseline | Window | Source | Caveat |
|---|---:|---:|---|---|---|
| primary metric |  |  |  |  |  |
| engagement rate |  |  |  |  |  |
| saves |  |  |  |  |  |
| shares |  |  |  |  |  |
| comments |  |  |  |  |  |
| likes |  |  |  |  |  |
| click-through |  |  |  |  |  |
| reach / impressions |  |  |  |  |  |

## What Changed This Cycle

- Source write-social artifact: `docs/forsvn/artifacts/marketing/copy/[platform]-[date]-[slug].md`
- Hook/format/visual/CTA/posting delta from prior cycle:

## Diagnosis

### Likely Drivers

- [driver tied to evidence]

### Engagement-Quality Signals

- meaningful_engagement: [saves + shares + comments + click-through — absolute + % of reach]
- vanity_engagement: [likes + impressions + views]
- meaningful_to_vanity_ratio: [computed]
- quality_read: strong | mixed | vanity-heavy | weak
- qualitative_sentiment: [positive | mixed | negative | none-observed — quote actual comments, do not fabricate]

### Cross-Platform Context

- [secondary platform]: [headline metric] — [one-line read] — CONTEXT ONLY, not a verdict input

### Confounders

- [algorithm change, posting-time shift, follower-count change, cross-post cannibalization, seasonality, external event, a single viral comment skewing the thread]

## Next Cycle Recommendation

- Keep: [component-level, not "the content"]
- Discard:
- Watch:
- Route next work to: write-social | publish-social | produce-asset | run-pipeline | none

## Results Row

```tsv
cycle	date	artifact	primary_metric	value	baseline	status	description
N	YYYY-MM-DD	evals/YYYY-MM-DD-cycle-N.md	metric	value	baseline	keep|discard|watch|blocked	[primary-platform] description
```

## Learning Promotion

- Promote to `learnings.md`: yes | no
- Lesson: [eligible platform/format-scoped lesson, or working hypothesis held in conversation]
- Expiry / caveat: [platform scope? format scope? audience scope? what would break this lesson?]
```

## Evidence table format

Six columns mandatory:

| Signal | Current | Baseline | Window | Source | Caveat |

- **Signal** — name of the metric (primary metric mandatory; secondary metrics include engagement rate, saves, shares, comments, likes, click-through, reach/impressions)
- **Current** — current cycle's value with units (right-aligned in markdown)
- **Baseline** — comparison value with units (right-aligned)
- **Window** — measurement window (date range + days + reach or impression count)
- **Source** — tool/system the metric came from (native platform analytics / third-party dashboard / operator-supplied / etc.)
- **Caveat** — sample-size warning, algorithm-change note, posting-time shift, source-freshness flag

Unknown values stay unknown. Manual notes are allowed only when labeled as operator-supplied + tied to a date/window/source.

**Content-specific signal expectations:** primary metric is always populated (per Critical Gate 3). Engagement is always reported as the 4-way breakdown (likes / saves / shares / comments) — never a single blended number (per Critic Hard Fail discipline + the Engagement-Quality dim). Click-through + conversions are populated when defined in program.md guardrails OR relevant to the loop's primary metric.

## Results Row format (8 columns mandatory)

```text
cycle	date	artifact	primary_metric	value	baseline	status	description
```

Rules:

- `artifact` is relative to the loop folder, e.g. `evals/2026-05-19-cycle-1.md`
- `status` must be `keep`, `discard`, `watch`, or `blocked` (Critic Hard Fail #7 otherwise)
- `description` is one sentence without tabs AND must include the primary-platform tag (Critic Hard Fail #8 otherwise)
- Check the existing header, cycle number, all eight columns and the evidence behind each value.
  Prepare the exact row for review. After critic PASS or accepted PASS_WITH_CONCERNS, obtain explicit
  user approval of the row and destination before using the host's file tools to append it once.
  Do not overwrite an existing cycle.

This distribution does not include `scripts/append-loop-result.ts` or `scripts/manifest-sync.ts`.
Do not invoke either as an installation requirement. A host-owned helper is optional and requires
verification of its availability and behavior; it cannot replace persistence consent.

Example description: `"linkedin save rate 3.1% over 7d — keep hook+format, revise CTA per low click-through"`. The `linkedin` prefix is the primary-platform tag.

- Do NOT append a row if the Critic verdict is FAIL. Return `BLOCKED`.

### Custom schemas

If the existing header differs from the eight-column schema, stop before writing and return the
proposed row with the mismatch. Do not silently migrate or hand-edit a custom ledger. A schema
migration requires its own reviewed changes and explicit destination approval.

## Learning Promotion rules

`learnings.md` is the loop's **durable** record of validated lessons. Promotion is conservative — most cycles do NOT promote. Platform/format scope is mandatory in the lesson.

| Promotion | Criteria |
|---|---|
| **yes** | High-confidence (`confidence: high` in verdict) AND status = `keep` or `discard` AND lesson is reusable beyond this content piece AND meets the shared learning standard. This is eligibility to propose, subject to separate persistence consent. |
| **no** | Medium, low or blocked confidence OR `watch`/`blocked` status OR a single observation or two-cycle result OR a content-specific lesson OR a vanity spike (Critic Hard Fail #9). |

Keep a single observation or two-cycle result as a working hypothesis in the conversation, not a
durable rule. Critic Hard Fail #9 rejects promotion when these evidence requirements fail. A critic
can assess eligibility but cannot grant persistence consent. User approval does not turn weak
evidence into a validated lesson.

Lesson format:

```markdown
## YYYY-MM-DD — [one-line lesson — include platform/format scope]

- **Cycle:** [loop-slug] cycle N
- **Primary-platform:** [platform]
- **Evidence:** [primary metric delta with sample size + reach + confidence]
- **Evidence class:** observed | inferred | assumed
- **Expiry / caveat:** [when does this lesson stop being true? — e.g., "if the platform changes its engagement-rate denominator, retest"]
- **Disconfirmer and recheck trigger:** [what would invalidate it, and when to check again]
```

## Writes after review and consent

Prepare the complete proposed changes before seeking consent. After critic PASS, or accepted
PASS_WITH_CONCERNS, apply only the writes whose exact content and destinations the user approved:

1. Save the eval artifact at `.forsvn/loops/[slug]/evals/YYYY-MM-DD-cycle-N.md`.
2. Append the validated ledger row once. If an override note is needed, obtain approval for its
   exact entry and destination and save it before the row.
3. Update `learnings.md` only when the lesson meets the evidence rules and has separate exact-entry
   and destination consent. A `keep` decision alone never permits this write.

There is no required manifest-sync step. Any host-owned manifest change needs the same explicit
consent. If critic FAIL remains after revision, skip all writes and return BLOCKED with missing
evidence. If consent is absent, return the draft and leave files unchanged.

## Cross-stack contract

This skill proposes the following outputs. Save only the approved content at approved destinations:

- `evals/[date]-cycle-N.md` — consumed by future evaluate-content cycles (read prior cycles for trend), by `write-social --rev=N+1` (latest eval seeds the next content's hypothesis), and by humans reviewing loop progress
- `results.tsv` row — after approval, appended to the loop's ledger; consumed by any skill reading the loop's status (dashboard skills, ledger-summary skills, downstream campaign retrospectives)
- `learnings.md` update — only eligible, separately approved high-confidence platform/format-scoped lessons; consumed by future write-social cycles + by humans

This skill does NOT directly consume write-social output via cross-skill import. write-social MIGHT be the strategy/execution artifact for the eval-loop cycle (its `docs/forsvn/artifacts/marketing/copy/[platform]-[date]-[slug].md` copied or linked into the loop's `execution/` directory); evaluate-content reads loop-local strategy/execution artifacts AND the source write-social artifact path stored in provenance. The coordination contract between write-social and evaluate-content is at the eval-loop boundary + the provenance.input_artifacts pointer, not at a shared-schema boundary.

Schema changes (frontmatter fields, body section structure, Evidence table columns, Results Row columns, learnings.md format) require atomic update of `format-conventions.md` + `_shared/eval-loop-spec.md` + downstream callers — never silently drift.
