---
command: plan
label: Turn a growth target into a plan
intents: ["growth plan","revenue target","growth target","hit our target","target to growth plan","reach mrr","reach arr"]
chain:
  - { command: funnel }
  - { command: prioritize }
  - { command: budget, for: "feasible minimum tests" }
  - { command: campaign, for: "the first initiative" }
legacy: target-to-growth-plan
---
# Turn a growth target into a plan

Use when a growth or revenue target needs numeric feasibility and a focused first move.

1. Use `funnel` to define units, model backward, label observed values and assumptions,
   and expose sensitivity, capacity, and unit-economics constraints.
2. Use `prioritize` to identify the binding constraint and force a cut line.
3. Use `budget` to allocate only feasible minimum tests with reallocation triggers.
4. Use `campaign` for the first initiative after the model identifies the acquisition or
   activation requirement.

Do not reverse-engineer optimistic rates to make the target look feasible. Include downside/base/upside
cases, the evidence plan for unknown inputs, and a no-go condition.

End with one terminal Review Packet for final human review: target math, binding constraint, chosen
initiative, bounded allocation, assumptions, and one next action.
