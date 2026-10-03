# Shape a decision into an actionable scope

Start with the change the user wants and the decision that remains open. Read [context gathering](context-gathering.md) before asking for information already present in the workspace.

## Choose the necessary depth

If the request already fixes the outcome and constraints, confirm the resulting scope in a few sentences. If a material uncertainty remains, investigate that uncertainty. Expand the discussion only when another unresolved decision changes the recommendation. Do not impose a minimum question count.

For an idea, examine evidence of need and feasible alternatives. For an existing plan, compare the plan with its stated outcome and constraints. Use [plan review modes](plan-review-modes.md) to record the scope decision when applicable. A prior plan remains evidence of intent, not proof that its assumptions hold.

## Develop the recommendation

Separate observations, user reports, estimates, and assumptions. Compare plausible actions, including continuing the current approach when feasible. Explain which constraint or evidence favors the recommendation and what would change it.

Use [decision checks](decision-checks/) for the unresolved business question. Use [divergence](divergence-pass.md) when materially different solutions remain open. Do not generate alternatives solely to fill a template.

Ask at most one bundled material question at a time. State a reasonable recommendation with the uncertainty that limits it. Respect decisions the user has already made unless new evidence creates a conflict.

## Review and deliver

Use the [idea critic](../agents/idea-critic-agent.md) for an unresolved idea when its contract applies. If the host has no independent agent mechanism, perform a labeled sequential review. Never describe that review as independent corroboration.

The output must identify the objective, premise, alternatives, evidence, scope, owner, success measure, next reversible step, and stop or review condition. Follow [output formats](output-formats.md) for the requested artifact. Unknown evidence can remain unknown if the next step is designed to resolve it.

Finish when the user has an actionable decision with explicit limits. Save an artifact when requested or needed for handoff; do not turn a short scoping conversation into mandatory paperwork. Sending, spending, publishing, and live changes require the relevant human authority.

Use [orchestration steps](orchestration-steps.md) for detailed execution and [sequential fallback](../fallbacks/sequential.md) for hosts without subagents. Task decomposition and technical architecture begin after the scope is clear.
