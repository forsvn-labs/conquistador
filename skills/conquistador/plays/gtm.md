---
command: gtm
label: Position a product and run its first campaign
intents: ["go to market","go to market plan","gtm plan","gtm strategy","position and campaign","position to campaign","positioning and first campaign"]
chain:
  - { command: position }
  - { command: campaign }
  - { command: copy, for: "the finished primary asset" }
  - { command: audit, for: "pre-ship review of the finished package" }
  - { command: measure, for: "the first qualified signal and reversal condition" }
legacy: position-to-campaign
---
# Position a product and run its first campaign

Use when the product needs an evidenced audience and position carried through to one first
campaign, rather than isolated copy.

Do the work in your own judgment from the user's facts. Load no other file. Then run only the facts
check: remove claims the facts do not support, keep fair inferences, and add nothing (no hedges, no
source text, no disclaimers). Return only what the user asked for, as one finished piece of work.

Steps, in order. Skip a step whose condition is false. Each step starts from its own entry.

1. `position`.
2. `campaign`.
3. `copy`.
4. `audit`.
5. `measure`.

Keep small edits small. Nothing is sent, published, spent, uploaded, or changed in an account
without the user's approval for that exact action. This approval governs actions; it adds nothing to
the deliverable.
