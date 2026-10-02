# Sequential funnel modeling

Use this fallback when the host cannot run the declared roles independently. Label the work single-context review.

1. Define the outcome, units, events, and period using [model selection](../agents/model-selection-agent.md).
2. Collect observed values with [baseline collection](../agents/baseline-collector-agent.md). Preserve missing values and record proposed scenario assumptions separately.
3. Build targets and alternatives with [target setting](../agents/target-setter-agent.md). Show formulas, required volumes, and justification.
4. Check arithmetic and assumptions with [consistency review](../agents/sanity-check-agent.md).
5. Calculate downside/base/upside cases with [stress testing](../agents/stress-test-agent.md). Check capacity and decision-sensitive unknowns.
6. Apply the [critic](../agents/critic-agent.md). Repair the named defect and recheck dependent calculations. Stop repeated revisions with an explicit unresolved condition.
7. Deliver the decision model using [format conventions](../references/format-conventions.md), including the recommendation, next evidence, owner, and approval boundary.

Do not claim independent corroboration, live results, or authority to spend. Use the same evidence and uncertainty rules as the multi-agent path.
