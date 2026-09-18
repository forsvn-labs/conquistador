---
name: write-outreach
description: "Create signal-led outreach sequences and reply handling. Use for cold email, founder outreach, partnership or sales messages, LinkedIn DMs, other direct messages, proposals, follow-ups, inbound reply handling, deliverability, compliance, or planning how future qualified conversations will be judged."
metadata:
  version: 2.1.1

---

# Write trustworthy outreach

Earn relevance from an observable signal, make a small honest ask, and preserve the recipient's
control.

## Establish selection and proof

Define one segment, channel, observed selection signal, costly moment, affiliation, proof boundary,
and next action. A job title or company category alone is not personalization.

Choose the intent before applying proof gates. Sales, partnership, and product-claim outreach need
seller-side proof appropriate to the claim. Legitimate no-pitch founder research may proceed without seller proof. Targeted READY names a real
recipient signal, discloses affiliation and research intent, makes no outcome or superiority claim,
and asks one research question. Missing signal on **no-pitch-research** withholds that targeted
readiness (`NEEDS_SIGNAL`) and allows only a labeled generic template. Claim-bearing missing/weak
signal stays `READY` with conditional relevance. Missing proof narrows what a claim-bearing message may
claim; it does not force a pitch, an invented result, or an invented observation.

Trace target-specific statements to public, operator-supplied, or permissioned evidence. Label that
access class. Preserve the observation accurately and keep interpretation separate. The research
question is open and tied to current behavior. Never invent a trigger, private deal, shared
connection, customer result, or familiarity.

Keep signal research, strategy, proof checking, composition, reply handling, and critique distinct.
Independent specialists may handle those roles when supported; the portable sequential fallback runs
them in that order with separate notes and a final claim/consent review.

## Write the sequence

Create the smallest useful sequence:

- targeted READY: subject/opening tied to the signal;
- why the issue may matter now;
- credible mechanism or useful artifact;
- proof appropriate to the claim, or an explicit no-pitch research boundary;
- one low-friction ask;
- follow-up that adds value or closes the loop.

A labeled generic template (`readiness: NEEDS_SIGNAL`) skips “tied to the signal” on
**no-pitch-research** only. Use affiliation, research intent, one generic question, and recipient Control.
Claim-bearing missing/weak signal stays `READY` with conditional relevance, never a claim that the recipient has the problem. This editorial label is not targeting verification or send permission.

For an explicitly bounded `no-pitch-research` request for one message, the smallest useful sequence
is that one draft. Do not add a follow-up, reply bank, sales proof package, or campaign measurement
package merely to satisfy the general sequence contract. State that silence means no follow-up and
list only the checks needed before an actual send.

Do not use false urgency, deceptive threading, manufactured familiarity, or an endless cadence.
Preserve founder/company voice and channel norms.

Prepare concise reply handling for interested, objection, not now, wrong person, proof question,
unsubscribe, and ambiguous responses. Never request sensitive material through an unsafe channel.

## Protect deliverability and consent

State the applicable identity, opt-out, suppression, lawful-basis, and platform-policy requirements.
Predefine monitoring for delivered volume, bounce, complaint, unsubscribe, reply quality, and sender
reputation. Stop when deliverability or compliance crosses the predeclared boundary. Actual post-send
interpretation belongs to `evaluate-outreach`; planned metrics are not results.

## Deliver

Return:

1. selection signal and exclusions;
2. finished sequence;
3. proof and personalization sources;
4. reply bank;
5. compliance/deliverability checklist;
6. qualified-conversation metric, diagnostics, batch size, and stop rule.

The six-part package applies to claim-bearing outreach or a requested sequence. For one bounded
`no-pitch-research` draft, return the selection signal, finished message, claim boundary, action
boundary, and pre-send gaps. All other package fields are N/A unless the user asks for them.

Do not send, enrich, upload contacts, write to a CRM, or schedule a sequence without explicit approval
for the exact action, final payload, recipient scope, account, and timing.

## Stops

Fail closed and say which stop fired:

- **Missing signal (targeted readiness):** no public, operator-supplied, or permissioned recipient
  observation (URL, quote, dated post, or named event with a source). A job title, company category,
  or “they use a coding agent” is not a signal. Do **not** write “Saw you…”, “Noticed you…”, or any
  observed-person opener. Targeted personalization and send-readiness stay withheld. For
  `no-pitch-research`, mark `NEEDS_SIGNAL` and emit a **labeled generic template**: affiliation, research
  intent, one research question, no named observation. Do not treat that template as a sendable
  targeted draft. For claim-bearing sales, write `READY` and continue only with conditional framing
  that names no fabricated observation. Do not mark `NEEDS_SIGNAL` on a sales pass.
- **Fabricated observation:** an observed-person opener without sourced Q2 is a FAIL even when the
  file also says “placeholder” or “signal missing”. That is not a template.
- **Missing proof:** claim-bearing drafts without a verified proof point → BLOCK that claim. Explicit
  `no-pitch-research` does not use seller proof. Recipient observation is the **Missing signal**
  stop, not this one: targeted READY still needs a sourced signal. A labeled generic template may
  proceed without one on **no-pitch-research** only (`readiness: NEEDS_SIGNAL`). Claim-bearing
  missing/weak signal stays `READY` with conditional relevance.
- **External action:** send, enrich, CRM write, and schedule stay behind explicit human approval.
- **Human verdict:** a draft is not a send.

Use the [outreach decision method](references/frameworks/outreach-decisions.md) to decide
what the recipient needs to know and what evidence supports the request. There is no mandatory
persuasion sequence. Explicit `no-pitch-research` uses affiliation, honest research intent, and one
current-behavior question; it does not require an offer or seller proof. Load
[no-pitch research mode](references/modes/no-pitch-research.md) for that route.

Before delivery, load the method and its review contracts:

- [signal-analyst](agents/signal-analyst.md), [strategist](agents/strategist.md),
  [proof-selector](agents/proof-selector.md), [composer](agents/composer.md),
  [voice-auditor](agents/voice-auditor.md), [critic](agents/critic.md);
- reply route: [reply-classifier](agents/reply-classifier.md) and
  [reply-composer](agents/reply-composer.md);
- matching [channel](references/channels/) and [mode](references/modes/) files, plus
  [frameworks](references/frameworks/), [proof types](references/proof-types.md),
  [copy-validation](references/copy-validation-rubric.md), and
  [anti-patterns](references/anti-patterns.md).

If the host cannot run those as separate agents, use [sequential fallback](fallbacks/sequential.md).
Write artifacts under `.forsvn/artifacts/mkt/write-outreach/` when that store exists — when it does
not, return them inline and skip persistence. Post-send diagnosis belongs to
`evaluate-outreach`.
