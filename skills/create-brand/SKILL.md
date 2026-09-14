---
name: create-brand
description: "Create or refine a practical brand foundation. Use for brand strategy, point of view, voice, messaging architecture, naming direction, verbal identity, visual creative direction, founder-versus-company voice, or a compact brand system that operators and creators can apply consistently."
metadata:
  version: 2.1.0

---

# Create a practical brand foundation

Build a distinctive, usable brand system from product truth. Do not apply FORSVN's house style to a
customer brand.

## Ground the brand

Infer existing decisions from the product, audience, shipped interface, customer language, and current
materials. Separate what the product proves today from the aspiration it is growing toward.

Define:

- audience and high-friction moment;
- product mechanism and credible change;
- main alternative and useful tension;
- available proof;
- operator or founder personality that can be sustained;
- category conventions worth keeping or rejecting.

Do not turn character priorities into costumes. Build distinction from a defensible mechanism, tension, or point
of view. Decide whether each statement belongs to the founder, company, or product.

## Create the system

Produce:

1. **Brand idea** — one durable organizing thought.
2. **Position and promise** — specific audience, moment, mechanism, and credible outcome.
3. **Point of view** — what the brand believes that changes how it acts.
4. **Message architecture** — primary promise, supporting pillars, proof, objections, and boundaries.
5. **Voice** — three to five behavioral traits, each with “do” and “avoid” examples.
6. **Verbal patterns** — vocabulary to own, language to avoid, naming and CTA behavior.
7. **Creative direction** — visual principles, hierarchy, imagery, motion, and evidence treatment.
8. **Applications** — representative homepage hero, product description, and social introduction.

Keep identity direction implementable without prescribing arbitrary aesthetics. Preserve accessibility,
legibility, localization, and the product's real maturity.

## Quality gate

Run the 5 Tension Dimensions and 4 Critic Questions in
[narrative tension](references/narrative-tension.md) before the system ships. Do not invent struggle,
comeback, or a public persona the operator cannot sustain.

- Replace the name with a competitor. If the system still fits, add product mechanism or evidence.
- Read the voice aloud. If it requires constant performance from the real operator, simplify it.
- Remove unsupported superlatives, false urgency, and borrowed category slogans.
- Check that strategy, copy, visual direction, and product behavior make the same promise.

Run an application acceptance check across the homepage hero, product description, and social
introduction. Verify that each preserves the same promise, proof, voice ownership, hierarchy,
accessibility, localization boundary, and implementable visual or token direction. Mark missing source
assets and provisional choices instead of fabricating them.

Deliver the compact foundation first. Label provisional decisions and name the evidence needed to make
them durable.

Before delivery, load the recovered method instead of paraphrasing it:

- [strategy](agents/strategy-agent.md), [personality](agents/personality-agent.md),
  [voice](agents/voice-agent.md), and [visual](agents/visual-agent.md) for Layer 1;
- [token architect](agents/token-architect-agent.md),
  [component token](agents/component-token-agent.md), and
  [accessibility](agents/accessibility-agent.md) for Layer 2 on a full system;
- [critic](agents/critic-agent.md) for cross-element coherence, narrative quality, and AI-readability;
- [brand-system method](references/brand-system-method.md),
  [format conventions](references/format-conventions.md),
  [narrative tension](references/narrative-tension.md),
  [platform surfaces](references/platform-surfaces.md), and
  [anti-patterns](references/anti-patterns.md) before ship.

If the host cannot run those as separate agents, use [sequential fallback](fallbacks/sequential.md).
Route A produces a compact brand-foundation artifact; Route B adds design specification and asset
inventory sections. `BRAND.md`, `DESIGN.md`, and `ASSETS.md` are portable artifact labels, not
required pre-existing files. Return them inline by default. Use a host-provided durable location only
when it exists and the operator asks for persistence. Declare target platforms before drafting;
if the operator cannot enumerate them, proceed with an explicitly labeled assumed set (see
[sequential fallback](fallbacks/sequential.md)) rather than refusing. Preserve human
`[~]` / `[!]` markers on ASSETS.md re-runs.

No sibling skill, canonical project tree, or hidden runtime is required. Do not invent product claims,
customer evidence, or endorsements. Keep publication and external writes behind explicit approval.
