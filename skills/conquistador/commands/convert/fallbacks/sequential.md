# Sequential fallback

Use when the host cannot run conversion-diagnosis and landing-eval specialists as separate agents.

Keep the same method. Change only the machinery.

Choose the mode from the front-door COMMAND.md. Do not blend a pre-revision diagnosis with a
post-launch ledger readout into one vague scorecard.

## Conversion diagnosis lens (find the break, then revise)

Use when the outcome needs a ready-to-use revision and discriminating test, with or without a full
measurement loop.

For `prelaunch-test`, use supplied message-path evidence and labeled assumptions. External scanning,
current/target metrics, data mapping, and causal verdict are N/A until the surface has observations;
record the baseline and instrumentation needed before activation.

1. Lock audience, promise, mechanism, proof, objection, acquisition handoff, and the observed
   conversion break. Method:
   [`../references/conversion-diagnosis-method.md`](../references/conversion-diagnosis-method.md) and
   the front-door Reach→Value ladder.
2. Build the candidate evidence map with explicit coverage, dependencies and unknowns with
   [`../agents/conversion-tree-builder-agent.md`](../agents/conversion-tree-builder-agent.md);
   scan external factors with
   [`../agents/conversion-external-check-agent.md`](../agents/conversion-external-check-agent.md).
3. Form testable hypotheses with predictions, proposed mechanisms and alternatives with
   [`../agents/conversion-hypothesis-agent.md`](../agents/conversion-hypothesis-agent.md) and
   [`../references/hypothesis-framework.md`](../../diagnose/references/hypothesis-framework.md).
4. Map deciding data with
   [`../agents/conversion-data-mapper-agent.md`](../agents/conversion-data-mapper-agent.md), then
   verdict with [`../agents/conversion-verdict-agent.md`](../agents/conversion-verdict-agent.md).
5. Gate diagnosis with
   [`../agents/conversion-critic-agent.md`](../agents/conversion-critic-agent.md) and
   [`../references/conversion-diagnosis-anti-patterns.md`](../references/conversion-diagnosis-anti-patterns.md).
6. Produce Keep / Drop / Change / Test plus the ready-to-use revision from the front-door contract.

## Landing eval lens (post-launch evidence → keep / discard / watch / blocked)

Use when measurement evidence exists for a launched conversion surface.

1. Normalize metrics with
   [`../agents/landing-metric-ingest-agent.md`](../agents/landing-metric-ingest-agent.md). Missing is
   unknown, never zero.
2. Diagnose with [`../agents/landing-diagnosis-agent.md`](../agents/landing-diagnosis-agent.md).
3. Recommend the next bounded change with
   [`../agents/landing-recommendation-agent.md`](../agents/landing-recommendation-agent.md). When the
   outcome also needs the revision itself, continue into the conversion-diagnosis lens Change step
   rather than stopping at advice-only.
4. Gate with [`../agents/landing-critic-agent.md`](../agents/landing-critic-agent.md),
   [`../references/landing-eval-rubric.md`](../references/landing-eval-rubric.md), and
   [`../references/anti-sycophancy.md`](../references/anti-sycophancy.md). Append one Markdown ledger
   row; do not run TypeScript helpers.

When the host has a durable artifact store, prefer `.forsvn/artifacts/mkt/improve-conversion/` for artifacts; otherwise return findings and revisions inline. Label this single-context.
Deployments, experiment activation, spend, publishing, and external writes stay behind explicit human
approval.
