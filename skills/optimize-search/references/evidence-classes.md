# Evidence classes

Keep these labels on each material claim, observation and unavailable cell. Source identity is
not a universal confidence rank. Scope, collection method and claim support determine what can
be concluded. Measurement artifacts retain observations; interpretations travel in the strategy
handoff instead of becoming measured cells.

| Label | Meaning | Required record |
|---|---|---|
| public-doc | A supplied or actually inspected public source supports this claim | URL, title/version, relevant passage, publication/access date as available, and scope limits |
| observed-test | Captured structured test/export evidence with auditable collection details | Source artifact, method, eligible units, settings, time/window, denominators and exclusions |
| single-run | One captured answer or search observation | Exact query, interface, locale/settings, model if exposed, time, response and citation artifacts |
| practitioner-inference | An interpretation of identified observations | Underlying evidence, reasoning, competing explanations and limits; not a vendor fact |
| hypothesis | A proposed relationship not established by the evidence | Comparison, observable outcome, decision rule, window, budget and stop condition |
| unavailable | A requested observation or source is missing | Reason and matching input/readiness ledger entry; exclude from outcome denominators |

Public documentation does not prove effects beyond its stated context. An export is not reliable
just because it is structured. Verify keys, scope, definitions, completeness and provenance before
using it. Preserve source licenses and required attribution. Never invent an access date.

## Captured answers and repeated observations

A single answer is single-run, not a stable rate. Repeated captured runs can be summarized as
observed-test when the collection is auditable, but no fixed run count grants confidence. Report
cited/completed and mentioned/completed separately, along with the number of runs, settings,
dependencies, exclusions and variability. Do not call citation frequency agreement: disagreement
between repetitions and frequency of a positive outcome are different summaries.

Keep source support, citation display and URL resolution separate. A resolved URL does not prove
that its page supports the quoted claim. No displayed URL leaves source provenance unknown.
Repeated observations can support a bounded description; causality still needs a defensible design.

## Cell, row and aggregate tags

Tag each material claim. A row with unavailable cells stays partial; a strategy inference does
not overwrite the tags on its source observations. Report aggregate tag composition and missing
cells explicitly. Preserve existing evidence-classes frontmatter counts where the artifact
contract requires them, using cell-level tags and avoiding row/aggregate double counting.

Measurement accepts public-doc, observed-test, single-run and unavailable. It reports
practitioner-inference: 0 and hypothesis: 0 in its measurement index. Put the interpretation or
proposed test in handoff-optimize-search.md with links to the original cells.

Strategy can use every label. An untagged provider-behavior claim defaults to hypothesis until
supported. A private-prompt story is inadmissible. A hypothesis-only predicted citation effect
cannot justify P1/Critical/High. A demonstrated factual or access defect can have urgent priority
for its actual impact without claiming an unmeasured citation gain.

## Changes across snapshots

Record evidence_class_change when new captures alter a cell's evidence basis. Missing providers
become unavailable, not a zero outcome. A tested hypothesis produces an observation record;
its causal proposition remains unconfirmed unless the design supports it. Do not relabel a failed
test as confirmation simply because it ran. Preserve the original question and decision rule.
