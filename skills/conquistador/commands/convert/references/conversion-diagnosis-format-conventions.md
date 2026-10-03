# Conversion diagnosis artifact contract

Store at `.forsvn/artifacts/mkt/improve-conversion/diagnosis/conversion-diagnosis.md` when the
optional store exists; otherwise return the same structure inline. Keep the singleton and
increment version on a scoped re-run, preserving prior evidence through the host's version history.

```yaml
skill: convert
version: 1
date: YYYY-MM-DD
status: done | done_with_concerns | blocked | needs_context
stack: mkt
review_surface: none
id: improve-conversion-diagnosis
type: canonical
keywords: [improve-conversion, conversion-diagnosis, root-cause, hypothesis-tree, metric-decline, if-then-because]
```

Keywords retain legacy routing labels; they do not mandate a sentence or diagram form. Date is
artifact creation, not proof that observations remain current. Record source windows in the body.

## Body structure

Keep `# Problem Analysis` and these phase headers in order.

### Phase 1: Problem Definition

Use `## Phase 1: Problem Definition` with:

- `### Problem Statement`: `[Metric] is [current] instead of [target/comparison]`, with units,
  source, population, window and absolute/relative gap calculation. Identify whether comparison
  is measured or aspirational. Missing values and prelaunch N/A remain explicit.
- `### Logic Tree`: legacy heading for a candidate evidence map, table or annotated calculation.
  No mandatory type, depth, branch count or box-drawing syntax. Each candidate has stable id,
  scope, proposed mechanism, predicted observation and evidence/unknown.
- `### Coverage and Dependencies`: shared events/users, common causes, mediation, interactions,
  omitted scope and deciding unknowns. Do not assert complete or independent cause coverage.
- `### External Factor Scan`: Factor / Finding / Status. Keep relevant competitor, market/seasonal,
  platform, policy, technology and macro considerations, with scope reasons when not applicable.
  Confirmed / Ruled Out / Possible tokens remain. Missing evidence is Possible with unavailable
  noted in Finding; Confirmed identifies an event, not automatically its causal effect.

### Phase 2: Hypotheses (Ranked by Testability)

Keep `## Phase 2: Hypotheses (Ranked by Testability)`. Number hypotheses by check order with
`### N. [Name]` and Priority HIGH / MEDIUM / LOW where used. State candidate/prediction/mechanism
and scope; If / Then / Because labels remain optional. Each record retains:

- Deciding data: the smallest evidence set that distinguishes the candidate from alternatives.
- Source: actual tool/export/report/field, window, definition and joins, or unresolved source.
- Owner: known owner or unassigned responsibility.
- Confirming: supporting pattern plus needed alternative checks.
- Rejecting: contradictory pattern; state ambiguous outcomes separately.
- Potential gap explained: supported units/range/percentage, or unknown with reason.

Add dependencies/overlap, collection cost and next decision. No minimum hypothesis count or forced
sum. Do not invent a mechanism, source or forecast to fill a required field.

### Phase 3: Root Cause Verdict

Keep `## Phase 3: Root Cause Verdict`, `### Verdict Table` and `### Root Cause Statement`.

| # | Hypothesis | Verdict | Evidence | Gap |
|---|---|---|---|---|
| [id] | [name] | Confirmed / Rejected / Inconclusive | [source, observation, scope and limit] | [supported contribution or unknown; label non-additive] |

Root Cause Statement uses numbered Root Cause entries only for supported causes. State evidence,
mechanism and contribution or unknown. Always include Unexplained and its next deciding data.
An entirely unknown attribution is valid. Numerical totals reconcile only when units, denominator,
attribution boundaries and interaction convention support that calculation. Do not force 100%.

### Next Step

Keep `## Next Step`. For supported cause handoff retain ``Run `prioritize` targeting:``
followed by supported causes and limitations. Otherwise name the data owner/request, reframe or
bounded Change/Test revision. Do not route an unresolved cause as confirmed to satisfy this phrase.

## Optional sections and conventions

Known Issues carries unresolved critic defects when the two-cycle revision cap is reached.
Change Log records actual artifact/evidence changes only, not historical agent-session diaries.
Use ISO dates, explicit currency/units, percentage points for rate differences, and an identified
reference denominator for relative differences. Preserve licenses and source attribution. No artifact
status, data request or critic verdict authorizes new live collection or an external change.
