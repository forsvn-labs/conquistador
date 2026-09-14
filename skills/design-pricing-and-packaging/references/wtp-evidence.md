---
title: Willingness-to-Pay Evidence
lifecycle: canonical
status: stable
produced_by: design-pricing-and-packaging
load_class: METHOD
---

# Willingness-to-pay evidence

Willingness to pay (WTP) is inferred from behavior and constrained by economics. It is never invented,
and a single method never settles it.

## Evidence classes, strongest to weakest

1. **Observed transactions** — real purchases, upgrades, downgrades, churns with prices attached.
   Record cohort, date, channel, and discounts. Strongest evidence; often scarce pre-launch.
2. **Revealed preference in-product** — usage intensity, plan-limit collisions, overage acceptance,
   upgrade-button clicks that reach checkout. Real behavior with selection bias toward existing
   packaging.
3. **Purchase-commitment tests** — deposit pages, waitlists with price display, pilot contracts,
   LOIs. Commitment short of cash; label the commitment level honestly.
4. **Stated preference interviews** — direct price questions. Useful for language and objection
   mining, unreliable for numbers. Never convert an interview answer into a corridor bound on its
   own.
5. **Surveys and conjoint** — structured stated preference. Better than open questions, still
   hypothetical; report the method and sample.
6. **Competitor pricing pages** — dated screenshots of another offer's structure. Weak anchor:
   different costs, different audience, possibly different strategy. Use to bound the conversation,
   not to set the number.

## Collection rules

- Record the **date** of every data point. Pricing evidence ages fast.
- Record the **sample**: who was asked or observed, how they were selected, who is missing.
- Record **context**: discount, contract length, bundle, champion-vs-buyer role.
- Separate what buyers **say** from what they **do**. When they conflict, behavior wins and the
  conflict gets written down.
- An unavailable source (no transactions yet, no interview access) is **missing data**, never zero
  and never permission to assume.

## Sparse-evidence mode

When there are no transactions — a new product, a new segment — produce a bounded offer hypothesis
instead of a recommendation:

- state cost-to-serve floor and its confidence;
- derive a candidate corridor from the weakest acceptable evidence class available;
- pick the single cheapest test that would move a corridor bound (a priced waitlist, a two-cell
  pilot, five targeted interviews about budget authority rather than price);
- name the decision the test unlocks and the date it must run by;
- label everything above the floor as hypothesis, in writing, on the deliverable.

## Traps

- **Anchor laundering:** a number from one interview reappearing as "market research".
- **Champion bias:** the enthusiast who loves the product overestimates what their company pays for.
- **Survivor pricing:** observed prices come from customers who stayed, not those who walked.
- **Competitor swap:** treating a competitor's page as evidence about your customers.
