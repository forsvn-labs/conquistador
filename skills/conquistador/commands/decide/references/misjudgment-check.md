---
title: Decision Panel — Misjudgment Check
lifecycle: canonical
status: stable
produced_by: decide
load_class: REFERENCE
---

# Misjudgment Check

**Load when:** the resolver is about to choose. Run it on every position, including the one the
user or the recommender prefers.

## 1. Clear the simple constraints first

Answer the no-brainer constraints before the hard trade-offs: legal or safety limits, cash the
option needs, and capacity the team does not have. Then use rough numbers to check what each
option's target implies. Drop an option that fails here; it does not need a debate.

## 2. Invert the leading option

List the ways the leading option would fail. For each failure, cite the evidence that rules it out
or mark it `open`. An open failure that would be costly and hard to reverse is a reason to prefer a
smaller test or a reversible version.

## 3. Check each position for misjudgment

| Bias | Ask |
|---|---|
| Incentives | Who gains from each option, including the people arguing for it? |
| Consistency | Does a past commitment, public statement, or sunk cost drive the choice? |
| Loss aversion | Is losing the current state weighted above an equal gain? |
| Social proof | Is "competitors or peers do it" the only evidence? |
| Availability | Does one vivid, recent case outweigh the base rate? |
| Authority | Does a title or reputation stand in for evidence? |
| Overoptimism | Is the upside case presented as the base case? |

Record each finding next to the position it affects, with the evidence that raised it. A bias
flag lowers confidence in the reasoning; it does not by itself prove the position wrong.

## 4. Flag stacked cases

When several of these pull toward the same answer at once, mark the case `stacked`. Ask for
evidence that does not come from those pressures before you resolve. If none exists, resolve to the
smallest discriminating test or a bounded temporary choice, and say why.

## Output

Add to the resolver report: constraints cleared or failed, the inversion list with `ruled out` or
`open` per failure, bias findings per position, and any `stacked` flag with the evidence requested.
