---
command: referral
label: Build a referral loop
intents: ["referral program","referral loop","invite loop","refer a friend","viral loop","referral"]
chain:
  - { command: measure, for: "retention gate before any incentive" }
  - { command: campaign, for: "loop, economics, first test" }
  - { command: copy, for: "invite and recovery messages" }
legacy: referral-loop
---
# Build a referral loop

Use when the user wants referral, invitation, or sharing-led growth.

1. Use `measure` to establish retained behavior before recommending an incentive.
2. Use `campaign` to define sender and recipient value, trigger, loop steps, K-factor/cycle-time
   model, economics, and a bounded first test.
3. Use `copy` for the invite, recipient expectation, disclosures, and recovery messages.

Read the referral playbooks in [referral/](referral/) (loop architect,
incentive economist, mechanic copy, K-factor rubric). Do not paraphrase them.

Refuse a rewarded loop when retention evidence is weak. Prefer product-native sharing utility before
cash or discount rewards. Cover self-referral, duplicate accounts, automation, privacy, rate limits,
reward timing, revocation, and support burden before scaling.

End with one terminal Review Packet for final human review: launch/no-launch decision, retention gate,
loop and economics, abuse controls, validation plan, and one next action.
