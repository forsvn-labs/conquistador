# Diagnostic evidence method

An original Conquistador procedure for deciding what a metric change permits you to conclude and which observation would most reduce uncertainty. The output is a bounded diagnosis and a proposed next check. It does not authorize a tracking change, experiment, spend or user contact.

## Establish the comparison

Write the metric definition before decomposing it. Record the counted entity, numerator, denominator, unit, inclusion rules, segment, time window and data source. Distinguish a target gap from a change against a comparable observed baseline. A missed aspiration does not by itself prove a regression.

Check whether both periods use the same event definitions, attribution rules, collection coverage, currency and reporting maturity. Record missing records and delayed outcomes. Reconcile a sample against another available record where useful. Measurement error can explain part of a gap, coexist with real change or remain unknown.

Before you collect any data, write the plan: the question, the current hypothesis and its reason, and the analysis and data that would confirm or reject it.

When no event data exists, for example in an offline or uninstrumented business, create the observation instead of guessing. Survey the target population with sequential yes/no questions (aware? tried? returned?) so each person falls into exactly one stage. Then interview a few people from each leaking stage to learn the reasons. Label the result as survey evidence with its sample and date.

Use an evidence ledger with a location for every observed value. Label each entry `observed`, `derived`, `assumed` or `unknown`. Keep formula inputs linked to their entries so another reader can reproduce the calculation. Never fill missing observations with zero.

## Separate accounting from explanation

An equation can locate a contribution without identifying its cause. For a consistent population and window, revenue may be expressed as eligible visits multiplied by orders per eligible visit and revenue per order. This identity does not imply that traffic, conversion and order value are causally independent.

For two factors, retain the interaction when both change:

```text
Y = A × B
ΔY = (A1 − A0) × B0 + A0 × (B1 − B0) + (A1 − A0) × (B1 − B0)
```

Illustrative arithmetic only: A changes from 80 to 100 and B from 4 to 3. Y changes from 320 to 300. The terms are +80, −80 and −20, totaling −20. Assigning the full interaction to both factors would double-count it. No business cause is established by this calculation.

State the chosen decomposition order or interaction allocation for larger products. For sums, document whether categories partition the same records. For averages or rates, retain denominators and segment weights. Do not add overlapping segment results. Reconcile only compatible quantities; do not force causal shares to total a percentage when attribution is unknown.

## Build the diagnostic map

Start with the consequential difference in the ledger. Add candidate explanations only when you can state a mechanism and an observation that would distinguish it from an alternative. Group candidates for readability and record their dependencies. A shared cause may affect several measured factors, and several causes may affect the same records.

Use a table, calculation or diagram according to what makes the dependencies inspectable. A diagram needs no fixed branch count or depth. Stop expanding when a branch identifies a useful next observation. Keep an explicit list of omitted scope and untested alternatives; do not declare the map exhaustive.

Check external context alongside internal changes. Relevant categories include competitor activity, seasonality, platform changes, policy changes, technology and wider economic conditions. Record the event source, affected population and proposed mechanism. An event happening in the same period is a candidate, not confirmation. Unknown external evidence remains unknown.

## Give alternatives different predictions

For each serious candidate, preserve the handoff fields `If`, `Then`, `Because`, `Deciding data`, `Source`, `Owner`, `Confirming`, `Rejecting` and `Potential gap explained`.

The prediction must distinguish the candidate from the strongest available alternative. Specify the population, period, metric and expected contrast. Include conditions under which the check would be inconclusive, such as incomplete exposure records or simultaneous changes.

Inspect mix before assigning a within-segment explanation. If segment rates are stable but their weights change, the blended rate may move without a deterioration inside any measured segment. That identifies an accounting contribution; the reason the mix changed still needs evidence.

Apply the same check across sign-up cohorts. When total users or revenue grow while the owner reports weak results, compare retention by cohort; strong new volume can hide falling retention in recent cohorts, often from one campaign or channel. When a candidate fix is more acquisition, first check whether active users treat the product as essential, for example with the must-have survey in `position/references/customer-interviews.md` or a retention curve that flattens. Without that check, mark acquisition fixes `Inconclusive`.

Rank next checks by their ability to change the decision, evidence access, cost and potential consequence. A fast query that all candidates predict equally is less useful than a slower discriminating observation. Do not turn ordinal priorities into probabilities.

## Assign a bounded verdict

- `Confirmed` means the cited evidence supports the specified mechanism and distinguishes it from relevant alternatives within the stated scope. State residual limitations.
- `Rejected` means the evidence contradicts the stated prediction under its assumptions. It does not disprove every possible version of that cause.
- `Inconclusive` means the evidence cannot distinguish the alternatives or a necessary check is missing. Name the next data, source and owner.

Retain observed deltas, calculated contributions, interactions and unexplained residuals separately. `Potential gap explained` is a scenario estimate before confirmation, not a probability or an observed causal share. Use `unknown` when it cannot be estimated responsibly. Report a root cause as undetermined when the evidence does not support one.

## Stop and hand off

Stop when the available evidence supports a bounded decision or when the next useful observation is unavailable. Explain what new information would change the verdict. Do not impose a timer, required number of rejected hypotheses or minimum share of explained gap to manufacture closure.

Deliver the comparison ledger, diagnostic map, alternatives, deciding-data requests, external-factor status, verdicts and reconciliation. Propose one next check with its signal, comparison, owner, review point and stop condition. Continue only within existing authorization; the diagnosis itself grants no execution authority.
