# Growth diagnosis walkthrough

This is an invented calculation and review example. No analytics query, source inspection or live experiment occurred. Values demonstrate reasoning; they are not product results or benchmarks.

## Problem definition

Suppose an operator reports that successful setups fell from 40 to 30 while eligible attempts remained at 200 in each period. The requested decision is whether an interface repair is justified. The analyst must first establish the same eligibility rules, completion definition and reporting window.

The difference is ten completions, or five percentage points of completion rate. It is not a five percent relative decline. The report keeps units visible and treats any target as a separate aspiration.

## Diagnostic map

| Area | Candidate question | Evidence needed |
|---|---|---|
| Measurement | Did collection or eligibility change? | Versioned definitions and matched independent completion records |
| Population mix | Did the weights of differently completing segments change? | Segment counts and completions under the same classification |
| Within-segment behavior | Did exposed users complete less often? | Comparable exposed and unexposed populations, with confounders |
| External context | Did a relevant outage or seasonal change affect this population? | Actual event evidence, affected scope and mechanism |

These rows are not independent causes. Measurement can affect every other row; an external event can affect both mix and behavior. The coverage section records these dependencies and the untested alternatives.

## A calculation that narrows the question

In the invented records, Segment A changes from 30 completions in 100 attempts to 15 in 50. Segment B changes from 10 in 100 to 15 in 150. Both segment rates remain unchanged.

```text
Baseline = (100/200 × 0.30) + (100/200 × 0.10) = 0.20
Later    = ( 50/200 × 0.30) + (150/200 × 0.10) = 0.15
Difference = −0.05, or −5 percentage points
```

The changed mix accounts for the aggregate difference in this illustration. The reason the mix changed is still unknown. This evidence alone does not show that the interface caused the decline or that no individual experienced a defect.

## Candidate and deciding data

**If** a routing change increased the share of Segment B, **then** the eligibility and exposure records should show that change under a consistent segment definition, **because** the route changes who reaches the setup flow.

- **Alternative:** A classification change relabeled records while underlying routing stayed stable.
- **Deciding data:** Versioned routing and segment definitions joined to eligible records across both periods.
- **Source:** The actual inspected record location, unavailable in this hypothetical example.
- **Owner:** The access owner supplied by the operator, currently unknown.
- **Confirming:** Consistent definitions and changed routing exposure account for the population difference while relevant alternatives are excluded.
- **Rejecting:** Routing exposure is stable and reclassification accounts for the observed segment change.
- **Inconclusive:** Historical definitions or reliable joins are unavailable, or both changes occurred without a discriminating comparison.
- **Potential gap explained:** The mix arithmetic accounts for the measured decline; its causal attribution remains unknown.

## Verdict and handoff

| # | Hypothesis | Verdict | Evidence | Gap |
|---|---|---|---|---|
| 1 | Routing changed the mix | Inconclusive | No routing or definition records supplied in this example | Unknown causal share |

**Root Cause Statement:** The aggregate difference is accounted for by the illustrated segment mix. The cause of that mix change cannot be determined with the available evidence.

**Unexplained:** Causal attribution, collection validity and external effects remain unresolved. A reconciled calculation is not complete causal knowledge.

The proposed next check compares versioned routing and classification records for the same population and periods. Its signal is whether routing exposure changes under a stable definition. Stop if missing historical records prevent that comparison; return the gap and a revised data request rather than asserting a cause.

## Critic review

The critic rejects a claim that the interface release caused the decline merely because it occurred in the same period. It also rejects splitting the ten lost completions among invented causes to fill a verdict table.

The critic accepts the arithmetic when reproducible and correctly scoped. The report remains Inconclusive on routing and preserves its next observation. No review pass or live result is claimed for this hypothetical example.

`prioritize` may use supported findings with their limits. This diagnosis does not authorize an interface change, tracking change, experiment, spend or user contact.
