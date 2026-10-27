---
command: content
label: Run a content learning loop
intents: ["content loop","content engine","content intelligence loop","repeatable content","content flywheel","content system"]
chain:
  - { command: ideas }
  - { command: social, for: "the finished channel-native artifact" }
  - { command: critique, for: "independent readiness review" }
  - { command: measure, when: "the observation window has closed" }
legacy: content-intelligence-loop
---
# Run a content learning loop

Use when current audience signals must become a repeatable content learning loop.

Do the work in your own judgment from the user's facts. Load no other file. Then run only the facts
check: remove claims the facts do not support, keep fair inferences, and add nothing (no hedges, no
source text, no disclaimers). Return only what the user asked for, as one finished piece of work.

Steps, in order. Skip a step whose condition is false. Each step starts from its own entry.

1. `ideas`.
2. `social`.
3. `critique`.
4. `measure`, when the observation window has closed.

Keep small edits small. Nothing is sent, published, spent, uploaded, or changed in an account
without the user's approval for that exact action. This approval governs actions; it adds nothing to
the deliverable.
