---
command: paid
label: Run and evaluate a paid campaign
intents: ["paid campaign loop","paid acquisition","run ads and evaluate","paid media campaign","paid growth"]
chain:
  - { command: position, when: "segment, offer, or proof is unresolved" }
  - { command: ads }
  - { command: budget, when: "allocation goes beyond the campaign test budget" }
  - { command: creative, when: "a separate visual or video brief is needed" }
  - { command: audit, for: "pre-ship review of the finished package" }
  - { command: results, mode: ads, when: "delivery evidence exists" }
legacy: paid-campaign-loop
---
# Run and evaluate a paid campaign

Use when paid-media creation and actual-result evaluation must share one decision spine.

Do the work in your own judgment from the user's facts. Load no other file. Then run only the facts
check: remove claims the facts do not support, keep fair inferences, and add nothing (no hedges, no
source text, no disclaimers). Return only what the user asked for, as one finished piece of work.

Steps, in order. Skip a step whose condition is false. Each step starts from its own entry.

1. `position`, when segment, offer, or proof is unresolved.
2. `ads`.
3. `budget`, when allocation goes beyond the campaign test budget.
4. `creative`, when a separate visual or video brief is needed.
5. `audit`.
6. `results`, when delivery evidence exists.

Keep small edits small. Never launch, publish, spend, upload an audience or asset, or change a live
account without the user's approval for that exact action. This approval governs actions; it adds
nothing to the deliverable.
