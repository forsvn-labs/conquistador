---
name: create-paid-campaign
description: "Create a focused paid-media test. Use for Meta, Google, LinkedIn, TikTok, or another ad network when the user needs audience and offer strategy, finished ads, creative direction, landing-page congruence, budget logic, policy awareness, and a measurement plan before launch."
metadata:
  version: 2.1.0

---

# Create a paid campaign

Design the smallest paid test that can answer a consequential question. Do not treat spend, reach, or
clicks as the strategy.

## Establish the ad contract

Choose one network, one audience segment, one temperature, one offer, and one destination per test.
Verify current network formats, targeting availability, and policy when they affect the work.

Define:

- costly moment and audience qualification;
- promise, mechanism, proof, and main objection;
- offer and proportionate next action;
- what the landing page must repeat;
- primary business signal and diagnostic platform metrics.

Do not invent customer proof, performance benchmarks, targeting precision, or policy clearance.

## Create discriminating variants

Earn the impression before you ask. Load [earn the impression](references/earn-the-impression.md)
for the evidence record, controlled comparison, and review procedure. Use supported details
that clarify the actual offer; do not fill a quota of names, numbers, or citations.

Write finished network-native ads. Variants must test different hypotheses—not synonyms. For each,
provide the required components, such as primary text, headline, description, CTA, search headline,
or video hook.

Brief creative around product evidence, mechanism, or a real transformation. Keep ad, creative,
offer, and destination congruent. Identify claims or visual behavior that must be verified before
launch.

For a truthful UGC concept, disclose sponsorship or affiliation, use a real consenting actor, and
label scripted or representative scenarios. Never fabricate a customer, spontaneous reaction,
testimonial, or result. Every motion concept needs a still or poster fallback and reduced-motion
version that carries the same proof and CTA.

## Budget learning

Use current auction/input evidence when available. Fund the minimum viable test that can answer its
question, or recommend zero spend.

Specify:

- budget ceiling and allocation;
- sample or observation requirement;
- primary decision signal;
- diagnostics and guardrails;
- keep, revise, stop, and reallocation conditions;
- attribution limits and likely confounders.

Plan evaluation for one network/segment at a time. A future high click-through rate cannot override
poor qualified conversion or a safety/compliance failure.

This skill creates the test and its evaluation contract. Real post-launch evidence belongs to
`evaluate-paid-campaign`; do not imply that planned metrics are observed results.

## Deliver

Return the audience/offer contract, finished ad set, creative direction, destination requirements,
budget/test table, evaluation plan, and exact human approval boundary.

Before delivery, load the method instead of paraphrasing it:

- [strategist](agents/strategist.md), [composer](agents/composer.md),
  [format checker](agents/format-checker.md), [voice auditor](agents/voice-auditor.md), then
  [critic](agents/critic.md);
- the matching ad-intelligence pack by exact file —
  [Meta cold traffic](references/ad-intelligence/meta-cold-traffic.md),
  [Meta retargeting](references/ad-intelligence/meta-retargeting.md),
  [Google Ads](references/ad-intelligence/google-ads.md),
  [LinkedIn Ads](references/ad-intelligence/linkedin-ads.md), or
  [TikTok Ads](references/ad-intelligence/tiktok-ads.md) — plus
  [creative cadence](references/ad-intelligence/creative-cadence.md) when spend or fatigue rules
  matter;
- [format spec](references/format-spec.md), [policy floor](references/policy-floor.md),
  [message transmutation](references/message-transmutation.md), and
  [rubric](references/rubric.md);
- [earn the impression](references/earn-the-impression.md) and
  [anti-patterns](references/anti-patterns.md) before ship.

If the host cannot run those as separate agents, use [sequential fallback](fallbacks/sequential.md).
One network and one audience temperature (or the network's framing axis) per artifact. Controlled variants
isolate one variable. Label exploratory concepts and their causal limits explicitly.

Never launch, spend, upload audiences, or change a live account without explicit approval for that
action. A critic PASS and any optional language-polish pass are internal quality gates only; they do
not complete the job, authorize launch or spend, or substitute for the human acceptance boundary.
For Vietnamese copy, the public `polish-vietnamese` skill may be named as an optional helper when
installed; no polish pass overrides `protected_tokens` including the destination URL.
