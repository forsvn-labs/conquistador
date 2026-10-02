# Measurement walkthrough

Synthetic readout exercise using invented rows. No live launch, analytics import, verification,
pack update or external action occurred. These rows must not enter a real performance store.

## 1. Inputs and normalized results

Fictional Product Hunt demo test: explain rejected-row recovery. Predeclared decision in this
exercise: revise the explanation if fewer than 10 qualified demo requests occur among 200 tagged
visits during the same seven-day window. This is an invented local decision rule, not a benchmark.

| Measure | Synthetic value | Definition | Limitation |
|---|---|---|---|
| Tagged demo visits | 200 | Visits carrying the test identifier during the window | Repeat visitors not deduplicated |
| Qualified demo requests | 8 | Requests meeting the fictional eligibility rule | No comparison group |
| Request rate | 4% | 8 / 200 in the same window | Visit rate, not unique-person conversion |

Gaps: audience assignment, independent-person denominator and a comparable control are absent.
Rank, votes and comment totals are not supplied. Missing is n/a, not zero.

## 2. Diagnosis

The count misses the exercise's target. Revise is supported by that bounded decision rule; the
cause remains unknown. The gallery explanation, audience mix and request form are competing
explanations. The pack's §3 helps define the measures and §5 the next test; it does not attribute
results to platform timing or distribution.

Attribution table: 8 requests; tested gallery explanation; synthetic source table; 200 visits over
seven days; confidence coincidence-candidate for any claim that the explanation caused requests.

What worked: the synthetic tracking rows permit a visit-based rate. What failed: the target was
missed. Unknown: whether explanation quality, audience or the request form caused the miss.

Hypothesis verdict: "this window meets the 10-request rule" is refuted in the exercise.
"This explanation increases requests" is inconclusive without a comparable counterfactual.

## 3. Keep / Drop / Test and proposed write-back

Keep the event definitions. Drop unsupported causal claims. Test one explanation change with
the same offer and request path. Before activation, assign the owner, comparison, independent
unit, window, evidence requirement and stop rule. Timing follows staffing capacity.

`## Pack Write-Back`: no append. Proposed teaching note only: synthetic exercise demonstrates
how a missed target can support revision without identifying a cause. No tactic is confirmed,
no verification metadata changes and no real observation is recorded.

## 4. Legibility and critic

`## Legibility` appears after Pack Write-Back and before Critic Verdict. State Packed; pack
producthunt; method_updated from the loaded file; last_verified null; verifier none; status draft.
Applied methods: observable measures §3 and bounded explanation test §5. State all source gaps.
There is no Why this works block for measurement.

Critic checks all five dimensions and verifies the distinction between the missed target and an
unknown cause. A read that credits the gallery from these counts alone fails attribution honesty.
The exercise's verdict is done_with_concerns because essential comparison evidence is absent.

## 5. Artifact and handoff

```yaml
skill: measure-growth
version: 1
date: 2026-09-15
stack: marketing
type: evaluation
id: measure-producthunt-synthetic-demo
review_surface: md
status: done_with_concerns
channel: producthunt
pack_verified: none
applied_tactics: [observable-request-rate, bounded-explanation-test]
keywords: [measure, producthunt, synthetic, loop]
```

Body order: Results, What Worked, What Failed, Keep / Drop / Test, Hypothesis Verdicts,
Pack Write-Back, Legibility, Critic Verdict. The legacy pack_verified field is none for a loaded
draft; use the explicit Packed state to distinguish it from Absent. Hand the proposed test and
pending owner decision back to the launch planner. No feedback agent execution or append occurred.
