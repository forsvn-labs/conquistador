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

1. Use `channels` to compare owned performance, current public evidence, audience habitat,
   format, access, capacity, policy risk, and decision speed.
2. Use `campaign` only after one channel role, destination, and first test are chosen.
3. Use `social`, `copy`, `outreach`, or another directly relevant creation outcome
   for the finished native asset.

Load only the chosen channel note. State when not to use the channel, what evidence would reverse the
choice, and the date volatile rules or pricing were checked. Do not turn a benchmark into owned
performance or recommend a channel whose production cadence the operator cannot sustain.

End with one terminal Review Packet for final human review: channel decision, campaign spine, finished
asset, evidence/recheck boundary, and the exact next action.
