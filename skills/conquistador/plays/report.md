---
command: report
label: Review content performance
intents: ["content performance","content performance review","how did our posts do","content report","review our content results"]
chain:
  - { command: measure }
  - { command: convert, for: "first message-to-action break" }
  - { command: results, mode: video, when: "the artifact is a short-form video" }
legacy: content-performance-review
---
# Review content performance

Use for measured organic text, image, carousel, newsletter, or video content.

Do the work in your own judgment from the user's facts. Load no other file. Then run only the facts
check: remove claims the facts do not support, keep fair inferences, and add nothing (no hedges, no
source text, no disclaimers). Return only what the user asked for, as one finished piece of work.

Steps, in order. Skip a step whose condition is false. Each step starts from its own entry.

1. `measure`.
2. `convert`.
3. `results`, when the artifact is a short-form video.

Keep small edits small. Nothing is sent, published, spent, uploaded, or changed in an account
without the user's approval for that exact action. This approval governs actions; it adds nothing to
the deliverable.
