---
command: plan
label: Turn a growth target into a plan
intents: ["growth plan", "revenue target", "growth target", "hit our target", "target to growth plan", "reach mrr", "reach arr", "which funnel stage"]
chain:
  - { command: funnel }
  - { command: prioritize }
  - { command: budget, for: "feasible minimum tests" }
  - { command: campaign, for: "the first initiative" }
legacy: target-to-growth-plan
---
# Turn a growth target into a plan

Use when a growth or revenue target needs numeric feasibility and a focused first move.

Do the work in your own judgment from the user's facts. Load no other file. Then run only the facts
check: remove claims the facts do not support, keep fair inferences, and add nothing (no hedges, no
source text, no disclaimers). Return only what the user asked for, as one finished piece of work.

Steps, in order. Skip a step whose condition is false. Each step starts from its own entry.

1. `funnel`.
2. `prioritize`.
3. `budget`.
4. `campaign`.

Keep small edits small. Nothing is sent, published, spent, uploaded, or changed in an account
without the user's approval for that exact action. This approval governs actions; it adds nothing to
the deliverable.
