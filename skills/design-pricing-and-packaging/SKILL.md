---
name: design-pricing-and-packaging
description: "Design evidence-bounded pricing, packaging, value metrics, tier boundaries, and migration tests. Use when deciding what to charge, what belongs in each package, how customers upgrade, or how to test a price change safely."
metadata:
  version: 1.0.0

---

# Design pricing and packaging

Create a coherent, testable offer—not a confident number unsupported by buying evidence.

## Establish the pricing decision

Define the audience, costly job, product maturity, economic objective, constraints, current offer,
switching risk, and decision horizon. Collect observed buying behavior, customer language, willingness-
to-pay evidence, dated primary competitor pricing, product usage, cost-to-serve, margin, support, and
sales constraints when available.

Label observations, inferences, assumptions, and unknowns. Do not invent a willingness-to-pay anchor or
treat competitor price as customer value. Evidence discipline is defined in
[WTP evidence](references/wtp-evidence.md): every number carries an evidence class, a date, and a
sample; unavailable sources are missing data, never zero.

## Design the system

Work through the [pricing method](references/pricing-method.md). Choose a value metric that grows with
realized customer value, stays understandable, and does not punish healthy use; score alternatives and
name the winner's weakest test. Define:

- package jobs, tier boundaries, and exclusions with defensible
  [fences](references/package-fences.md);
- upgrade logic and expansion path;
- price corridor with evidence class on each bound;
- trial, guarantee, annual, discount, overage, and cancellation mechanics;
- gross-margin, payback, support, and abuse constraints from the
  [unit economics checks](references/unit-economics-checks.md) — a price that fails economics is
  rejected regardless of demand evidence;
- message and proof needed to make the offer credible.

Check boundary customers and failure modes: light users, heavy users, teams, seasonal use, low-margin
segments, procurement, and customers near a tier threshold. Each case gets a predicted behavior and a
guardrail or a test-plan item.

## Plan a reversible decision

Design the smallest test that distinguishes serious options. Specify audience, offer variants, primary
signal, guardrails, observation window, sample limitation, and keep, revise, or stop rule. Write the
reversal condition before finalizing the recommendation. Include migration, grandfathering, downgrade,
billing, support, and communication implications before recommending a live change. If no reversible
test exists, say so and stop at analysis plus a human decision gate.

## Verify before delivery

Score the deliverable against the [pricing rubric](references/pricing-rubric.md). Unsupported
corridors, uneconomic prices, and irreversible first moves are blocking failures. When separate
research, economics, and red-team contexts are available, run them as such; otherwise use
[sequential fallback](fallbacks/sequential.md), which orders the method into framing, metric scoring,
fence review, unit economics, a red-team pass, and rubric scoring under one context, labeled as
single-context analysis.

A worked (fictional) walkthrough showing the full deliverable shape:
[seasonal teams packaging example](references/examples/seasonal-teams-walkthrough.md).

## Deliver

Return the recommendation, evidence boundary, value metric, package table, price corridor, offer
mechanics, economics, boundary cases, test plan, migration plan, risks, and final human approval gate.

Do not change prices, billing, checkout, entitlements, or customer communications without explicit
approval for the exact change and population.
