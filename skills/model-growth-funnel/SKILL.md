---
name: model-growth-funnel
description: "Build a decision-grade growth or revenue funnel backward from a business target. Use for numeric funnel plans, baseline assumptions, conversion targets, capacity checks, unit economics, sensitivity analysis, or deciding whether a growth goal is feasible."
metadata:
  version: 2.1.0

---

# Model a growth funnel

Turn a business target into explicit math, assumptions, constraints, and the next evidence needed.
This is a decision model, not a forecast.

## Define the outcome and units

Name the target, time window, currency, customer/account definition, and whether the target means
bookings, recurring revenue, recognized revenue, activation, or another outcome. Do not mix people,
accounts, opportunities, orders, and revenue in one rate.

Work backward from the outcome through the smallest useful funnel. For each transition, show:

- numerator and denominator;
- current observed value and source, when available;
- planning assumption when evidence is absent;
- owner and date for replacing the assumption;
- operational action required at that volume.

Keep arithmetic inspectable. Show formulas and rounded operational totals.

## Test feasibility

Run at least downside, base, and upside cases across the assumptions most likely to change the
decision. Do not vary everything at once.

Treat each scenario as a feasibility range, not a promise. Never solve backward from the target by
silently raising an unobserved conversion rate; expose the assumption and test it against capacity.

Check:

- audience/market capacity;
- acquisition and sales throughput;
- onboarding, delivery, and support capacity;
- average contract or order value;
- gross margin and marginal service cost;
- retention/churn where the time horizon requires it;
- acquisition cost, payback, and LTV:CAC only when their inputs exist.

If the model requires impossible throughput, unjustified conversion, or negative economics, say so
and identify the binding constraint. Do not reverse-engineer optimistic rates merely to hit the goal.

## Deliver

Return:

1. decision and target definition;
2. assumptions table with source/owner;
3. base model and formulas;
4. downside/base/upside sensitivity;
5. capacity and unit-economics constraints;
6. the assumptions with highest decision sensitivity;
7. smallest evidence plan for replacing them;
8. feasible range, revised target, or explicit no-go recommendation.

Separate model outputs from observed results. Keep spending and external system changes behind
explicit approval.

Before delivery, load the relevant calculation and review contracts:

- [model selection](agents/model-selection-agent.md) and
  [baseline collector](agents/baseline-collector-agent.md);
- [target setter](agents/target-setter-agent.md), [sanity check](agents/sanity-check-agent.md),
  then [stress test](agents/stress-test-agent.md);
- [critic](agents/critic-agent.md) on the four-point gate;
- [funnel model method](references/funnel-model-method.md),
  [funnel models](references/funnel-models.md),
  [benchmarks](references/benchmarks.md),
  [unit economics](references/unit-economics.md),
  [stress tests](references/stress-tests.md), and
  [format conventions](references/format-conventions.md).

If the host cannot run those as separate agents, use [sequential fallback](fallbacks/sequential.md).
Run [anti-patterns](references/anti-patterns.md) before ship. Worked example:
[funnel planner walkthrough](references/examples/funnel-planner-walkthrough.md).

Prefer `.forsvn/artifacts/mkt/model-growth-funnel/` for durable funnel-model artifacts.
