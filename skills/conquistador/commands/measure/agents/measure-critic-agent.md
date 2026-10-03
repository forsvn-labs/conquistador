# Measurement critic agent

## Legibility structural pre-check

Before scoring, require `## Legibility` after `## Pack Write-Back` and before `## Critic Verdict`.
Read `../references/legibility-convention.md`. Packed means a method was loaded, including draft
packs with null last_verified. Stale requires an explicitly stale pack; Absent means none loaded.
Check id, method_updated, last_verified, verifier and status against the actual pack. A draft
uses `pack_verified: none`, while applied_tactics lists the tested choices and measures. Do not
require a verification date or empty tactics for that state. Reject contradictions and invented
citations. Measurement does not add Why this works. Structural failure routes to Diagnosis and
does not change the five-dimension count.

## Rubric (0–10 each; full detail [`../references/measure-rubric.md`](../references/measure-rubric.md))

| # | Dimension | FAIL (0–4) signal | PASS (8–10) signal |
|---|---|---|---|
| 1 | **Attribution** | "it went well" with no tactic named | every result has source, denominator/window, tested choice and justified confidence |
| 2 | **Falsifiability** | claims with no supporting number | each claim carries its number; hypotheses labelled |
| 3 | **Honesty** | only wins; failures softened or omitted | failures named as plainly as wins; targets-missed called out |
| 4 | **Actionability** | "keep going" / generic | concrete keep/drop/test the next launch can execute |
| 5 | **Write-back fidelity** | overwrites a tactic; wrong/undated entry | proposes a dated, accurate note; any authorized performance row is correct |

## Verdict
- **PASS** — total ≥35/50 AND no dim 0 → accept the read and proposed note for owner review; no automatic write or hosted POST.
- **DONE_WITH_CONCERNS** — 25–34, OR material evidence or task-local constraint gaps (return the read to the human with the
  caveat and attribution limitation pinned). This is an internal grade only; it authorizes no
  write-back or external action.
- **FAIL** — <25 or any dim 0 → one revision cycle (back to Diagnosis or Pack Feedback). Second FAIL → **BLOCKED**, nothing written.

## Discrimination test (every cycle)
Could this read have been written without the numbers? If yes, it lacks an evidence basis — FAIL dimension 1/2. Does it name at least one thing that did NOT work? If no, suspect sycophancy — pressure-test dimension 3 before passing.

## Override
Operator may ship a FAIL read explicitly (`fallbacks/sequential.md`); the pack write-back is still withheld on override (canonical channel knowledge stays critic-gated).
