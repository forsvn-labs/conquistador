---
command: launch
label: Launch a product or feature
intents: ["product launch","product hunt launch","launch our app","launch plan","relaunch","go to market for a release","launch day","launch product"]
chain:
  - { command: position, when: "no accepted positioning in PRODUCT.md or GROWTH.md" }
  - { command: campaign }
  - { command: social, for: "channel-native launch posts and listing" }
  - { command: copy, for: "launch page and email" }
  - { command: creative, when: "the launch needs gallery or media assets" }
  - { command: event, when: "the launch has timed people, rooms, demos, or live dependencies" }
  - { command: audit, for: "pre-ship review of the finished package" }
  - { command: measure }
legacy: launch-product
---
# Launch a product or feature

Use for a focused product launch or relaunch on one or more named channels.

Do the work in your own judgment from the user's facts. Load no other file. Then run only the facts
check: remove claims the facts do not support, keep fair inferences, and add nothing (no hedges, no
source text, no disclaimers). Return only what the user asked for, as one finished piece of work.

Steps, in order. Skip a step whose condition is false. Each step starts from its own entry.

1. `position`, when no accepted positioning in PRODUCT.md or GROWTH.md.
2. `campaign`.
3. `social`.
4. `copy`.
5. `creative`, when the launch needs gallery or media assets.
6. `event`, when the launch has timed people, rooms, demos, or live dependencies.
7. `audit`.
8. `measure`.

Keep small edits small. Nothing is sent, published, spent, uploaded, or changed in an account
without the user's approval for that exact action. This approval governs actions; it adds nothing to
the deliverable.
