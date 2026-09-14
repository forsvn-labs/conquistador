# Worked example — deterministic no-prize assessment

**Brief:** Put a short workflow assessment on an owned landing page. Help a visitor recognize how
they handle a job today, give a useful result without capture, and offer an optional product action.

## Concept

Ask five behavior questions with disclosed scoring. The result describes the current workflow and
returns a short checklist. It is not a diagnosis, ranking, customer claim, or promise of improvement.

## Mechanic

- One action: choose one answer per question or skip.
- Result logic: score only answered questions; require a declared minimum before assigning a profile.
- Meaningful success: enough answers produce a descriptive profile and actionable checklist.
- Meaningful failure: too few answers returns “Not enough information,” the neutral checklist, and
  retry or exit.
- Integrity: publish scoring and limitations; do not add a prize, chance, leaderboard, artificial
  scarcity, or referral unlock.

## Value and funnel

Landing-page exposure → start → questions → free result and checklist → optional next action. Keep the
result visible if the optional destination fails. `capture_mode: none`.

## Build and measurement

Cover idle, active, skipped, insufficient-answer, result, calculation error, destination error, retry,
and exit states. Provide keyboard operation, assistive labels, visible focus, and reduced-motion
parity. Measure exposure, start, valid completion, result comprehension, optional qualified action,
and error/exit guardrails. Define thresholds from the actual test context; do not import defaults.

## Authority boundary

The artifact may specify the mechanic and test. Implementation, analytics activation, publication,
or a later conversion gate needs the relevant owner and exact-action approval.
