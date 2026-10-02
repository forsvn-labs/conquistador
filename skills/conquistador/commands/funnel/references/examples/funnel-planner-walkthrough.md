# Funnel model example with synthetic records

This example is synthetic and demonstrates definitions and arithmetic only. It is not evidence of product performance or an approved business target.

## Brief

A trial product wants to understand whether trial accounts reach the task needed to evaluate a purchase. The initiative is to clarify the task setup instructions. Existing records distinguish account creation, task completion, and subscription acceptance.

## Model

The unit is one eligible account. Use a cohort created within the selected period and allow the stated observation window to finish before computing downstream completion. Exclude internal test accounts and document the exclusion rule.

| Stage | Completion event | Synthetic count | Denominator |
|---|---|---|---|
| Eligible trial | Account created and eligible | 100 | Cohort entry |
| Representative task | Task finished successfully | 40 | 100 eligible accounts |
| Paid acceptance | Subscription accepted | 8 | 40 task-complete accounts |

Under these synthetic definitions, task completion is 40/100 and paid acceptance among task-complete accounts is 8/40. These rates describe only the constructed cohort. They do not establish the effect of the proposed instructions.

## Initiative mapping

The setup instruction change targets completion of the representative task. Before setting a lift target, inspect whether failed setup is a material cause of noncompletion. Do not assume every inactive account had a setup problem.

## Review

Verify event definitions, pending observations, and joins. Confirm that paid accounts outside the task-complete path are handled explicitly rather than silently discarded. Record unavailable costs or business effects as unknown.

The output is a proposed measurement model. Running a trial, changing the product, or charging customers requires its own authority.
