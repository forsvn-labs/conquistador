# Sequential fallback

Use when the host cannot run research, initiative generation, unconventional scan, ranking, ICE,
cut-line, and critic as separate agents.

Keep the same method. Change only the machinery.

1. Anchor the decision: desired outcome, diagnosed cause (or explicit ideation ranking anchor), time
   horizon, capacity, hard constraints, current commitments, and decision owner. Method context:
   [`../references/force-rank-method.md`](../references/force-rank-method.md) and
   [`../references/hypothesis-framework.md`](../references/hypothesis-framework.md).
2. Validate or summarize the root-cause / ranking anchor with
   [`../agents/research-agent.md`](../agents/research-agent.md). If the cause is churn, load
   [`../references/churn-playbook.md`](../references/churn-playbook.md) (plus cancel-flow and health-score
   guides as needed).
3. Generate 5–10 standard initiatives with
   [`../agents/initiative-generator-agent.md`](../agents/initiative-generator-agent.md) using
   [`../references/initiative-types.md`](../references/initiative-types.md) and
   [`../references/initiative-planning.md`](../references/initiative-planning.md). Every hypothesis must
   name the root cause; pass the anti-generic test.
4. Unless the operator asked for a quick design, run
   [`../agents/unconventional-agent.md`](../agents/unconventional-agent.md) for 2–4 asymmetric bets.
5. Force-rank 1..N with [`../agents/ranking-agent.md`](../agents/ranking-agent.md) **before** scoring.
   Follow [`../references/idea-ranking-core.md`](../references/idea-ranking-core.md).
6. Score with [`../agents/ice-scoring-agent.md`](../agents/ice-scoring-agent.md) and
   [`../references/ice-scoring-rubric.md`](../references/ice-scoring-rubric.md). Rank sets the ceiling;
   no more than two initiatives may share a total.
7. Draw the cut line with [`../agents/cut-line-agent.md`](../agents/cut-line-agent.md): proceed / park /
   stop, ≤3 above the line when capacity is ordinary, with owner, signal, kill criterion, and revisit
   trigger. Format: [`../references/format-conventions.md`](../references/format-conventions.md).
8. Gate with [`../agents/critic-agent.md`](../agents/critic-agent.md) and
   [`../references/anti-patterns.md`](../references/anti-patterns.md). Max two rewrite cycles.

Never invent unavailable evidence. Keep spending, staffing, publishing, and external system changes
behind explicit human approval. Prefer `.forsvn/artifacts/mkt/prioritize-opportunities/` for durable
ranking artifacts.
