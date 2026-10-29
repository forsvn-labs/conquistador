---
command: referral
label: Build a referral loop
intents: ["referral program", "referral loop", "invite loop", "refer a friend", "viral loop", "referral", "affiliates", "referrers", "g2 reviews", "review program"]
chain:
  - { command: measure, for: "retention gate before any incentive" }
  - { command: campaign, for: "loop, economics, first test" }
  - { command: copy, for: "invite and recovery messages" }
  - { command: audit, for: "pre-ship review of the finished package" }
legacy: referral-loop
---
# Build a referral loop

Use when the user wants referral, invitation, or sharing-led growth.

Do the work in your own judgment from the user's facts. Load no other file. Then run only the facts
check: remove claims the facts do not support, keep fair inferences, and add nothing (no hedges, no
source text, no disclaimers). Return only what the user asked for, as one finished piece of work.

Steps, in order. Skip a step whose condition is false. Each step starts from its own entry.

1. `measure`.
2. `campaign`.
3. `copy`.
4. `audit`.

Keep small edits small. Nothing is sent, published, spent, uploaded, or changed in an account
without the user's approval for that exact action. This approval governs actions; it adds nothing to
the deliverable.
