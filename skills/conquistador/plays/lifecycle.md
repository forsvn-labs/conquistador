---
command: lifecycle
label: Run a lifecycle campaign
intents: ["lifecycle campaign","onboarding sequence","onboarding flow emails","retention campaign","re engagement campaign","activation campaign","win back campaign","drip campaign"]
chain:
  - { command: campaign, for: "lifecycle job, entry event, branches, suppression, exit" }
  - { command: copy, for: "the smallest finished message set" }
  - { command: audit, for: "pre-ship review of the finished package" }
  - { command: measure, for: "transition behavior" }
legacy: lifecycle-campaign
---
# Run a lifecycle campaign

Use for activation, onboarding, retention, re-engagement, or other behavior-triggered
communication.

Do the work in your own judgment from the user's facts. Load no other file. Then run only the facts
check: remove claims the facts do not support, keep fair inferences, and add nothing (no hedges, no
source text, no disclaimers). Return only what the user asked for, as one finished piece of work.

Steps, in order. Skip a step whose condition is false. Each step starts from its own entry.

1. `campaign`.
2. `copy`.
3. `audit`.
4. `measure`.

Keep small edits small. Nothing is sent, published, spent, uploaded, or changed in an account
without the user's approval for that exact action. This approval governs actions; it adds nothing to
the deliverable.
