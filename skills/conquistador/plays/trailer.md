---
command: trailer
label: Create an app preview video
intents: ["app preview","app preview video","app trailer","store preview video","product demo video","screenshot sequence"]
chain:
  - { command: flow, when: "the source interaction is not approved" }
  - { command: creative, for: "shots, motion, captions, formats" }
  - { method: video-production, for: "capture, edit, and output checks" }
legacy: create-app-preview
---
# Create an app preview video

Use for a screenshot sequence, store preview, founder demo, or short app interaction story.

1. Use `flow` when the source interaction, platform surfaces, and recovery states are not
   already approved.
2. Use `creative` to select one feature story and specify shots, motion, crop, cursor, captions,
   privacy, delivery formats, and acceptance.
3. Use the [video-production](../methods/video-production.md) method for real capture, edit, sound-off comprehension, safe zones,
   encoding, and actual-output verification.

Read the preview playbooks in [trailer/](trailer/) (flow slicer,
interaction storyboard, motion spec, platform format, interaction grammar). Do not paraphrase them.

Use real shipped UI or an explicitly labeled representative prototype. Never invent screens,
interactions, notifications, data, performance, or product states. Prefer a legible component-level
story over an unstructured full-screen tour.

End with one terminal Review Packet for final human review: story bet, shot sequence, production-ready
specification, truth/privacy boundary, and one next action.
