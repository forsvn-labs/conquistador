---
name: diagnose-growth
description: "Diagnose a growth, funnel, revenue, retention, or campaign performance problem before prescribing tactics. Use when a metric moved, a target is missed, a funnel is weak, or competing explanations need one discriminating test."
metadata:
  version: 1.0.0

---

# Diagnose growth

Find the first consequential break and the evidence that would distinguish its cause.

## Define the observed problem

Name the metric, unit, entity, segment, time window, baseline, comparable period, and source of truth.
Record instrumentation changes and missing data before treating movement as real. Separate observation,
inference, and assumption; unavailable analytics are unknown, never zero.

Decompose the smallest useful system across funnel transitions and mix. Check volume, conversion,
quality, price, retention, channel, audience, product, sales, delivery, seasonality, releases, outages,
and external change when relevant. Locate the first break rather than optimizing a downstream symptom.

## Test competing causes

Build an evidence map and a mutually understandable logic tree. Record each serious hypothesis with premise, prediction and proposed mechanism.
If / Then / Because labels may hold these fields; an unknown mechanism remains explicit.
The prediction must differ from competing explanations. Name supporting and
contradicting evidence, confounders, deciding data, and what has already been excluded.

It is acceptable to conclude that the diagnosis is inconclusive. Do not convert correlation into
causation or produce a tactic list to hide uncertainty. Select one bounded discriminating test or
observation that creates different predictions while limiting user, brand, and economic risk.

## Deliver

Return:

1. concise diagnosis, confidence, and evidence boundary;
2. funnel or mix decomposition and first break;
3. ranked causal hypotheses with competing predictions;
4. exclusions, confounders, and missing data;
5. one discriminating test with signal, guardrails, window, owner, and stop rule;
6. explicit inconclusive verdict when the evidence cannot decide.

Propose changes and tests. Do not alter tracking, launch experiments, spend, or contact users without
explicit approval.

Before delivery, apply the diagnostic evidence method and its handoff checks:

- [tree builder](agents/tree-builder-agent.md) and [external check](agents/external-check-agent.md)
  in parallel for the diagnostic map and six-factor scan;
- [hypothesis](agents/hypothesis-agent.md), [data mapper](agents/data-mapper-agent.md), then
  [verdict](agents/verdict-agent.md) after the evidence pause;
- [critic](agents/critic-agent.md) against the 10-point gate;
- [diagnosis playbook](references/diagnosis-playbook.md),
  [diagnostic evidence method](references/diagnostic-evidence-method.md),
  [hypothesis framework](references/hypothesis-framework.md),
  [logic-tree examples](references/logic-tree-examples.md), and
  [format conventions](references/format-conventions.md).

If the host cannot run those as separate agents, use [sequential fallback](fallbacks/sequential.md).
Run [anti-patterns](references/anti-patterns.md) before ship. Worked example:
[diagnose walkthrough](references/examples/diagnose-walkthrough.md).

Prefer `.forsvn/artifacts/mkt/diagnose-growth/` for durable diagnosis artifacts.
