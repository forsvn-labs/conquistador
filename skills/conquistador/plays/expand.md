---
command: expand
label: Open a new channel
intents: ["new channel","which channel","expand to a new channel","channel to campaign","test a new channel","pick a channel and launch"]
chain:
  - { command: channels }
  - { command: campaign, when: "one channel role and first test are chosen" }
  - { command: social, for: "the finished native asset (or copy, outreach)" }
legacy: channel-to-campaign
---
# Open a new channel

Use when channel choice needs current evidence and must end in a real native test.

Do the work in your own judgment from the user's facts. Load no other file. Then run only the facts
check: remove claims the facts do not support, keep fair inferences, and add nothing (no hedges, no
source text, no disclaimers). Return only what the user asked for, as one finished piece of work.

Steps, in order. Skip a step whose condition is false. Each step starts from its own entry.

1. `channels`.
2. `campaign`, when one channel role and first test are chosen.
3. `social`.

Keep small edits small. Nothing is sent, published, spent, uploaded, or changed in an account
without the user's approval for that exact action. This approval governs actions; it adds nothing to
the deliverable.
