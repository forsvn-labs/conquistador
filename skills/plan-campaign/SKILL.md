---
name: plan-campaign
description: "Plan an executable product launch or growth campaign. Use for go-to-market plans, Product Hunt or community launches, positioning-to-launch sequencing, channel mix at plan level, campaign pillars and angles, growth experiment design, or turning a product goal into one focused launch sequence with owners and timing. Budget math, run-of-show detail, individual asset writing, and performance readouts belong to their dedicated skills."
metadata:
  version: 2.1.0

---

# Plan an executable campaign

Create the smallest campaign package that can ship, learn, and compound.

When a parent workflow asks only for a bounded campaign slice on one supplied owned surface, keep the
spine, value exchange, economics, signal, guardrails, and stop rule. The one supplied surface is a
closed channel set. Do not require a full launch calendar, hero-asset cascade, or nine-channel scan;
label absent execution inputs and keep activation behind approval.

## Scope and handoffs

This skill owns the integrated plan only.

Include:

- executable launch and growth campaign planning (positioning-to-launch sequence);
- channel evaluation and mix decisions at plan level;
- sequencing, timing, and the must-have asset inventory;
- pillars, angles, and growth experiment design with signals and stop rules;
- budget treated as a plan-level constraint (tiers and reallocation triggers).

Exclude — route instead:

- budget allocation math and spend scenarios → `allocate-marketing-budget`;
- event minute-by-minute run-of-show → `create-run-of-show`;
- writing individual ads, social posts, or creative assets →
  `create-paid-campaign`, `write-social`, or `brief-creative`;
- measuring results of a running campaign → `measure-growth`;
- a deep single-channel strategy → `research-channel`.

## Write the campaign spine

Define:

- Outcome: the observable business change.
- Audience: one primary audience for this campaign.
- Moment: why they care now.
- Promise: the credible change.
- Proof: what makes the promise believable.
- Objection: the main reason they will not act.
- Action: one proportionate next step.
- Measurement: one primary signal and a small diagnostic set.

If the spine cannot fit in a short paragraph, narrow the campaign.

## Choose channels by fit

Select the smallest channel set that covers the job:

- Existing demand: search, comparison pages, marketplaces, launch directories.
- Borrowed trust: communities, partners, creators, advocates.
- Direct access: email, outreach, sales-assisted conversations.
- Compounding attention: useful content, social distribution, owned audience.
- Paid acceleration: only when message and conversion path are testable.

Choose from audience habitat, native format, proof, operator capacity, feedback speed, and destination
readiness. For a named platform, verify current rules and norms when they affect the plan. Do not
recommend a channel because it is fashionable.

Apply a destination readiness gate before sequencing distribution: the promised action must work,
the proof must be present, ownership and measurement must be clear, and failure must be recoverable.

## Rank bets and budget learning

Force-rank opportunities before scoring them. Keep at most three active bets unless independent
capacity exists. Treat budget as a constraint, not a strategy.

Give every experiment:

- hypothesis and mechanism;
- one intentional change;
- audience and channel;
- primary signal and diagnostic guardrails;
- minimum useful observation window;
- keep, revise, or stop rule.

Maintain an asset inventory with owner, due point, dependency, status, and acceptance criteria. Place
assets into a timed sequence only when their prerequisites and review boundary are explicit.

Fund a test at the minimum level that can answer its question, or fund it at zero. Give each allocation
a reallocation trigger and destination. Do not hide uncertainty behind precise forecasts.

For lifecycle work, use behavioral triggers, activation events, and suppression conditions. For
referrals, earn retention first, bound rewards by economics, and add abuse controls before scaling.

## Deliver

Return:

1. campaign spine and strategic bet;
2. channel roles and sequence;
3. destination readiness decision and must-have asset inventory with acceptance criteria;
4. owner- and timing-specific schedule or run of show;
5. experiment and budget table;
6. measurement plan and decision date;
7. owners and the final human approval boundary.

Before delivery, load the method instead of paraphrasing it. In bounded parent composition,
load only the specialists that own the requested slice; full pillar banks, angle banks, multi-channel
assignment, phased timelines, and launch sequencing are N/A unless the slice requests them:

- [pillar](agents/pillar-agent.md), [angle](agents/angle-agent.md),
  [channel](agents/channel-agent.md), [timeline](agents/timeline-agent.md),
  [launch sequencing](agents/launch-sequencing-agent.md), then
  [critic](agents/critic-agent.md);
- [reader-decision angles](references/3d-angle-framework.md) (task, decision, and evidence),
  [launch sequencing](agents/launch-sequencing-agent.md) (readiness and dependencies),
  [channel strategy](references/channel-strategy.md),
  [platform channels](references/platform-channels.md),
  [growth plays](references/growth-play-patterns.md);
- [pillars before angles](references/pillars-before-angles.md) and
  [anti-patterns](references/anti-patterns.md) before ship.

If the host cannot run those as separate agents, use [sequential fallback](fallbacks/sequential.md).
Declare growth motion before selecting channels. When the request supplies a closed candidate set,
compare only those candidates; otherwise scan the nine channel families in the method.
Keep the smallest set that covers the job. Social and launch briefs load the matching
[platform intelligence](references/platform-intelligence/) pack.

Separate must-have launch work from optional follow-up. Keep publishing, spend, credentials, and
external writes behind explicit approval.
