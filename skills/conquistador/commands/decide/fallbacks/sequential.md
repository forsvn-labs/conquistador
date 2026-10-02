# Sequential fallback

Use when the host cannot run panelists and resolver as separate contexts.

Keep the same method. Change only the machinery. Label the result **single-context fallback**, not
independent agents.

1. Write the decision contract first: exact decision, options, non-negotiable constraints, evidence,
   unknowns, deadline, decision owner, resolver criteria, and what would reverse the choice. Skip the
   panel for ordinary drafting or format choices — decide directly.
2. Choose mode with [`../references/decision-tree.md`](../references/decision-tree.md):
   - trade-off / whether-to-act → debate rounds
     ([`../references/debate-rounds.md`](../references/debate-rounds.md));
   - ranking, consensus filter, or binary → poll protocol
     ([`../references/poll-protocol.md`](../references/poll-protocol.md)).
3. Load [`../references/anti-sycophancy.md`](../references/anti-sycophancy.md). Produce sequential
   counter-positions from different first principles. Default strategy trio when roles are unspecified:
   [optimist](../agents/optimist-agent.md), [skeptic](../agents/skeptic-agent.md),
   [synthesizer](../agents/synthesizer-agent.md). For how-to-build decisions, prefer constraint
   assignment or the engineering trio
   ([architect](../agents/architect-agent.md), [pragmatist](../agents/pragmatist-agent.md),
   [critic](../agents/critic-agent.md)).
4. Expose each position to the strongest opposing case. Allow revise / hold / concede with reasons.
   Preserve material dissent. Do not average incompatible recommendations. Ranking-shaped polls follow
   [`../references/idea-ranking-core.md`](../references/idea-ranking-core.md).
5. Resolve once with [`../agents/resolver-agent.md`](../agents/resolver-agent.md) against the criteria
   fixed at the start. Vote count never replaces criteria. Report via
   [`../references/report-template.md`](../references/report-template.md); avoid
   [`../references/anti-patterns.md`](../references/anti-patterns.md). Method context:
   [`../references/independent-positions-method.md`](../references/independent-positions-method.md).

Never publish, spend, delete, release, or grant approval. Prefer
`.forsvn/artifacts/mkt/decision-panel/` for durable panel artifacts.
