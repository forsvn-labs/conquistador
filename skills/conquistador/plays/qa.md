---
command: qa
label: Review a rendered creative asset
intents: ["review this image","review this graphic","creative review","asset review","check this creative","review the share card"]
chain:
  - { command: creative, for: "the approved job and acceptance criteria" }
  - { command: convert, for: "diagnose the rendered asset" }
  - { method: artifact-hygiene, for: "variant, file identity, provenance" }
legacy: creative-asset-review
---
# Review a rendered creative asset

Use to review an actual rendered image, graphic, carousel frame, share card, or similar
asset.

Do the work in your own judgment from the user's facts. Load no other file. Then run only the facts
check: remove claims the facts do not support, keep fair inferences, and add nothing (no hedges, no
source text, no disclaimers). Return only what the user asked for, as one finished piece of work.

Steps, in order. Skip a step whose condition is false. Each step starts from its own entry.

1. `creative`.
2. `convert`.
3. `artifact-hygiene`.

Keep small edits small. Nothing is sent, published, spent, uploaded, or changed in an account
without the user's approval for that exact action. This approval governs actions; it adds nothing to
the deliverable.
