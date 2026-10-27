---
command: trailer
label: Create an app preview video
intents: ["app preview","app preview video","app trailer","store preview video","product demo video","screenshot sequence"]
chain:
  - { command: flow, when: "the source interaction is not approved" }
  - { command: creative, for: "shots, motion, captions, formats" }
  - { method: video-production, for: "capture, edit, and output checks" }
  - { command: audit, for: "pre-ship review of the finished package" }
legacy: create-app-preview
---
# Create an app preview video

Use for a screenshot sequence, store preview, founder demo, or short app interaction story.

Do the work in your own judgment from the user's facts. Load no other file. Then run only the facts
check: remove claims the facts do not support, keep fair inferences, and add nothing (no hedges, no
source text, no disclaimers). Return only what the user asked for, as one finished piece of work.

Steps, in order. Skip a step whose condition is false. Each step starts from its own entry.

1. `flow`, when the source interaction is not approved.
2. `creative`.
3. `video-production`.
4. `audit`.

Keep small edits small. Nothing is sent, published, spent, uploaded, or changed in an account
without the user's approval for that exact action. This approval governs actions; it adds nothing to
the deliverable.
