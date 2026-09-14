---
name: research-channel
description: "Research and choose a marketing channel using owned performance, current public evidence, platform mechanics, audience habitat, native format, proof requirements, operator capacity, benchmarks, and freshness. Use when channel choice needs evidence rather than generic best practices. Not for budget math, campaign planning, or performance readouts — hand those off (see Route elsewhere)."
metadata:
  version: 2.1.0

---

# Research a channel decision

Choose where and how to operate from evidence, fit, and capacity—not popularity.

## Define the decision

Name the product, audience, outcome, candidate channels, time horizon, operator capacity, and what
would change the choice. A channel audit without a decision becomes a fact dump.

## Keep evidence types separate

Collect and label:

- owned/account performance with source, window, sample, and comparable format;
- operator-supplied experience and constraints;
- current primary platform documentation and policy;
- current observed examples or manual sampling;
- third-party benchmarks with population and comparability;
- inference and unknowns.

Use freshness appropriate to the claim. Reverify volatile formats, ranking signals, policy, pricing,
and platform features at execution time. Owned results can guide account-specific choices without
overriding brand, safety, or channel-fit floors.

## Compare fit

For each channel assess:

- audience habitat and intent;
- native format and value delivered in-channel;
- proof available;
- distribution/access advantage;
- feedback speed;
- production and participation capacity;
- destination readiness;
- safety, policy, and reputation risk;
- primary outcome and realistic diagnostics.

Include a veto: when the product should not use the channel.

State the reversal evidence that would change the recommendation and a revisit trigger tied to new
owned results, platform change, capacity, or destination readiness—not merely the passage of time.

## Route elsewhere

This skill chooses channels from evidence; it does not own the downstream work. Include it when the
ask is which channel(s) to operate and with what role, format, and first test. Hand off when the ask
moves past the choice:

- Budget math across chosen channels → allocate-marketing-budget.
- Turning a channel choice into a dated campaign plan → plan-campaign.
- Reading performance after launch → measure-growth.

Measuring owned accounts is this skill's job; discovering what works in the wild belongs to
research-content-ideas, and positioning questions belong to research-positioning.

## Deliver

Return:

1. decision and evidence boundary;
2. owned-evidence readout;
3. public evidence with source/freshness notes;
4. focused channel comparison;
5. recommended channel, role, format, and first test;
6. channels to defer and why;
7. next evidence, reversal evidence, revisit trigger, and date.

Before delivery, load the recovered method instead of paraphrasing it:

- [evidence intake](agents/evidence-intake-agent.md) per in-scope platform, then
  [benchmark](agents/benchmark-agent.md);
- [synthesis](agents/synthesis-agent.md) and [recommendation](agents/recommendation-agent.md);
- [critic](agents/critic-agent.md) against the five provenance rubrics;
- [evidence protocol](references/evidence-protocol.md),
  [scoring rubrics](references/scoring-rubrics.md),
  [confidence labeling](references/confidence-labeling.md),
  the matching [platform schema](references/platforms/), and
  [anti-patterns](references/anti-patterns.md) before ship.

If the host cannot run those as separate agents, use [sequential fallback](fallbacks/sequential.md).
Write the evidence artifact under `.forsvn/artifacts/mkt/research-channel/` when that store exists;
otherwise deliver it inline in the reply. Coverage flags gate
recommendations: MEASURED normal, PARTIAL capped at confidence M, NO_EVIDENCE recommend nothing.
Gaps are findings — never pad them with guesses.

Do not publish, contact communities, access private analytics, or change live channel settings without
explicit approval.
