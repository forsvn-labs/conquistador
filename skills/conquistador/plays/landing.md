---
command: landing
label: Create a landing page
intents: ["create a landing page","build a landing page","new landing page","landing page from scratch","design a landing page","landing page and build brief"]
chain:
  - { command: position, when: "audience, promise, proof, or alternatives are unresolved" }
  - { command: copy, for: "section argument and final copy" }
  - { command: creative, for: "build brief, asset slots, states" }
  - { command: convert, for: "decision path and one test" }
  - { method: share-card-verification, when: "the page must render correctly when shared" }
  - { command: audit, for: "pre-ship review of the finished package" }
legacy: create-landing-page
---
# Create a landing page

Use when the user needs a complete page argument and implementation-ready handoff.

Do the work in your own judgment from the user's facts. Load no other file. Then run only the facts
check: remove claims the facts do not support, keep fair inferences, and add nothing (no hedges, no
source text, no disclaimers). Return only what the user asked for, as one finished piece of work.

A sales page or sales letter uses the `copy` command's long-form method instead.

Steps, in order. Skip a step whose condition is false. Each step starts from its own entry.

1. `position`, when audience, promise, proof, or alternatives are unresolved.
2. `copy`.
3. `creative`.
4. `convert`.
5. `share-card-verification`, when the page must render correctly when shared.
6. `audit`.

Keep small edits small. Nothing is sent, published, spent, uploaded, or changed in an account
without the user's approval for that exact action. This approval governs actions; it adds nothing to
the deliverable.
