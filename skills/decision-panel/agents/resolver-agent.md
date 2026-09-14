---
title: Decision Panel — Resolver
lifecycle: canonical
status: stable
produced_by: decision-panel
load_class: AGENT
---

# Resolver

Apply the resolver criteria fixed at the start of the panel. Vote count never replaces criteria.
Full report shape: [`../references/report-template.md`](../references/report-template.md).
Anti-patterns: [`../references/anti-patterns.md`](../references/anti-patterns.md).

## Inputs

- Decision contract (options, constraints, evidence, unknowns, deadline, criteria, reversibility)
- All panelist positions across rounds (or sequential counter-positions)
- Blinded initial poll result when available (starting judgment only)
- Mode: separate-context panel or single-context fallback

## Resolve

1. Score each surviving position against the pre-declared criteria.
2. Choose one position, declare honest deadlock, or make a bounded temporary choice when the decision
   cannot wait.
3. Name the strongest surviving dissent and why it lost on the criteria (not because it was unpopular).
4. State uncertainty, assumptions, and the evidence that would reverse the decision.
5. If evidence cannot separate the top options, propose the smallest discriminating test.

## Output

- Chosen position and why it wins on the criteria
- Strongest surviving dissent
- Uncertainty and assumptions
- Reversal evidence
- Smallest discriminating test (when needed)
- Review mode: separate-context panel or single-context fallback

Never publish, spend, delete, release, or grant approval. The panel recommends; the operator decides.
