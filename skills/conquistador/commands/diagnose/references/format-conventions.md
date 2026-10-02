# Format Conventions — `diagnose` Artifact

> Load when writing the output artifact. Encodes the canonical artifact template (frontmatter + 3-phase body + Next Step), the Logic Tree code-fence convention, the External Factor Scan 6-row table, the hypothesis format (If/Then/Because + Deciding data / Source / Owner / Confirming / Rejecting / Potential gap explained), the Verdict Table column schema (cross-stack contract), and the Root Cause Statement format.

---

## Artifact path

`.forsvn/artifacts/mkt/diagnose-growth/DIAGNOSE.md`

Canonical singleton — the current diagnosis of record. On re-run: overwrite `DIAGNOSE.md` in place and increment `version`. Never create a `.v[N].md` sibling — prior runs live in git history.

---

## Frontmatter (required)

```yaml
---
skill: diagnose
version: [N]                          # increment on re-run
date: [YYYY-MM-DD]
status: done | done_with_concerns | blocked | needs_context
stack: mkt
review_surface: none
id: diagnose
type: canonical
keywords: [diagnose-growth, root-cause, hypothesis-tree, metric-decline, if-then-because]
---
```

**Field semantics:**
- `version`: integer, 1 on first run, increment on every subsequent run (overwrite in place — the singleton holds the latest diagnosis only).
- `date`: artifact creation date, ISO-8601. Drives the 30-day staleness check on downstream consumers (prioritize reads `date` to decide whether to recommend re-diagnosis).
- `status`: per the Completion Status block in COMMAND.md.
- `id`: stable `diagnose` — consumers resolve it via `find-artifacts --resolve diagnose-growth`; never changes.

---

## Body structure (in order — cross-stack contract)

The artifact opens with a header (`# Problem Analysis`) then has three top-level phases plus a Next Step. Downstream consumers (prioritize, `funnel`, campaign-plan, system-architecture) parse by phase header — renaming or reordering breaks the contract.

### Header block

```markdown
# Problem Analysis
```

### Phase 1: Problem Definition

Four sub-sections in this order.

#### Problem Statement

```markdown
## Phase 1: Problem Definition

### Problem Statement

[Metric] is [current] instead of [target], a gap of [X%/X units].
Started: [when]. Inflection point: [if known].
```

**Format rule (cross-stack contract):** the single sentence must follow `[Metric] is [current] instead of [target]` exactly. Critical Gate 1 fails the artifact if the statement is missing either number.

#### Logic Tree

```markdown
### Logic Tree

[Representation: equation, table or diagram; explain choice]

​```
[Problem statement]
├── [Branch 1]
│   ├── [Leaf 1a]
│   ├── [Leaf 1b]
│   └── [Leaf 1c]
├── [Branch 2]
│   ├── [Leaf 2a]
│   └── [Leaf 2b]
└── [Branch 3]
    ├── [Leaf 3a]
    └── [Leaf 3b]
​```
```

**Format rules:**
- Explain the representation using `references/diagnostic-evidence-method.md`; separate accounting relationships from causal candidates.
- Include the material alternatives and stop at useful discriminating observations; no fixed depth or count is required.
- Use readable labels and relationships. A diagram, equation or table is acceptable when it preserves the evidence and dependencies.
- Each leaf is a testable cause (Critic Gate 3) — not a restatement of the problem.

#### Coverage and Dependencies

```markdown
### Coverage and Dependencies

- Dependencies: [shared causes or records and double-counting treatment]
- Coverage: [measurement checks, external factors, omitted scope and untested alternatives]
```

#### External Factor Scan

```markdown
### External Factor Scan

| Factor | Finding | Status |
|--------|---------|--------|
| Competitor launch | [result] | Confirmed / Ruled Out / Possible |
| Market/seasonal shift | [result] | [status] |
| Platform/algorithm change | [result] | [status] |
| Regulatory/policy change | [result] | [status] |
| Technology change | [result] | [status] |
| Macro-economic conditions | [result] | [status] |
```

**Format rule:** all 6 rows present even if all are "Ruled Out". Omitting rows breaks Critical Gate 2 ("Do NOT skip external factors"). Status values are `Confirmed` / `Ruled Out` / `Possible` only — no other strings.

### Phase 2: Hypotheses (Ranked by Testability)

```markdown
## Phase 2: Hypotheses (Ranked by Testability)

### 1. [Short name] — Priority: HIGH
**If** [cause], **then** [observable evidence], **because** [mechanism].
- **Deciding data:** [specific data point]
- **Source:** [Tool → Report → Metric]
- **Owner:** [person/team]
- **Confirming:** [what you'd see if true]
- **Rejecting:** [what you'd see if false]
- **Potential gap explained:** [estimate with scope or unknown]
```

**Format rules (cross-stack contract — every hypothesis must include all 6 sub-fields):**

| Field | Required | Notes |
|---|---|---|
| `### N. [Short name] — Priority: HIGH / MEDIUM / LOW` | yes | Numbered 1-through-N matching the testability ranking |
| `**If** X, **then** Y, **because** Z` | legacy labels | Legacy labels for the candidate, observable prediction and proposed mechanism or explicit unknown. Literal sentence wording is not a quality gate. |
| `**Deciding data:** [data point]` | yes | Observation or comparison that distinguishes the candidate from alternatives |
| `**Source:** [Tool → Report → Metric]` | yes | Full path (Critic Gate 7); "check analytics" fails the gate |
| `**Owner:** [person/team]` | yes | Named person or team |
| `**Confirming:** [what you'd see if true]` | yes | Specific observable |
| `**Rejecting:** [what you'd see if false]` | yes | Falsifiability requirement |
| `**Potential gap explained:** [estimate with scope or unknown]` | yes | Estimate of how much of the gap this hypothesis would account for if Confirmed |

**Count:** Include consequential candidates and relevant alternatives. Do not create hypotheses to meet a quota.

### Phase 3: Root Cause Verdict

#### Verdict Table

```markdown
## Phase 3: Root Cause Verdict

### Verdict Table

| # | Hypothesis | Verdict | Evidence | Gap |
|---|-----------|---------|----------|-----|
| 1 | [Short name] | Confirmed / Rejected / Inconclusive | [Specific data cited] | ~X% |
| 2 | ... | ... | ... | ... |
```

**Column rules (cross-stack contract — do not change without atomic update of consumers):**

| Column | Type | Notes |
|---|---|---|
| # | integer | Matches Phase 2 hypothesis numbering |
| Hypothesis | string | Short name from Phase 2 |
| Verdict | enum: Confirmed / Rejected / Inconclusive | Exact casing matters — downstream consumers grep these strings |
| Evidence | string | Specific data cited (Critic Gate 9); "seems likely" fails |
| Gap | estimate or unknown | Scope, inputs and allocation required for any quantitative contribution |

#### Root Cause Statement

```markdown
### Root Cause Statement

**Root Cause 1 ([contribution or unknown]):** [Cause], evidenced by [data].
[One sentence explaining the mechanism.]

**Root Cause 2 ([contribution or unknown]):** [Cause], evidenced by [data].
[One sentence explaining the mechanism.]

**Unexplained ([residual or unknown]):** [Description]. Next data needed: [what], from [where].
```

**Format rules:**
- Each Confirmed verdict produces one numbered Root Cause line with a contribution estimate or explicit unknown.
- Reconcile compatible observed quantities with interactions and residuals. Unknown causal shares must not be invented to force a percentage total.
- Include Unexplained with residual values or unknown attribution. A zero arithmetic residual does not prove complete causal understanding.

### Next Step

```markdown
## Next Step

Run `prioritize` targeting:
1. [Root cause 1 — specific aspect to solve]
2. [Root cause 2 — specific aspect to solve]
```

This block is **verbatim** — downstream `forsvn` and `prioritize` grep the literal `"Run "` + backtick + `"prioritize-opportunities"` + backtick + `" targeting:"` phrase for chain handoff detection.

---

## Optional sections (append only when applicable)

### Known Issues (only if critic FAIL loops hit cap and status is `done_with_concerns`)

```markdown
## Known Issues

[List the critic's last-cycle verdict verbatim, the 10-point gates that failed, the agent that owns each, and the reason the loop stopped.]
```

### Change Log (only on re-run)

```markdown
## Change Log

- [YYYY-MM-DD] [What changed and why — e.g., "Metric stabilized at 3.8% vs prior 3.2% baseline. Re-ran tree; Root Cause 2 now Resolved; Root Cause 1 persists."]
```

---

## Date format

ISO-8601 (`YYYY-MM-DD`). Never `MM/DD/YYYY` or relative ("last Tuesday").

## Number format

- **Percentages:** one decimal place by default (`3.2%`, `40.0%`), no trailing zeros for whole numbers (`5%` not `5.0%`).
- **Gap estimates:** use `~X%` only for a supported estimate with scope and inputs. Otherwise use unknown; retain interaction and residual information.
- **Currency:** prefix symbol (`$120`), thousands separator (`$1,800`).
- **Counts with periods:** `200 weekly signups` not `200`.

## Citation format (in Evidence column)

Cite the actual observation with its unit, population, window and exact source record. Do not use a plausible-looking report path or invented metric as an example of inspected evidence.

Vague citations fail Critic Gate 9. "Seems likely" is not Confirmed. "Analytics shows X" is too vague — name the specific report.

---

## Anti-patterns in formatting

- **Renaming columns in the Verdict Table.** Cross-stack contract breaks; downstream consumers skip rows.
- **Reordering Phase 1 / Phase 2 / Phase 3 / Next Step.** Same problem — consumers parse by section order.
- **Omitting External Factor Scan rows when all are Ruled Out.** All 6 rows must be present — that's how Critical Gate 2 ("don't skip external factors") gets visible compliance.
- **Opaque diagram structure.** Labels must distinguish evidence, accounting terms, causes and dependencies. Character style is not a quality gate.
- **Hypotheses missing one of the 6 sub-fields.** Retain the data requirements and explicit unknowns; a missing value must not be fabricated to pass a format check.
- **Root Cause Statement without Unexplained line.** Preserve residual uncertainty and reconcile only compatible quantities under Critic Gate 10.
- **Verbatim Next Step block paraphrased.** Downstream chain detection greps the literal `"Run \`prioritize\` targeting:"` phrase.
- **Verdicts like "Confirmed (?)" or "mostly Confirmed".** Enum strict: Confirmed / Rejected / Inconclusive. No qualifiers.
