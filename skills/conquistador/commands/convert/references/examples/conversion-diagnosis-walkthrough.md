# Conversion diagnosis walkthrough

Synthetic teaching exercise. All metrics and changes below are invented; no searches, data
collection, customer behavior or experiment execution occurred. Use to inspect artifact handoffs.

## Inputs and Phase 1

Supplied scenario: weekly signups are 200 instead of 350, down 150/week or 42.9% relative to
350. The scenario places a homepage release and an ad-targeting change in the same window.
Metric definitions and comparable windows still need checking before real-world diagnosis.

The mapper creates candidate records for measurement failure, audience composition, within-
segment behavior and outside demand. The Logic Tree heading can contain a table:

| Id | Candidate | Prediction | Dependency/unknown |
|---|---|---|---|
| H1 | Client completion recording failed | Independent accepted registrations exceed recorded client events | Both sources may share instrumentation |
| H2 | Audience composition changed | Segment shares shift while within-segment rates may remain stable | Targeting and external demand can both alter shares |
| H3 | Page change affected behavior | Comparable exposed users behave differently from unexposed users | Assignment and exposure data absent |

Coverage and Dependencies states that these candidates are not exhaustive or independent.
A recording error can distort the apparent segment rates. Targeting and page changes can interact.
No cause is added just to fill a diagram.

External Factor Scan retains competitor, seasonal, platform, policy, technology and macro review
considerations. In this exercise no external sources were supplied. Relevant rows are Possible
with evidence unavailable and a proposed deciding source; none is Ruled Out or falsely searched.

## Phase 2: deciding evidence

For H1, compare aligned client events with independently recorded server acceptance by request id.
Proposed sources are the event export and server receipt export, owner Engineering; availability
pending. Confirming requires a new discrepancy under compatible definitions; rejecting requires
adequate coverage with no discrepancy; shared event collection leaves it inconclusive.

For H2, compare segment populations, exposure and completions before/after under fixed definitions.
Owner Marketing/data. Potential gap explained is unknown until counts exist. A changing paid
rate alone cannot separate mix, exposure and experience changes.

For H3, use comparable release-assigned populations and completion/error evidence. Owner Product/
data. The proposed mechanism is unresolved. Bounce rate alone cannot establish a clarity or trust
failure. Record missing assignment and confound checks as deciding data.

Keep Deciding data, Source, Owner, Confirming, Rejecting and Potential gap explained for each
record. Check order follows decision relevance and feasibility, not invented speed×impact scores.

## Phase 3: synthetic readout

Additional invented inputs: analytics and database both show 200/week; paid conversion is 1.2%
versus 3.5%; organic conversion is 4.1% in both periods; bounce rate is 52% versus 35%.

| # | Hypothesis | Verdict | Evidence | Gap |
|---|---|---|---|---|
| 1 | Recording failure | Inconclusive | Totals agree, but independence, definitions and event coverage not established | unknown |
| 2 | Audience composition | Inconclusive | Paid rate fell 2.3 percentage points; segment counts and fixed-mix comparison missing | unknown; not additive |
| 3 | Page effect | Inconclusive | Bounce rate rose 17 points; no comparable assignment or mechanism evidence | unknown; overlaps H2 |

Root Cause Statement: cause cannot be determined with these synthetic inputs. Unexplained causal
attribution covers the observed 150/week gap. This does not erase the measured arithmetic or
justify inventing 55%/35% causal shares. See logic-tree-examples.md for exact identity/interaction
and composition calculations when adequate counts are available.

## Critic and artifact handoff

Critic can PASS the honesty of this inconclusive record while status is done_with_concerns for
unresolved deciding data. It would FAIL a causal confirmation based on these rates alone.
Keep the three phase headers, Verdict Table columns, Root Cause Statement and Next Step.
Artifact uses improve-conversion-diagnosis id and the optional canonical local path from the
format contract. No result is written to an external system.

## Keep / Drop / Change / Test

Keep the supported metric observations and their definitions. Drop unsupported causal shares.
Change: a synthetic candidate error message is "Registration could not be completed. Your form
entries are still here. Review the highlighted field and try again." Use it only if the actual
product preserves fields and identifies the error; otherwise keep those claims pending.

Test: compare the current error message with that supported candidate for eligible form-error
sessions. Hold the underlying validation behavior constant. Primary outcome is successful server-
accepted completion per eligible error session; guardrail is duplicate accepted registrations.
Baseline, assignment, window and keep/revise/kill thresholds remain owner decisions before
activation. This is one proposed discriminating test, not a claim that the page caused the drop.

Next Step names the event/exposure data request and owner. Prioritization receives the same
uncertainty; deployment or activation is not authorized by the draft or critic result.
