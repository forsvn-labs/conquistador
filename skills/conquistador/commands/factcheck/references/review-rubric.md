---
title: Knowledge Review Rubric
lifecycle: canonical
status: stable
produced_by: factcheck
load_class: RUBRIC
---

# Knowledge review rubric

Score the finished review before handing it to a human. Each dimension is pass, weak, or fail. A
fail on any dimension blocks delivery until fixed or explicitly disclosed as a review limitation.

## Dimensions

| # | Dimension | Pass | Fail (blocking) |
|---|---|---|---|
| 1 | Claim fidelity | claims stated exactly as used, compound claims split | review answers a claim nobody made |
| 2 | Source coverage | every load-bearing source assessed; uncited dependencies surfaced | a load-bearing source appears only in the conclusion |
| 3 | Authority & freshness | each source has authority class, date, staleness category | undated sources treated as current |
| 4 | Contradiction handling | matrix present, conflicts classified, repetition not double-counted | conflicts merged, averaged, or counted away |
| 5 | Resolution honesty | winner named with reasons losers lost; confidence labeled | resolution by counting, averaging, or tone |
| 6 | Verification honesty | independence claimed only when a separate context ran; otherwise labeled counter-read | single-context pass described as independent corroboration |
| 7 | Unknowns & recheck | surviving unknowns listed with date/event/condition triggers | unknowns silently dropped or left to age into facts |
| 8 | Non-fabrication | no invented sources, quotes, numbers, or padded agreement | any source or citation that cannot be produced on request |

## Required review obligations

These stable identifiers name the obligations checked by this rubric:

- `H-KNOW-SOURCE` — sources are not fabricated or padded (dimension 8);
- `H-KNOW-CONFLICT` — contradictions are surfaced, not averaged away (dimension 4);
- `H-KNOW-RECHECK` — a dated or event-based recheck trigger is set (dimension 7).

## Verdicts

- **sound for human decision** — all dimensions pass;
- **sound with limitations** — weaknesses disclosed inline next to the affected claim;
- **not sound** — any blocking failure; return to the failed step and name the gap.

The rubric grades review quality only. It never issues the human verdict on the underlying claim,
and never approves publication, action, or release.

## Machine-readable gate

`conquistador_score` checks a self-score against these rules. Use the single `default` variant.
`pass` means sound for human decision; `pass_with_concerns` means sound with limitations, which
holds only when each weakness is disclosed inline next to the affected claim. The gate cannot check
that disclosure.

```json conquistador-gate
{
  "scale": { "levels": ["fail", "weak", "pass"] },
  "dimensions": ["Claim fidelity", "Source coverage", "Authority & freshness", "Contradiction handling", "Resolution honesty", "Verification honesty", "Unknowns & recheck", "Non-fabrication"],
  "variants": {
    "default": { "minEach": "weak", "concernsBelowEach": "pass" }
  }
}
```
