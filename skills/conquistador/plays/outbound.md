---
command: outbound
label: Run an outbound sequence
intents: ["outbound","outbound campaign","outreach sequence","cold outreach campaign","sales sequence","prospecting campaign"]
chain:
  - { command: position, when: "segment, proof, or offer is unresolved" }
  - { command: outreach }
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

End with one terminal Review Packet for final human review: signal and segment, ready sequence or
actual readout, compliance boundary, next-batch rule, and one next action.
