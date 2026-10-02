# Diagnostic map examples

The examples below are invented to demonstrate calculations and decisions. They contain no account results, external benchmark or tested intervention.

## Separate mix from within-segment movement

Suppose two eligible populations have stable completion rates. Segment A completes 30 of 100 attempts in the baseline and 15 of 50 later. Segment B completes 10 of 100 and 15 of 150. Both segment rates remain unchanged, but the blended rate falls from 40/200 to 30/200.

| Quantity | Baseline | Later | Interpretation |
|---|---|---|---|
| Segment A rate | 30% | 30% | No measured within-segment change |
| Segment B rate | 10% | 10% | No measured within-segment change |
| Segment A weight | 50% | 25% | Mix changed |
| Blended rate | 20% | 15% | Five percentage-point decline accounted for by mix |

The arithmetic does not explain why the mix changed. Candidate explanations include a routing change, a different acquisition population or a classification change. Deciding data must distinguish them, such as consistent segment definitions and exposure records. A co-timed interface release alone does not identify the cause.

## Reconcile an identity without causal independence

For a fixed reporting window, revenue equals completed orders multiplied by average recognized revenue per order when both inputs use the same records. An increase in order count can coincide with a reduction in average value. Use the interaction formula in the [diagnostic method](diagnostic-evidence-method.md) rather than assigning the full change to both factors.

Potential shared causes include a changed product mix or promotion. Record these links in the map. The equation identifies where to inspect; it cannot establish which cause produced the movement.

## Compare measurement and behavior explanations

A reported activation decline coincides with a release. The diagnostic map includes event collection, eligibility rules and the actual completion behavior. These may overlap.

| Candidate | Prediction that distinguishes it | Deciding data | Inconclusive condition |
|---|---|---|---|
| Collector misses a completion event | Independent completion records remain stable for the affected exposure while collected events decline | Matched records by exposure and period | No independent records or unreliable join |
| Completion behavior deteriorates | Both independent completions and collected events decline in the affected comparable population | Completion records, eligibility and release exposure | Changed population or simultaneous interventions |
| Eligibility definition changes | Recalculation under the prior definition accounts for a denominator difference | Versioned query and raw eligible records | Historical definition unavailable |

The external scan remains separate evidence. A platform outage or seasonal event is relevant only if the affected population and mechanism fit. An unknown external status is not a negative finding.

## Handoff

For the selected candidate, write If / Then / Because and the confirming, rejecting and unresolved outcomes. Retain source, owner, calculation and potential gap as an estimate or unknown. Give a bounded verdict and one useful next observation. Never manufacture an explained percentage to make the map look complete.
