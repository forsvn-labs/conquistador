# Outreach drafting method

This method helps a sender decide whether a message has a defensible reason to exist and whether
the recipient can understand and decline its request. It does not predict reply rates. A local
review score is an editorial aid, not an experiment result or authorization to contact someone.

## Start with the decision, not a sentence pattern

Record the requested deliverable, recipient scope, channel, sender affiliation, intent, and desired
next action. Distinguish a commercial proposal from research. Research must not conceal an offer,
lead qualification, or a plan to sell in the reply. If the user requests only one research message,
produce one message; do not manufacture a campaign package.

Build a small evidence sheet:

| Field | Record | Why it matters |
|---|---|---|
| Selection signal | Source, date, exact observation, access class | Explains selection without inventing familiarity |
| Interpretation | What the observation might imply; alternative explanations | Keeps a hypothesis out of the factual opener |
| Sender capability | What can be delivered now and by whom | Bounds the offer |
| Supporting evidence | Source, population, period, permission, limits | Bounds each result or comparison claim |
| Recipient decision | One answer or action that advances the stated intent | Prevents competing requests |
| Exclusions | Opt-outs, unsuitable recipients, sensitive evidence | Determines who must not receive the draft |

A source describing a team does not prove an individual's problem. A past result does not promise a
future result. Public availability does not make sensitive details appropriate to repeat. Use only
what is needed to explain the request, and keep private source material out of recipient-facing copy.

## Choose a usable route

**Sourced recipient signal:** state the relevant observation accurately, then make the connection
as a question or supported inference. If the connection is weak, remove it rather than decorate it.

**Commercial message without a signal:** the legacy `readiness: READY` label means the draft can be
reviewed. State a possible situation conditionally; never claim the recipient has that situation.
Make only supported claims about the sender. The label conveys no targeting verification or send
permission. If no useful offer can be described honestly, return `blocked` with the missing input.

**Research without a signal:** use `readiness: NEEDS_SIGNAL`. Return a labeled generic template with
affiliation, explicit research intent, one open question about current behavior, and freedom to
ignore it. Do not insert an observed-person opener, including inside a bracketed placeholder.
This is not a targeted sendable draft. With a sourced signal, research may be targeted `READY`;
no seller proof is required because no seller result is claimed.

**Reply:** read the actual inbound and prior promise. Answer the question or honor the decision
before proposing anything else. An opt-out ends the commercial conversation. An ambiguous reply
permits clarification, not invented interest. See [reply classification](../agents/reply-classifier.md).

## Compose from the evidence sheet

Decide what the recipient needs to know to answer. Usually this includes who is asking, why the
request reached them, what is being proposed, and what answering commits them to. Order those facts
for comprehension; there is no mandatory persuasion sequence or pronoun ratio.

Remove any sentence that adds neither needed context, bounded evidence, nor an answerable request.
Keep the sender's voice without assuming that formal language is dishonest or casual language is
trustworthy. Name a deliverable only if it exists or clearly state that it is proposed work. Do not
attach a fabricated audit, invent a video, or describe a resource as reserved for the recipient.

Use [message decisions](frameworks/outreach-decisions.md), the selected [mode](modes/), and
[channel](channels/) for the requested surface. A follow-up needs a new reason and authorized
cadence. Silence is not consent. A single no-pitch research draft defaults to no follow-up.

## Review in separate passes

1. Signal analyst records observation separately from interpretation.
2. Strategist selects the recipient decision and explains exclusions.
3. Proof selector marks every proposed claim supported, narrowed, or removed.
4. Composer writes the message and a short rationale.
5. Voice auditor checks readability and verifies that editing did not change factual scope.
6. Critic applies [the shared rubric](copy-validation-rubric.md) to the actual draft, citing lines.

One agent can perform these passes sequentially. Multiple agents are optional and never a reason
to expose extra private context. Reply classification and reply composition replace the first
composition pass on the reply route. Use at most two revision cycles; unresolved failures remain
failures. Exhausting the cycle budget must never convert a failed draft into a pass.

Before delivery compare the final draft with the evidence sheet. Check each name, amount, date,
link, promise, and qualification. Preserve meaning, not every word of an earlier draft. If an edit
changes the offer or claim scope, review it again. An unsupported claim in an earlier draft must
be removed, not preserved as a protected token.

## Deliver and keep authority separate

Use [format conventions](format-conventions.md). Include unresolved evidence and action gaps.
For a sequence, include suppression, owner-set batch and stop rules, and a proposed definition of
a qualified conversation. Leave results empty until observed. Do not invent platform limits or
legal compliance determinations; identify what the operator must verify for this channel and region.

In every sequence plan, define the stop rules as state changes. Each sending event causes exactly one:

| Event | State change |
|---|---|
| Sequence starts | Mark that channel active for the contact |
| Any reply | Pause all channels for the contact before the reply is classified |
| Unsubscribe or opt-out | Suppress the contact on every channel |
| Duplicate event | Ignore it |
| Provider keeps failing | Create a task for the owner; leave the state unchanged |
| Two tools disagree on the contact's state | Stop that contact until a person resolves it |

Classification never decides whether sending continues. Give each channel its own approval; an
edited message locks its channel until the new version is approved. After a prospect engages,
draft a suggested reply for a person to send. Never send a substantive sales reply automatically.

Drafting does not send, enrich contacts, upload lists, write CRM records, or schedule. Those require
separate approval for the exact action, final payload, recipient scope, account, and timing. A
changed payload or destination needs a new review. A critic score cannot supply that authority.
