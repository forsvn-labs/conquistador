# Sequential fallback

Use when the host cannot run tree builder, external check, hypothesis, data mapper, verdict, and
critic as separate agents.

Keep the same method. Change only the machinery.

1. Lock the problem statement to `[Metric] is [current] instead of [target]` with unit, entity,
   segment, window, baseline, and source of truth. Method:
   [`../references/diagnosis-playbook.md`](../references/diagnosis-playbook.md) and
   [`../references/diagnostic-evidence-method.md`](../references/diagnostic-evidence-method.md).
2. Build a diagnostic map with [`../agents/tree-builder-agent.md`](../agents/tree-builder-agent.md)
   with dependencies, omitted scope and a useful next observation. Use
   [`../references/logic-tree-examples.md`](../references/logic-tree-examples.md) when calibrating.
3. Run the six-factor external scan with
   [`../agents/external-check-agent.md`](../agents/external-check-agent.md). Do not skip it unless the
   operator explicitly confirms an internal-only quick path.
4. Form ranked If/Then/Because hypotheses with
   [`../agents/hypothesis-agent.md`](../agents/hypothesis-agent.md) and
   [`../references/hypothesis-framework.md`](../references/hypothesis-framework.md).
5. Map deciding data with [`../agents/data-mapper-agent.md`](../agents/data-mapper-agent.md). Pause
   for evidence. Verdicts without evidence are speculation.
6. Assign verdicts and the root-cause statement with
   [`../agents/verdict-agent.md`](../agents/verdict-agent.md). Inconclusive is valid. Co-timed changes
   without discriminating evidence stay correlational.
7. Gate with [`../agents/critic-agent.md`](../agents/critic-agent.md) and
   [`../references/anti-patterns.md`](../references/anti-patterns.md). Max two rewrite cycles.
   Format: [`../references/format-conventions.md`](../references/format-conventions.md).

Prefer `.forsvn/artifacts/mkt/diagnose-growth/` for the durable diagnosis artifact. Label this
single-context. Do not invent analytics or treat missing observations as zero. Tracking changes,
experiments, spend, and user contact stay behind explicit human approval.
