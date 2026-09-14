---
name: brief-creative
description: "Create an implementation-ready creative brief. Use for landing pages, campaign graphics, product previews, screenshots, demo videos, short-form video, out-of-home, social media assets, or any design and production request that needs a clear communication job, concept, hierarchy, requirements, and acceptance criteria."
metadata:
  version: 2.1.0

---

# Brief creative work

Turn a marketing decision into a production brief that a designer, developer, photographer, or video
creator can execute without guessing.

## Define the communication job

Establish:

- target audience and viewing context;
- action or belief the asset must create;
- one message hierarchy;
- product mechanism and proof to make visible;
- destination and campaign promise;
- format, placement, dimensions, duration, language, and accessibility constraints;
- available source assets and factual restrictions.

Ask only when a missing decision would materially change the concept. Label reasonable assumptions.

For a bounded inline page or interaction brief composed by a parent workflow, supplied brand facts,
semantic token names, source assets, and factual restrictions are the available brand source. Return
one buildable concept at the requested depth. Do not hard-block on absent `BRAND.md`, `DESIGN.md`, or
a realized surface; label the missing execution inputs and never invent them. Intermediate concept
approval is not required to return an advisory brief. Rendering, implementation, publication, and
other external action still require their normal authority gates.

## Choose one concept

Express the concept as a concrete relationship between message, product evidence, and form. A concept
is not a mood-board adjective. Explain why the chosen form makes the claim easier to understand or
believe.

Prefer:

- product behavior, demonstration, comparison, or artifact as evidence;
- one dominant idea and deliberate hierarchy;
- native composition for the destination;
- readable type, useful contrast, captions, and reduced-motion alternatives;
- modular production that supports the required variants.

Reject arbitrary gradients, stock symbolism, decorative dashboards, fake UI, fabricated metrics, and
visual novelty disconnected from the message.

## Specify the production

Deliver:

1. communication job and audience moment;
2. single concept and why it works;
3. frame, section, shot, or scene sequence;
4. exact copy hierarchy and required product evidence;
5. art direction: composition, imagery, typography behavior, color roles, and motion;
6. asset inventory, source-of-truth files, and production constraints;
7. variant matrix for formats that genuinely need different composition;
8. accessibility and localization requirements;
9. acceptance criteria and rejection conditions.

For a landing page, specify scan order, sections, proof placement, objection handling, and responsive
behavior. For video, specify hook, beat timing, visual proof, captions, audio role, CTA, and end state.
For product previews, distinguish representative mockups from shipped functionality.

For out-of-home work, design for a three-second read at the real viewing distance, speed, placement,
scale, lighting, and obstruction conditions. Keep one message, specify full-size production and safe
areas, account for vendor/material/installation constraints, and require a distance proof; a social
graphic enlarged to billboard dimensions is not an OOH concept.

Every motion handoff must include a still or poster fallback and reduced-motion behavior that preserves
the message, proof, and action without relying on animation or audio.

Keep the brief precise about communication and flexible about craft decisions that belong to the
creator.

## Prepare a render-ready handoff

When the user needs prompts or a production bundle, add one handoff per genuinely different asset:

- the exact output dimensions, aspect ratio, safe zones, crop behavior, and file format;
- the exact copy strings to render, marked verbatim;
- source assets by path or attachment, with explicit logo and product-UI grounding;
- composition, subject, camera or illustration behavior, lighting, texture, color roles, and exclusions;
- engine-specific syntax only when the target tool is known; otherwise use plain production language;
- a variant table only where the concept or composition changes, not cosmetic prompt churn;
- a verification checklist for copy fidelity, brand marks, product truth, legibility, accessibility,
  dimensions, and visible render defects.

Never invent a logo, product screen, person, metric, or customer. Use a labeled placeholder when a
required source asset is absent. If the host has an image or video tool, render only when the user
asked for production and the tool is available; review the actual output against the brief before
delivery. Otherwise return the complete handoff without implying that an asset was rendered.

Do not fabricate product UI, performance, customers, or consent. Keep production orders, uploads,
publishing, and external writes behind explicit approval.

Before delivery, load the recovered method instead of paraphrasing it. Apply its full brand-file,
candidate, and production-gate ceremony only to standalone file/production mode. Bounded inline
parent composition uses the compact contract above. Keep graphic-brief, asset-production, and
out-of-home as distinct lenses.

**Graphic brief**

- [brand-anchor](agents/brand-anchor-agent.md), [concept](agents/concept-agent.md),
  [copy-anchor](agents/copy-anchor-agent.md), [brief-synth](agents/brief-synth-agent.md);
- [prompt-craft](agents/prompt-craft-agent.md) or [figma-spec](agents/figma-spec-agent.md);
- [critic](agents/critic-agent.md) with [visual rubric](references/visual-rubric.md);
- [graphic-brief method](references/graphic-brief-method.md),
  [asset types](references/asset-types.md), [platform modules](references/platform-modules.md),
  [prompt patterns](references/prompt-patterns.md),
  [failure modes](references/failure-modes.md), and
  [anti-patterns](references/anti-patterns.md).

**Asset production** (render-ready handoff from an approved brief)

- [prompt-author](agents/prompt-author-agent.md) and
  [asset critic](agents/asset-critic-agent.md);
- [asset critical gates](references/asset-critical-gates.md),
  [image-engine dialects](references/image-engine-dialects.md),
  [render engines](references/render-engines.md),
  [production pattern](references/production-pattern.md),
  [asset anti-patterns](references/asset-anti-patterns.md).

**Out-of-home**

- [ooh concept](agents/ooh-concept-agent.md),
  [ooh spec/legibility](agents/ooh-spec-legibility-agent.md),
  [ooh critic](agents/ooh-critic-agent.md);
- [ooh format](references/ooh-format-conventions.md) and
  [ooh anti-patterns](references/ooh-anti-patterns.md).

If the host cannot run those as separate agents, use [sequential fallback](fallbacks/sequential.md).
Review of delivered briefs follows [roughdraft review protocol](references/roughdraft-review-protocol.md)
and lands `decision_state` per the [reviewable artifact contract](references/reviewable-artifact-contract.md);
the internal critic gate never substitutes for that human decision.
If the host has a durable artifacts directory (for example `.forsvn/artifacts/mkt/brief-creative/`),
write briefs and production handoffs there; otherwise return them inline. Name
`create-shortform` for short-form video work; do not load that skill's files from here.

Never invent logos, product UI, people, metrics, or consent. Keep production orders, uploads,
publishing, and external writes behind explicit approval.
