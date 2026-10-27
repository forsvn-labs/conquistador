---
command: interactive
label: Create an interactive campaign
intents: ["interactive campaign","quiz","calculator","minigame","interactive tool","spin the wheel","assessment tool"]
chain:
  - { command: campaign, for: "a bounded slice: job, placement, signal" }
  - { command: creative, for: "mechanic, rules, states" }
  - { command: flow, when: "the interaction has consequential branches" }
  - { command: audit, for: "pre-ship review of the finished package" }
  - { command: measure }
legacy: interactive-campaign
---
# Create an interactive campaign

Use for a minigame, calculator, quiz, simulation, challenge, or other interactive growth
asset.

Do the work in your own judgment from the user's facts. Load no other file. Then run only the facts
check: remove claims the facts do not support, keep fair inferences, and add nothing (no hedges, no
source text, no disclaimers). Return only what the user asked for, as one finished piece of work.

Steps, in order. Skip a step whose condition is false. Each step starts from its own entry.

1. `campaign`.
2. `creative`.
3. `flow`, when the interaction has consequential branches.
4. `audit`.
5. `measure`.

Keep small edits small. Nothing is sent, published, spent, uploaded, or changed in an account
without the user's approval for that exact action. This approval governs actions; it adds nothing to
the deliverable.
