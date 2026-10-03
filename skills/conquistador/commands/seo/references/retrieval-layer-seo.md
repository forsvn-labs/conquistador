---
method_updated: 2026-09-15
last_verified: null
verifier: none
status: draft
---

# Retrieval and content audit

Load with `ai-seo.md` and `evidence-classes.md` for Routes B/E. Inspect whether a page provides a
supported answer that can be understood outside surrounding promotional text. This is a local
content test; it does not describe a vendor's hidden retrieval unit or scoring system.

## Work from the reader's question

Record the exact question, audience, page and intended decision. Locate the passage that answers
it. If none exists, identify the missing information and its owner before proposing copy. A
competitor citation can identify a candidate question; it cannot prove what caused that citation.

## Run the applicable checks

| Check | Inspect | Repair and verification |
|---|---|---|
| Answer coverage | Does the passage answer the stated question with needed conditions? | Supply the missing answer or narrow the promise; reread against the question |
| Context preservation | Are subject, units, timeframe, qualifiers and referenced objects understandable? | Carry necessary context into the passage; test it with surrounding prose hidden |
| Evidence support | Does each factual claim have an appropriate source, scope and date? | Correct or remove unsupported claims; preserve uncertainty, rights and attribution |
| Decision structure | Can the reader compare options or perform the steps? | Use comparable table cells or ordered actions where useful; avoid forced formats |
| Content consistency | Do headings, visible text, structured data and linked versions agree? | Resolve contradiction at its source; record actual substantive updates |
| Access and delivery | What do supplied responses, directives, rendered content and logs establish? | Route relevant access defects to technical review; keep untested pathways unknown |

These checks are selected by the task, not a fixed scorecard or word-count gate. Long explanations
can be necessary. Do not split a qualification from its claim to meet a length target. A source
supports a claim through its content and scope, not its popularity or presumed retrieval weight.
Structured data must describe visible supported facts; validation does not guarantee citation.

## Audit output schema

Keep the standard Issue / Impact / Evidence / Fix / Priority fields and these extension fields:

| Field | Required content |
|---|---|
| Query | Exact question and relevant audience/locale |
| Target page | Exact owned or third-party URL; record control/ownership |
| Extraction unit | Passage, heading, list item, table cell or other precise location being reviewed |
| Source/corroboration gap | Missing supporting fact or source, or none with explanation |
| Measurement query | Exact future observation query plus settings or unresolved settings |
| Expected citation behavior | Testable proposed observation, explicitly unconfirmed; not a forecast |
| Evidence class | Supported label per evidence-classes.md for each material claim |

Also name the rewrite location, supplied before-text, proposed correction, owner, dependencies,
comparison/window and stop rule. A missing essential field returns to the originating agent;
unknown is a valid value when its limitation and resolution step are explicit.

## Read supplied monitoring handoffs

Consume `handoff-optimize-search.md`, the query/persona set, captured provider/query matrix,
`cited_domains`, source artifacts and unavailable-cell ledger when supplied. Verify scope and
provenance before inheriting tags. A cited-domain inventory records displayed sources, not
corroboration quality or a platform preference. Keep contradictory responses and absent cells.

The structure agent owns answer/content findings; presence owns supplied access and observed
source/display findings. They share exact page/location identifiers. Do not repeat the monitor
as a strategy finding without identifying an actionable defect or bounded question.

## Priority and action boundary

Prioritize demonstrated user-facing defects and relevant technical dependencies by impact and
repair cost. A public document supports only what it states; an observed answer supports only
that observation. Neither automatically proves a causal uplift. Hypothesis-only provider-effect
claims cannot justify P1/Critical/High. They need a bounded measurement plan.

An intentional crawler restriction is an owner policy choice. Missing live access does not prevent
an offline content proposal; it prevents claims of tested delivery. Technical checks #5/#8/#9
in technical-crawler-checklist.md require interpretation for the relevant URL and purpose, not an
automatic inference that every AI pathway is impossible.

## Review failures

Reject unsupported impact percentages, source prestige as proof, a mandatory answer-word band,
mandatory discovery files, private-prompt stories, stale dates presented as fresh review and
citation changes treated as causal evidence. If a supplied vendor report lists terms, add only
facts the reader's question needs. No content padding to satisfy a vendor score or count gate.

A synthetic repair example: a retry instruction says "repeat it" without naming the operation.
Rewrite it as "Retry the rejected rows after correcting the missing account ID" only when the
supplied product specification supports that action. The local check is referent clarity and
claim support. Whether an answer service cites it is a separate unrun test.
