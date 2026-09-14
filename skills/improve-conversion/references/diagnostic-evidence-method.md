---
method_updated: 2026-09-15
last_verified: null
verifier: none
status: draft
---

# Diagnostic evidence method

Start with the decision the conversion owner needs to make and the evidence that could change
it. Build a record of observations, candidate explanations and missing discriminating data.
Do not require a named decomposition model, a tree shape, an exhaustive cause list or exclusive causes.

## Establish the observed gap

Record metric definition, numerator, denominator, units, eligible population, source, time window,
current value and comparison value. Distinguish a prior observation from an aspirational target.
Compute absolute difference and relative difference with the reference denominator named. Rates
use percentage-point differences as well as relative changes where useful. A zero reference
makes relative change undefined. Missing values stay unknown.

Before interpreting behavior, check event definitions, instrumentation, deduplication, attribution,
cohort maturity and exclusions. An analytics/database agreement is useful only when the sources
are sufficiently independent and use compatible definitions. A shared broken event can affect both.

## Separate arithmetic from explanation

Use identities when the data definitions support them, for example:

- Completed orders = eligible sessions × orders per eligible session.
- Revenue = completed orders × average recognized revenue per order.
- Blended conversion = sum of segment population shares × segment conversion rates, when those
  segments partition the same eligible population.

These are accounting identities, not independent causal factors. Traffic quality can alter both
population mix and conversion. Pricing can alter order rate and value. State dependencies rather
than pretending they do not exist. A display may be a table, graph, calculation or outline.

For outcome Y = V × r, an exact two-period difference is:
`Y1 - Y0 = (V1 - V0) × r0 + V0 × (r1 - r0) + (V1 - V0) × (r1 - r0)`.
Label the volume, rate and interaction terms. Alternative sequential allocations assign the
interaction differently; state the convention and never describe that allocation as causal proof.
For more factors, show the calculation and chosen counterfactual rather than guessing shares.

## Map candidate explanations

For each candidate record a stable id, proposed mechanism, affected population/time, observations
it predicts, evidence already held and competing explanations. Consider measurement, composition,
behavior, implementation and external conditions when relevant. Mark uncovered scope explicitly.
Do not add empty branches to reach a count or claim all causes have been considered.

Record overlaps: shared users/events, common upstream causes, mediation and interactions. A
checkout outage and a payment failure may describe the same lost order. A campaign change and
new audience mix may be successive links in one mechanism. Link those candidates and do not sum
their estimated effects. Keep a residual or unquantified explanation when attribution is incomplete.

## Choose deciding evidence

Specify the smallest evidence set that distinguishes a candidate from a plausible alternative.
It can require multiple observations, such as event records plus server receipts or a matched
segment comparison. Name source/report/field, population, window, join keys, access owner,
availability and limitations. Define supporting, contradicting and ambiguous patterns before
reading new data. No single metric is required to settle a causal claim by itself.

Order checks by whether their result changes the next decision, access cost, delay, reversibility
and potential consequence. Do not multiply unsupported likelihood/impact scores. An unmeasured
large risk can merit investigation without assigning an invented gap percentage.

## Evaluate and account

Use Confirmed, Rejected or Inconclusive for each bounded hypothesis. Confirmation requires
support for the mechanism and discrimination from credible alternatives, not timing alone.
Rejection applies only to the stated scope tested. Inconclusive names what remains ambiguous and
the next discriminating check. A candidate list with no supported cause can be a complete honest
readout; do not force a root cause after an arbitrary number of rejected hypotheses.

Report gap contribution as measured units, a supported estimate/range, or unknown. A partition of
an observed gap may reconcile to the total only with compatible units, disjoint attribution or an
explicit interaction convention. Include residual and rounding. Hypothetical overlapping shares
must never be added to make 100%. An accounting explanation is separate from a causal explanation.

## Close with a bounded handoff

State supported causes, unresolved alternatives, overlap limits and what the evidence permits.
Pass the diagnosis to the ready-to-use Change/Test revision or prioritize-opportunities only with
its limitations intact. If unresolved evidence could change a consequential decision, name the
owner and deciding data; do not silently authorize the intervention. Prelaunch work has no observed
causal verdict: return the message-path concern, proposed revision and measurement plan instead.

Use supplied context and evidence. No remote lookup, data collection, experiment, deployment or
external write is implied by the method. Preserve source licenses, provenance and exact artifacts.
