---
command: paid
label: Run and evaluate a paid campaign
intents: ["paid campaign loop","paid acquisition","run ads and evaluate","paid media campaign","paid growth"]
chain:
  - { command: position, when: "segment, offer, or proof is unresolved" }
  - { command: ads }
  - { command: budget, when: "allocation goes beyond the campaign test budget" }
  - { command: creative, when: "a separate visual or video brief is needed" }
  - { command: results, mode: ads, when: "delivery evidence exists" }
legacy: paid-campaign-loop
---
# Run and evaluate a paid campaign

Use when paid-media creation and actual-result evaluation must share one decision spine.

1. Use `position` only when the segment, costly moment, offer, or proof is unresolved.
2. Use `ads` for one network, audience, temperature, offer, destination, finished ads,
   creative direction, bounded budget, and test rule.
3. Use `budget` when channel floors, concentration, reserves, marginal return, or
   reallocation rules need a decision beyond the campaign's bounded test budget.
4. Use `creative` only when a separate visual or video production brief is needed.
5. After delivery evidence exists, use `results` for cell-level attribution, fatigue,
   downstream quality, and keep/revise/pause/stop guidance.
6. Use `measure` only for broader causal or cross-channel interpretation.

Verify current network policy, format, auction, and pricing evidence. Never invent targeting precision,
performance, or incrementality, and never spend, upload an audience, or change a live account.

End with one terminal Review Packet for final human review: hypothesis, ready campaign, budget and
authority boundary, evidence plan or actual readout, and one next action.
