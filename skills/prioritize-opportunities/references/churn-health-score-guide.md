# Customer risk assessment

Use this original method to decide whether available account signals can support a useful review queue. A score is optional. Start with the decision, loss definition, prediction window and available response capacity. Follow the [churn playbook](churn-playbook.md) for metric and cohort definitions.

## Select evidence for the task

Identify a signal's proposed relationship to the outcome and a credible alternative explanation. Record its source, observation time, missingness and permitted use. Do not assume a particular signal is predictive.

| Candidate observation | Question to investigate | Alternative to check |
|---|---|---|
| Change in product activity | Did the customer's important task become harder to complete? | Seasonality, automation or a changed workflow |
| Unresolved service issue | Does the issue prevent the agreed task? | A recorded complaint may already be resolved elsewhere |
| Payment status | Is a valid obligation unresolved? | Reporting lag, a canceled invoice or duplicate attempt |
| Renewal or downgrade request | What decision is the customer making? | A smaller plan may remain a good fit |
| Export or administrative activity | Is there a relevant support need? | Backup, compliance or migration preparation unrelated to cancellation |

Do not treat export as proof of churn intent or trigger contact automatically. A missing signal is not a low score. Avoid using a cancellation event itself to claim advance prediction.

## Establish an evaluation cohort

Define eligibility at the time the prediction would be made. Use only information available then. Keep later data out of features. Track outcomes for a complete observation window and identify censored accounts whose follow-up is incomplete.

Separate development data from a later evaluation period where feasible. Keep repeated observations from the same account from contaminating the comparison. Compare results by relevant cohort and billing cycle. A convenient balanced sample of lost and retained accounts cannot directly estimate real-world precision without accounting for sampling.

## Evaluate an interpretable rule first

A review rule can describe an unresolved payment state or a meaningful change from an account's established task pattern. Specify the rule before examining evaluation outcomes. If a weighted score is proposed, explain each input's scale, missing-value treatment and weight source. Do not install default weights or labels as measured facts.

Compare against a useful baseline such as existing operations or random selection at the same review capacity. The positive outcome prevalence is necessary context. A precision percentage alone cannot establish that a model is better or worse than random.

```text
Precision = true positives / all flagged accounts with complete outcomes
Recall = true positives / all actual positives with complete outcomes
False positive rate = false positives / all actual negatives with complete outcomes
```

State which outcome is positive and use the same population and window throughout. Return undefined when a denominator is zero. Report counts as well as rates, missingness and sampling limitations.

Illustrative arithmetic only: a review rule flags 12 accounts; 3 later meet the defined loss outcome. In a complete cohort with 5 actual losses and 45 non-losses, precision is 3/12, recall is 3/5 and false positive rate is 9/45. These are distinct denominators, not target levels or measured product results.

## Choose the review threshold

Compare the cost of an unnecessary review, missed actionable cases, response capacity and expected benefit. Test sensitivity to different thresholds and input assumptions. An accurate prediction can still be operationally useless if no helpful response exists.

Choose labels only after their action and evidence are defined. A score band does not authorize a message or offer. Keep a human-readable reason for each flag and allow an operator to mark a known benign explanation.

## Separate prediction from intervention

Observe whether the rule identifies the defined outcome. Separately evaluate whether the response helps the customer and improves the chosen business outcome against a valid comparison. A score rising after outreach does not prove the outreach prevented churn.

Before an authorized rollout, specify the response owner, permitted action, observation window, costs and stop conditions. Begin with an appropriately bounded review and preserve a no-action option. Do not assume automation outperforms an existing manual process.

Revisit the assessment when definitions, population, billing model or response capacity change, or when new evaluation evidence shows a material error. No fixed review calendar, sample quota, weight or precision gate establishes suitability for every account.

## Deliver

Return the outcome and cohort definition, candidate signals, evaluation design, actual counts or explicit unknowns, baseline comparison, proposed threshold rationale, response limits and next deciding observation. If the evidence is insufficient, defer scoring and explain what would make it useful.
