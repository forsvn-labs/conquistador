---
title: Pricing Review Rubric
lifecycle: canonical
status: stable
produced_by: pricing
load_class: RUBRIC
---

# Pricing review rubric

Score the finished pricing deliverable before handing it to a human. Every dimension is pass, weak,
or fail; a fail on any load-bearing dimension blocks delivery until fixed or explicitly disclosed.

## Dimensions

| # | Dimension | Pass | Fail (blocking) |
|---|---|---|---|
| 1 | Value metric | scored against the five tests with a named weakest test and overturning evidence | metric asserted with no alternatives considered |
| 2 | Fences | every exclusion has a one-sentence reason a rejected buyer would accept | any fence exists only to upsell or has no stated reason |
| 3 | WTP evidence | each corridor bound carries evidence class, date, sample | any bound presented without evidence class; interview numbers used as bounds alone |
| 4 | Unit economics | per-tier pass/fail at lower-bound price, payback stated | economics missing or computed above the lower bound only |
| 5 | Reversibility | smallest distinguishing test plus keep/revise/stop rule written first | irreversible change recommended as first move with no cohort separation |
| 6 | Boundary customers | fence lines walked for both-side resentment and workarounds | no boundary-customer cases examined |
| 7 | Migration | grandfathering, downgrade, billing, communication implications addressed | migration treated as "customers will figure it out" |
| 8 | Honesty | observed/inferred/assumed/unknown labels present on claims | estimates dressed as observations anywhere in the deliverable |

## Load-bearing dimensions

Dimensions 3, 4, and 5 are load-bearing. A deliverable failing any of them returns to method rather
than shipping with caveats: unsupported corridors, uneconomic prices, and irreversible moves are the
three failures this skill exists to prevent.

## Verdicts

- **ready for human decision** — all dimensions pass; unknowns labeled;
- **ready with material cautions** — non-load-bearing weaknesses disclosed inline;
- **not ready** — any blocking failure; return to the failed step with the gap named.

The rubric never issues approval. A human decides whether the offer ships.

## Machine-readable gate

`conquistador_score` checks a self-score against these rules. Use the single `default` variant.
`pass` means ready for human decision; `pass_with_concerns` means ready with material cautions.
Whether a weak load-bearing dimension (3, 4, or 5) can ship with cautions is not stated, so the gate
leaves it to the reviewer.

```json conquistador-gate
{
  "scale": { "levels": ["fail", "weak", "pass"] },
  "dimensions": ["Value metric", "Fences", "WTP evidence", "Unit economics", "Reversibility", "Boundary customers", "Migration", "Honesty"],
  "variants": {
    "default": { "minEach": "weak", "concernsBelowEach": "pass" }
  }
}
```
