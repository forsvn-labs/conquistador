# Growth diagnosis playbook

Use this skill when a measured outcome misses a target or changes and the next action depends on why. Start from supplied evidence and ask for missing information only when it changes the diagnosis. A known cause belongs in opportunity prioritization; a code defect belongs in the product debugging workflow.

## Working sequence

1. Define the observed comparison and distinguish target, baseline and current result. Confirm the unit, population, time window and metric definition.
2. Use the [diagnostic evidence method](diagnostic-evidence-method.md) to separate arithmetic contributions from causal candidates. The [tree builder](../agents/tree-builder-agent.md) records dependencies, omitted scope and measurement uncertainty.
3. Review the six external-factor categories with the external-check agent. Preserve sources, exposure and unknowns; chronology alone establishes no cause.
4. Form If / Then / Because candidates with distinct predictions. Map deciding data, source, owner, confirming, rejecting and inconclusive outcomes before assigning a verdict.
5. Review supplied evidence. No access means no observation. Return a data request or bounded inconclusive diagnosis when necessary.
6. Apply the [critic](../agents/critic-agent.md) and [format conventions](format-conventions.md). Correct unsupported claims rather than adding branches or numbers to satisfy a diagram shape.

## Decision boundary

A useful diagnosis may explain only part of the observed difference. Keep quantitative residuals and unresolved causes visible. Do not distribute an unexplained gap across plausible candidates merely to complete a table. Contribution arithmetic and causal confidence answer different questions.

Carry a material unresolved alternative into the next-step recommendation. Decide whether another observation is worthwhile from its ability to change the action, its access cost and the consequence of being wrong. A small numerical contribution can still matter if it exposes a measurement or safety problem.

## Delivery and follow-up

Return the evidence boundary, comparison, diagnostic map, hypotheses, verdict table, external factors and one discriminating next check. Use existing context instead of repeating a cold-start interview. The sequential fallback uses the same evidence requirements when separate agents are unavailable.

An internal review pass certifies that the stated checks were met. It does not grant permission for tracking changes, experiments, spending or contact. No live action follows automatically from the diagnosis. Preserve uncertainty when routing to `prioritize` or requesting new data.
