# Churn diagnosis and retention decisions

Use this original Conquistador method when a supplied diagnosis identifies a retention problem. Recommend the smallest useful observation or intervention that addresses the evidence. Keeping an unsuitable customer is not automatically a successful outcome.

## Establish the cohort and decision

Record the product, billing model, customer task, eligible population, observation window, cancellation definition and source. Separate customer churn, subscription churn and revenue loss. Note paused subscriptions, partial downgrades, account closures and payment failures that have not yet become churn. A target, an estimate and an observed baseline must be labeled separately.

Read the existing diagnosis and product context when available. Ask only for missing information that changes the recommendation. Unknown reasons or unavailable analytics remain unknown. The plan does not authorize messages, retries, billing changes or experiments.

## Classify events without losing overlap

Customer-requested cancellation and unresolved payment failure are useful operational categories. They are not an exhaustive model of why customers leave. A customer can request cancellation after payment failure, switch products after an outage or stop because the original task is complete.

Retain the event sequence and multiple reason tags. For a counting table, define one primary event assignment per eligible loss and preserve unresolved or mixed cases. Do not add overlapping reason counts as if they were distinct customers. Check whether payment collection changes or reporting delays explain some of the observed difference.

| Evidence to inspect | Decision it can inform | Limitation to retain |
|---|---|---|
| Stated exit reason and observed task history | Whether a relevant alternative or support response exists | A survey answer does not prove the effect of an offer |
| Unresolved support issue | Whether a concrete repair would address the task | An open ticket alone does not establish intent to leave |
| Billing and payment event sequence | Whether an eligible recovery path exists | A failed attempt is not necessarily a lost subscription |
| Plan, renewal and entitlement records | Which options and effective dates are available | Do not promise access or pricing absent from the actual terms |
| Usage in the customer's normal work cycle | Whether a change deserves investigation | Low login activity can coexist with successful API or seasonal use |

## Define the measurements

Use matched cohorts and explicit denominators. Example definitions to adapt to the account:

```text
Customer churn rate = eligible customers lost during window / eligible customers at window start
Observed offer acceptance = accepted offers / eligible offers actually presented
Recovery rate = unique failed invoices settled within window / eligible unique failed invoices
Flag precision = flagged customers who meet the defined loss outcome / flagged customers with complete follow-up
```

State how new accounts, pauses, reactivations, duplicate invoices and incomplete follow-up are handled. Count customers or invoices consistently. Revenue churn needs a revenue denominator and treatment of expansion; do not label net revenue retention as customer retention.

Offer acceptance is not retained value. Observe whether the customer remains appropriately served at the agreed review point, whether payment settles and what discounts, support work, refunds or complaints result. A payment can be recovered after both a retry and a message; do not credit its full value to each.

For a stable cohort under a hypothetical constant monthly churn probability `c`, retained share after `m` months is `(1 − c)^m`. This is a scenario assumption, not an annual forecast from one observed month. Real cohort changes and varying hazards require actual observations.

## Design a cancellation response

Make the requested cancellation accessible and confirm its effective date. Collect an optional reason only when it helps a real decision. A survey or save offer must not become a prerequisite for completing cancellation.

Offer a relevant alternative only when its terms, capacity and fit are established. A lower plan may address price, support may address a known issue, and a pause may fit a temporary need. Declining the offer leaves the cancellation available. Do not promise an unreleased feature, a recovery outcome or permanent data access.

Record offer eligibility, the reason it fits, full cost and terms, continuation choice and destination. Preview the actual path, including confirmation and export or reactivation information where available. A longer sequence is not a quality goal.

## Plan payment recovery

Use payment status, failure reason, provider capabilities, account terms and customer preferences to decide whether a retry, payment-update request or no action is appropriate. Verify those constraints during an authorized implementation task; no retry schedule is assumed here.

| Event condition | Proposed response | Check before execution |
|---|---|---|
| Failure may be recoverable through an eligible retry | Use the supported retry path | Actual failure classification, duplicate-attempt controls and provider constraints |
| Customer action is required | Explain the issue and provide the verified update route | Accurate status, usable secure destination and authorized contact |
| Payment settles or cancellation takes effect | Suppress obsolete recovery steps | Reconcile the event before the next action |
| Entitlement is due to change | Explain the actual consequence and effective date | Approved terms, notices and current account state |
| Status is ambiguous | Investigate or route to the responsible owner | Do not charge or claim failure from an unknown state |

Choose timing and contact limits from the actual event lifecycle, obligations and user impact. Record the owner and stop conditions. Do not manufacture urgency or claim that a standard cadence produces a particular recovery rate.

## Evaluate retention options as scenarios

For each option, state the candidate mechanism, strongest alternative, supporting evidence and unknowns. Compare against doing nothing or the current process. Define an observable outcome and a review window long enough to distinguish delayed loss from useful retention.

```text
Expected incremental contribution
  = eligible accounts × assumed incremental retained share × contribution per retained account
    − offer cost − delivery cost − other incremental costs
```

Keep all terms in the same period and currency. An assumed retained share is a scenario input, not a result. Use bounds or separate cases where inputs are uncertain. Avoid double-counting discounts already included in contribution per account.

Illustrative arithmetic only: 40 eligible accounts, assumed incremental retained share 0.10 and contribution 50 units per retained account imply 200 units before costs. If incremental costs are 120 units, the scenario yields 80 units. This does not predict the offer's actual effect.

Choose targets from the current comparable baseline, the minimum useful improvement, costs and downside. No industry table defines good churn for this account. Explain what evidence would change the option's rank. A risk score or apparent save does not establish an intervention's causal benefit.

## Handoff artifact

Prefer `.forsvn/artifacts/mkt/prioritize-opportunities/churn-prevention.md` when a durable artifact is requested. Preserve the following sections without filling unknown values to complete a template:

- Churn Diagnosis: cohort, definitions, sources, event assignment, reason tags and limitations.
- Hypotheses: candidate mechanism, alternatives, predictions and deciding data.
- Cancel Flow Design: accessible cancellation, optional response, terms and confirmation.
- Dunning Sequence: event conditions, eligible actions, timing rationale, owner and stop rules.
- Health Score Model: candidate signals, validation status and action limits, or a reason to defer scoring.
- Targets: observed baseline, scenario or proposed target, denominator, window and source.
- Priority Actions: evidence, incremental value range, cost, dependencies and proceed/park/stop recommendation.
- Next Step: one bounded observation or proposal, with owner and existing execution boundary.

Use [cancel and payment message drafts](churn-cancel-flow-templates.md) and the [risk assessment guide](churn-health-score-guide.md) only where needed. Pass supported scenarios to `funnel`. Do not ship interventions automatically from this plan.
