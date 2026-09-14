---
name: allocate-marketing-budget
description: "Allocate a bounded marketing budget across channels, experiments, and reserves using owned evidence or an explicit learning-budget mode. Use for spend scenarios, channel floors, marginal-return choices, concentration limits, and reallocation rules."
metadata:
  version: 2.1.0

---

# Allocate a marketing budget

Allocate money only where it can produce an outcome or decision-grade learning.

## Choose the evidence mode

Use evidence-backed mode only when owned results are comparable by audience, offer, channel, format,
window, attribution boundary, and downstream quality. Otherwise use learning-budget mode. Never turn a
benchmark or an assumption into a fabricated account CAC, conversion rate, or return.

Define the total budget, horizon, objective, contribution economics, cash and payback constraints,
operator capacity, channel candidates, minimum viable spend, and prohibited uses. Label every input as
observed, inferred, assumed, or unknown, with source and date.

## Build the allocation

In evidence-backed mode, compare marginal rather than average return. Account for diminishing returns,
channel floors, saturation, sales and delivery capacity, concentration risk, and the cost of delay.

In learning-budget mode, fund the minimum amount and duration that can answer a specific question.
Assign zero when a test cannot reach a useful observation threshold or when destination, message,
tracking, safety, or operational readiness fails.

Hold an explicit reserve. Model downside, base, and upside ranges without hiding uncertainty behind
precise totals. Give each allocation reallocation triggers, a destination for released funds, and a
stop condition. Check that allocated amounts plus reserve equal the budget.

## Deliver

Return:

1. mode choice, objective, constraints, and evidence boundary;
2. allocation table with base amount, range, purpose, evidence, floor, owner, and timing;
3. unit-economics and capacity checks;
4. downside, base, and upside scenarios;
5. reserve, concentration limits, reallocation triggers, and stop rules;
6. unresolved inputs that could change the allocation.

This is advisory. Do not purchase media, move money, change bids, or modify live accounts without
explicit approval.

Before delivery, load the relevant allocation and review contracts:

- [allocator](agents/allocator.md) for the sourcing ledger and marginal-return split;
- [constraint checker](agents/constraint-checker.md) for floors, §0 vetoes, concentration, and the
  no-spend gate;
- [critic](agents/critic.md) against the [rubric](references/rubric.md);
- [marginal-return model](references/marginal-return-model.md) and
  [next-dollar method](references/next-dollar-earns-most.md);
- [format conventions](references/format-conventions.md) and
  [anti-patterns](references/anti-patterns.md) before ship;
- [walkthrough](references/examples/allocate-marketing-budget-walkthrough.md) when calibrating a
  multi-channel split.

If the host cannot run those as separate agents, use [sequential fallback](fallbacks/sequential.md).
When the optional local store exists, prefer `.forsvn/artifacts/mkt/allocate-marketing-budget/` for
the allocation artifact; without it, return the artifact inline (same schema). Never invent
a CAC or LTV. Channel selection belongs to `plan-campaign`; scoring results belongs to
`measure-growth`.
