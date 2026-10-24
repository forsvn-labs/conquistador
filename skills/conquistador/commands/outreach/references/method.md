# Check outreach after drafting

Draft first from [the craft reference](frameworks/cold-email-frameworks.md). Then run this check on
the finished draft. The check decides whether each line is true and whether the recipient can
understand and decline the request. It does not predict reply rates. A review score is an editorial
aid, not an experiment result or authorization to contact anyone.

## Record intent and evidence

Record the requested deliverable, recipient scope, channel, sender affiliation, intent, and next
action. Distinguish a commercial proposal from research. Research must not hide an offer, lead
qualification, or a plan to sell in the reply. If the user asked for one research message, return
one message.

Fill a small evidence sheet from the draft:

| Field | Record | Why it matters |
|---|---|---|
| Selection signal | Source, date, exact observation, access class (public, operator-supplied, permissioned) | Explains selection without invented familiarity |
| Interpretation | What the observation might imply; other explanations | Keeps a guess out of the factual opener |
| Sender capability | What can be delivered now and by whom | Bounds the offer |
| Supporting evidence | Source, population, period, permission, limits | Bounds each result or comparison |
| Recipient decision | One answer or action that advances the intent | Prevents competing requests |
| Exclusions | Opt-outs, current customers, unsuitable recipients, sensitive evidence | Decides who must not receive the draft |

A source about a team does not prove an individual's problem. A past result does not promise a
future result. Public availability does not make sensitive details fit to repeat. Never invent a
trigger, private deal, shared connection, customer result, or familiarity.

## Confirm the route

**Sourced recipient signal:** the observation matches its source; the link to the offer is a
question or a supported inference. If the link is weak, remove it.

**Commercial message without a signal:** `readiness: READY` means the draft can be reviewed. The
situation is stated conditionally; the recipient is never said to have it. Only supported claims
about the sender remain. If no useful offer can be described honestly, return `blocked` with the
missing input.

**Research without a signal:** `readiness: NEEDS_SIGNAL`. A labeled generic template with
affiliation, explicit research intent, one open question about current behavior, and freedom to
ignore it. No observed-person opener, including inside a bracketed placeholder. With a sourced
signal, research may be targeted `READY`; it needs no seller proof because it claims no result.

**Reply:** answer the actual inbound and honor any prior promise before proposing anything. An
opt-out ends the commercial conversation. An ambiguous reply permits one clarifying question, not
invented interest. See [reply classification](../agents/reply-classifier.md).

## Review in separate passes

1. Signal analyst checks each observation against its source.
2. Strategist confirms the recipient decision and the exclusions.
3. Proof selector marks every claim supported, narrowed, or removed.
4. Voice auditor checks craft and readability and confirms that edits did not change factual scope.
5. Critic applies [the shared rubric](copy-validation-rubric.md) to the actual draft, citing lines.

One agent can run these passes in order. Reply classification and reply composition replace the
first draft on the reply route. Use at most two revision cycles; unresolved failures remain
failures. An exhausted cycle budget never turns a failed draft into a pass.

Repair a failed line by narrowing or deleting it. Do not compensate with flattery, pressure, or a
longer sequence. Then read the repaired draft against the craft: the fix must not make it longer,
vaguer, or sender-first. Before delivery, compare the final draft with the evidence sheet: each name,
amount, date, link, promise, and qualification. An unsupported claim from an earlier draft is
removed, not kept as a protected token. No false urgency, deceptive threading, manufactured
familiarity, or endless cadence. Never ask for sensitive material through an unsafe channel.

## Deliver and keep authority separate

Use [format conventions](format-conventions.md). Include unresolved evidence and action gaps. For a
sequence, include suppression, owner-set batch and stop rules, and a proposed definition of a
qualified conversation. Leave results empty until observed. Do not present a legal compliance
determination; name what the operator must verify for this channel and region.

In every sequence plan, define the stop rules as state changes. Each event causes exactly one:

| Event | State change |
|---|---|
| Sequence starts | Mark that channel active for the contact |
| Any reply | Pause all channels for the contact before the reply is classified |
| Unsubscribe or opt-out | Suppress the contact on every channel |
| Duplicate event | Ignore it |
| Provider keeps failing | Create a task for the owner; leave the state unchanged |
| Two tools disagree on the contact's state | Stop that contact until a person resolves it |

Classification never decides whether sending continues. Give each channel its own approval; an
edited message locks its channel until the new version is approved. After a prospect engages, draft
a suggested reply for a person to send. Never send a substantive sales reply automatically.

Drafting does not send, enrich contacts, upload lists, write CRM records, or schedule. Those require
separate approval for the exact action, final payload, recipient scope, account, and timing. A
changed payload or destination needs a new review. A critic score cannot supply that authority.
