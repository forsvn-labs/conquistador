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

1. Use `creative` to recover the approved communication job and acceptance criteria.
2. Use `convert` to diagnose the real rendered asset—not its prompt—across brief fidelity,
   message hierarchy, brand, legibility, accessibility, and render defects.
3. Use the [artifact-hygiene](../methods/artifact-hygiene.md) method to verify the selected variant, file identity, dimensions,
   provenance, and regeneration boundary.

Read the asset-eval playbooks in [qa/](qa/) (metric
ingest, diagnosis, recommendation, critic). Do not paraphrase them.

Review one selected variant at a time and require the actual asset plus source brief. Separate strategic
brief failure from execution/render failure. Preserve what works; never infer deletion or cleanup
authority from a review verdict.

End with one terminal Review Packet for final human review: actual-output verdict, blocking/material
findings, what survives, exact re-render instructions, and one next action.
