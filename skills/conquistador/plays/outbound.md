---
command: outbound
label: Run an outbound sequence
intents: ["outbound campaign","outbound sequence","outreach sequence","cold outreach campaign","sales sequence","prospecting campaign"]
chain:
  - { command: position, when: "segment, proof, or offer is unresolved" }
  - { command: outreach }
  - { command: audit, for: "pre-ship review of the finished package" }
  - { command: results, mode: outreach, when: "a real send has happened" }
  - { command: measure, when: "outcomes span cohorts or campaigns" }
legacy: outreach-sequence
---
# Run an outbound sequence

Use for founder, sales, partnership, or other direct outreach from list to readout.

1. Use `position` only when the segment, costly moment, proof, or offer is unresolved.
2. Use `outreach` for the copy: it drafts from its
   [craft reference](../commands/outreach/references/frameworks/cold-email-frameworks.md), then
   checks signal, claims, reply handling, compliance, and stop rules.
3. Use `results` after a real send to compare delivery and reply meaning by segment and step.
4. Use `measure` only when outcomes must be synthesized across cohorts or campaigns.

## Work warm before cold

Order contact routes by existing trust: the sender's own network, then introductions
([intro-request mode](../commands/outreach/references/modes/intro-request.md)), then small rooms such
as hosted dinners and niche events, then communities where the problem is discussed, then cold
outbound to a sourced list. For a product with signups, first write to people who already acted:
trial users who stalled before setup, people who engaged with the sender's posts, and consented
visitors to pricing pages. Mention the action only when the reader would expect the sender to know
it. Label the route of each recipient group; the route sets what the copy may claim (shared
context, an introduction, or no prior relationship).

## Build the list from signals

1. Define the segment and the signal that makes an account worth a message now: a hire, a launch,
   an expansion, a public post, or a product action.
2. Pull accounts from sources where people are listed for that work. Remove current customers, open
   deals, competitors, past contacts in this campaign, and suppressed contacts.
3. Enrich only the fields the copy uses: the buyer's name and role, a verified address, and one
   signal with its source and date. Every enrichment run is an approved operator action.
4. Draft one template per structure, with the signal line as a merge field fed by the sourced
   column. Rows without a source get the no-signal version.
5. Load the draft campaign into the sending tool with sending off, for human review.

For many accounts, channels, or senders, tier accounts and assign channel roles with the
[account program](../commands/outreach/references/frameworks/account-program.md).

## Start small and test

Set up sending domains and inboxes before the first batch, following the
[email channel](../commands/outreach/references/channels/email.md) basics. Start with two or three
touches. Add touches only after the first ones earn replies. Test one variable at a time: the
angle, the offer, the proof, or the ask. Judge by positive replies and booked conversations, not
opens.

## Bring automation up in stages

Bring an automated or agent-run system up in order: research and review queue with sending off,
then monitoring, then sending in test mode, then a live pilot. Before go-live, test reply, bounce,
unsubscribe, duplicate, stale-signal, and provider-failure cases. Pilot one narrow segment in a
small batch. Judge the pilot by how often the reviewer agrees with the system's choice of account,
buyer, timing, evidence, and action, not by message count. Raise autonomy or volume only after that
agreement holds, and never raise both in the same step.

## Authority and review

Keep the ask proportionate, proof honest, opt-out clear, and sensitive material out of unsafe
channels. Sending, enrichment, list upload, CRM writes, scheduling, and suppression changes remain
behind exact human approval for the action, payload, recipients, account, and timing.

Run `audit` on the finished package before the Review Packet. End with one terminal Review Packet
for final human review: signal and segment, ready sequence or actual readout, compliance boundary,
next-batch rule, and one next action.
