# Lifecycle-campaign workflow

Use privately for activation, onboarding, retention, re-engagement, or other behavior-triggered
communication.

1. Use `plan-campaign` to define one lifecycle job, behavioral entry event, progress events, branches,
   suppression, exit, and primary behavioral signal.
2. Use `write-copy` for the smallest finished message set that advances the next missing condition.
   Load `write-copy/references/lifecycle-sequences.md` for one-job-per-touch abandoned-cart,
   post-purchase, and win-back copy patterns. Load recovered lifecycle method under
   `conquistador/references/lifecycle-campaign/` (flow architect, copy rules, measurement) for
   trigger, suppression, and activation design.
3. Use `measure-growth` to evaluate transition behavior; opens are diagnostics, not the outcome.

Every message must be justified by current state. Do not fill a calendar, repeat a completed action,
or expose sensitive product data in notifications. Include consent, frequency, control group or
comparison where feasible, and recovery from stale or conflicting state.

End with one terminal Review Packet for final human review: event contract, finished messages,
suppression/exit rules, measurement and stop conditions, and one next action.
