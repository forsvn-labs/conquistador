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

Use for founder, sales, partnership, or other direct outreach from creation through readout.

1. Use `position` only when the segment, costly moment, proof, or offer is unresolved.
2. Use `outreach` for the observed selection signal, finished sequence, reply handling,
   compliance, deliverability, and qualified-response plan.
3. Use `results` after a real send to compare delivery and reply meaning by segment and step.
4. Use `measure` only when outcomes must be synthesized across cohorts or campaigns.

Prospect from observed demand or relevance signals, not title lists. Keep the ask proportionate, proof
honest, opt-out clear, and sensitive material out of unsafe channels. Sending, enrichment, scheduling,
suppression, list, and CRM writes remain behind exact human authority.

When the seller has few or no paying customers and no repeatable channel, order contact routes by
existing trust: own network, then introductions through second-degree contacts
([intro-request mode](../commands/outreach/references/modes/intro-request.md)), then in-person rooms
such as small conferences and hosted groups, then communities where the pain is public, then cold
outbound to a sourced list. Label the route of each recipient group in the package; the route sets
what the sender can honestly claim (shared context, an introduction, or no prior relationship).
For many accounts, channels, or senders, tier accounts and assign channel roles with the
[account program](../commands/outreach/references/frameworks/account-program.md).

Bring an automated or agent-run system up in order: research and review queue with sending off,
then monitoring, then sending in test mode, then a live pilot. Before go-live, test reply, bounce,
unsubscribe, duplicate, stale-signal, and provider-failure cases. Pilot one narrow segment in a
small batch. Judge the pilot by how often the reviewer agrees with the system's choice of account,
buyer, timing, evidence, and action, not by message count. Raise autonomy or volume only after that
agreement holds, and never raise both in the same step.

Run `audit` on the finished package before the Review Packet.

End with one terminal Review Packet for final human review: signal and segment, ready sequence or
actual readout, compliance boundary, next-batch rule, and one next action.
