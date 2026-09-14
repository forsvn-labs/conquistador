---
name: write-copy
description: "Write or rewrite finished product-marketing copy blocks: landing pages, product pages, headlines, calls to action, messaging variants, and launch announcement copy. Use when the deliverable is paste-ready copy that is specific, credible, on-brand, and ready to publish. Route multi-touch outreach sequences to write-outreach, channel-native social posts to write-social, long-form articles to write-longform, and full paid-campaign buildouts to create-paid-campaign."
metadata:
  version: 2.1.1

---

# Write product-marketing copy

Produce the finished copy first. Use the customer's brand as the brand of record.

## Anchor the work

Infer:

- audience and real moment;
- product mechanism;
- credible outcome;
- proof;
- main objection;
- intended action;
- surface, voice, language, and constraints.

Ask at most one bundled question when different answers would change the copy materially. Otherwise
label the assumption and continue.

Match the sequence to audience awareness: do not lead a problem-unaware reader with product detail or
ask a solution-aware reader to sit through generic education. Preserve one argument from costly moment
through mechanism, proof, objection, and proportionate action.

## Build the argument

Use [sales argument](references/sales-argument.md) to connect the supplied product facts, buyer's
situation, evidence, offer terms, and requested action. The method is self-contained.

## Scope and handoffs

This skill owns the copy block itself.

Include:

- landing and product page copy;
- headlines, CTAs, and messaging variants;
- launch announcement copy;
- single behavior-triggered lifecycle emails, and the copy layer of a lifecycle sequence
  (one psychological job per touch; campaign design stays with `lifecycle-campaign`).

Exclude — route instead:

- multi-touch outreach sequences → `write-outreach`;
- channel-native social posts → `write-social`;
- long-form articles → `write-longform`;
- a full paid campaign buildout (ad sets per network from a plan) → `create-paid-campaign`;
- measuring copy performance after launch → `measure-growth`.

## Write from the product outward

Prefer concrete nouns, active verbs, observable outcomes, and product details a competitor could not
claim unchanged. Put proof next to the claim it supports. Match the CTA to current trust.

Review each headline, hook, CTA, tagline, and subject line in its actual context. Check its meaning
against the product facts and approved terms. Use [copy review](references/copy-review.md) to record
unsupported claims, unclear arguments, and misleading actions. No average score can excuse a
materially false claim.

Remove:

- “all-in-one,” “seamless,” “revolutionary,” and other category filler without evidence;
- empty setup, repeated summaries, generic AI cadence, and decorative jargon;
- fake quotes, invented numbers, vague attribution, or unsupported superlatives;
- forced urgency, engagement bait, false familiarity, and channel-inappropriate formatting.

Apply the surface:

- **Landing page:** audience, costly moment, promise, mechanism, proof, objections, and next step in a
  scan-friendly sequence.
- **Lifecycle email (single send):** trigger from real behavior, give one useful next step; multi-touch
  sequence design routes to `write-outreach`.
- **Launch:** explain what changed, who it serves, why now, how it works, and how to try it.

Ad copy inside a paid campaign belongs to `create-paid-campaign`; this skill supplies headlines and
CTA units only when asked for standalone blocks.

## Deliver

Return paste-ready copy in the requested structure. Add variants only when each represents a different
strategic bet, and label the bet rather than calling them A/B/C.

Then provide at most:

- the chosen audience, promise, and mechanism;
- two or three consequential decisions;
- factual claims that require verification;
- one recommended next action.

Before delivery, load the relevant writing and review contracts:

- [hook](agents/hook-agent.md), [body](agents/body-agent.md), [CTA](agents/cta-agent.md), and
  [social proof](agents/social-proof-agent.md) for the requested units;
- [variant](agents/variant-agent.md) for high-leverage A/B alternatives on Route B pages;
- [voice](agents/voice-agent.md), [psychology](agents/psychology-agent.md), and
  [zero-risk](agents/zero-risk-agent.md) as later passes;
- [critic](agents/critic-agent.md) for the final evidence and offer review;
- [copy review](references/copy-review.md), [anti-patterns](references/anti-patterns.md),
  [Discovery Story](references/discovery-story.md), and
  [lifecycle sequences](references/lifecycle-sequences.md) when those surfaces apply.

If the host cannot run those as separate agents, use [sequential fallback](fallbacks/sequential.md).
Include the competitor-swap and first-screen tests. Revise the weak unit rather than swapping one
vague synonym for another, then verify that names, numbers, links, claims, and CTA strength did not
regress.

Never invent claims, quotes, metrics, customers, or consent. Keep sending, publishing, and external
writes behind explicit approval.
