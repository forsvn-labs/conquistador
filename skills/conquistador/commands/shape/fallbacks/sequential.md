# Sequential fallback

Use when the host cannot run the idea-critic as a separate agent, or cannot load method steps as
separate contexts.

Keep the same method. Change only the machinery. Label this **single-context shaping**, not
independent corroboration.

1. Frame the real decision from `COMMAND.md`: requested solution, underlying decision, premise, evidence
   vs inference vs assumption. Ask at most one bundled question when the answer would change the
   decision.
2. Gather silent context with
   [`../references/context-gathering.md`](../references/context-gathering.md). Select the decision checks that address unresolved evidence or constraints.
3. Run the method spine from
   [`../references/orchestration-steps.md`](../references/orchestration-steps.md):
   premise check → mode detection (idea-stage vs plan-review) → optional divergence pass → idea-critic
   gate → coverage zones → conversation → concreteness gate → output.
4. On idea-stage work, apply the idea-critic rubric from
   [`../agents/idea-critic-agent.md`](../agents/idea-critic-agent.md) as a sequential evidence and commitment review. Do not pretend this is an independent subagent.
5. When Deep depth + open solution space, run
   [`../references/divergence-pass.md`](../references/divergence-pass.md) before converging. Ranking
   invariants:
   [`../references/idea-ranking-core.md`](../references/idea-ranking-core.md).
6. Interview with
   [`../references/interview-techniques.md`](../references/interview-techniques.md) and
   [`../references/communication-discipline.md`](../references/communication-discipline.md). Probe via
   [`../references/question-bank.md`](../references/question-bank.md). For expensive reversible forks,
   hand off to `decide` rather than fake multi-perspective debate in-process.
7. Plan-review mode: lock verdict vocabulary with
   [`../references/plan-review-modes.md`](../references/plan-review-modes.md).
8. Deliver the decision contract per `COMMAND.md` and
   [`../references/output-formats.md`](../references/output-formats.md). Check
   [`../references/anti-patterns.md`](../references/anti-patterns.md) before ship. Method context:
   [`../references/initiative-shaping-method.md`](../references/initiative-shaping-method.md).

Never invent unavailable evidence. Prefer
`.forsvn/artifacts/product/shape-initiative/` for durable decision artifacts. Sending, publishing,
spending, and live-system changes stay behind explicit human approval.
