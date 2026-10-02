---
command: lifecycle
label: Run a lifecycle campaign
intents: ["lifecycle campaign","onboarding sequence","onboarding flow emails","retention campaign","re engagement campaign","activation campaign","win back campaign","drip campaign"]
chain:
  - { command: campaign, for: "lifecycle job, entry event, branches, suppression, exit" }
  - { command: copy, for: "the smallest finished message set" }
  - { command: measure, for: "transition behavior" }
legacy: lifecycle-campaign
---
# Run a lifecycle campaign

Use for activation, onboarding, retention, re-engagement, or other behavior-triggered
communication.

1. Use `campaign` to define one lifecycle job, behavioral entry event, progress events, branches,
   suppression, exit, and primary behavioral signal.
2. Use `copy` for the smallest finished message set that advances the next missing condition.
   Load [copy lifecycle sequences](../commands/copy/references/lifecycle-sequences.md) for one-job-per-touch abandoned-cart,
   post-purchase, and win-back copy patterns. Read the lifecycle playbooks in
   [lifecycle/](lifecycle/) (flow architect, copy rules, measurement) for
   trigger, suppression, and activation design.
3. Use `measure` to evaluate transition behavior; opens are diagnostics, not the outcome.

Every message must be justified by current state. Do not fill a calendar, repeat a completed action,
or expose sensitive product data in notifications. Include consent, frequency, control group or
comparison where feasible, and recovery from stale or conflicting state.

End with one terminal Review Packet for final human review: event contract, finished messages,
suppression/exit rules, measurement and stop conditions, and one next action.
