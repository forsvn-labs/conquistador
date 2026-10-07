---
title: Pricing and Packaging Method
lifecycle: canonical
status: stable
produced_by: pricing
load_class: METHOD
---

# Pricing and packaging method

Derive or test one value metric, package it with explicit fences, constrain it with unit economics,
and prove the result reversible before recommending any change. Every step labels its evidence
class: observed, inferred, assumed, or unknown.

## 1. Frame the decision

Record before designing anything:

- audience and the costly job the product does;
- product maturity (pre-launch, early revenue, scaling);
- economic objective (acquisition, expansion, margin, retention mix);
- constraints: contracts, brand position, sales motion, support capacity;
- current offer and who it already serves;
- switching and migration risk for existing customers;
- decision horizon and the date the answer must exist.

Missing frames are gaps to surface, not fields to guess.

Then classify the target segment by how well current options serve it, and let that set the
price direction:

- **Underserved** buyers (important needs met poorly) can support a better, dearer offer.
- **Overserved** buyers and non-consumers favor a cheaper, simpler offer.
- **Better and cheaper** wins every segment but needs a cost advantage you can name.
- **Dearer and worse** works only where buyers have no alternative; label it a lock-in risk.

Flag an offer that is only slightly better or slightly cheaper than the incumbent. It rarely
moves switchers and mostly helps whoever already holds the customer. Label the served state
`hypothesis` unless outcome-level evidence from `position` supports it.

## 2. Choose or test the value metric

A value metric is the unit the price grows on. Candidates include seats, usage units, outcomes,
workspaces, and capacity tiers. Score each candidate against five tests:

1. **Value alignment** — the metric grows only when the customer realizes more value. A metric that
   punishes healthy use (charging per collaboration seat when collaboration is the point) fails.
2. **Understandability** — a buyer can predict their bill before using the product.
3. **Predictability** — customers can forecast spend; bills that surprise churn.
4. **Measurability** — you can meter it reliably and cheaply today.
5. **Expansion neutrality** — the metric grows with retained accounts, not with friction.

Score candidates comparatively with the evidence available. Label the winner's weakest test and what
evidence would overturn it. When no metric passes measurability, say so and propose the closest
proxy plus the instrumentation needed to adopt the real metric later.

## 3. Build packages around fences

Fences are the boundaries between tiers. See [package fences](package-fences.md) for the fence
catalog and boundary-customer checks. Each tier needs a job statement: who it serves, what it
excludes, and why the exclusion is defensible to the excluded buyer.

## 4. Set the price corridor

A price corridor is the range the evidence supports, not a point estimate:

- lower bound: below cost-to-serve growth, or where the offer signals low quality;
- upper bound: where willingness-to-pay evidence or the next-best alternative runs out;
- anchors inside the corridor carry their evidence class and sample size.

Treat competitor prices as weak anchors: they describe a different cost structure and offer. Never
present a corridor wider than the evidence justifies, and name the evidence class holding each bound.

## 5. Constrain with unit economics

Apply [unit economics checks](unit-economics-checks.md): gross margin per account at the corridor's
lower bound, payback period for the sales motion, support and abuse exposure, and the discount floor.
A price that cannot clear these constraints is rejected regardless of demand evidence.

## 6. Design the reversal before the launch

Every recommendation ships with its reversal condition written first:

- the smallest reversible test that distinguishes serious options (audience, variants, primary
  signal, guardrails, window, keep/revise/stop rule);
- a higher-price cell when buyers may read price as a quality signal (B2B tools, professional
  services), not only cells at or below the planned price;
- a shallower-discount cell before you approve a deep discount, so the test shows whether the
  extra depth buys any extra conversion;
- migration, grandfathering, downgrade, billing, and communication implications;
- the observation that would prove the change wrong and the date it gets checked.

If no reversible test exists — for example a contractual price change with no cohort separation —
the recommendation must say so and stop at analysis plus a human decision gate.

## Offer mechanics

Decide each mechanic as an explicit choice with a reason, not as a default:

- **Trial existence.** Do not add a free trial to rescue an offer that has no paid demand yet.
  Show that some buyers pay without a trial first; then test a trial as an optimization.
- **Trial placement.** For consumer subscriptions, a trial on one plan steers buyers toward that
  plan. Test trial-on-one-plan against trial-on-all-plans and no trial.
- **Short billing periods.** When you test a weekly or monthly plan against annual, compare net
  revenue per buyer after churn and refunds, not conversion rate.
- **Lifetime deals.** Offer one only with a written reason. Record the open-ended service cost,
  the lost renewal revenue, and the complication for any later sale of the business.

## Deliverable shape

Return, in this order:

1. recommendation and confidence label;
2. value metric with scored alternatives;
3. package table with jobs, fences, and exclusions;
4. price corridor with bounds and evidence classes;
5. offer mechanics (trial, guarantee, annual, discounts, overage, cancellation);
6. unit-economics pass/fail per tier;
7. boundary customers and failure modes;
8. test plan with reversal condition;
9. migration plan;
10. risks, unknowns, and the human approval gate.

Nothing here authorizes changing prices, billing, checkout, entitlements, or customer
communications. Those require explicit approval for the exact change and population.
