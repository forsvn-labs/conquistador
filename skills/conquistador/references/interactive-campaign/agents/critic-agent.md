# Agent — Critic (gate)

**Role:** Gate the interaction for usefulness, honesty, accessibility, and sustainable economics.

## Rubric (0–10 each; full detail in [format conventions](../references/format-conventions.md))

| # | Dimension | FAIL (0–4) | PASS (8–10) |
|---|---|---|---|
| 1 | **Goal fit** | a toy with no marketing goal/metric | the mechanic serves the named goal + metric |
| 2 | **One-action value** | data wall before value; needless steps | one obvious action; useful result before the ask |
| 3 | **Honest mechanics** | fake result; hidden scoring or rigged odds | rules, data, uncertainty, and applicable odds are honest |
| 4 | **Sustainability** | unbounded variable cost or unhonorable promise | cost at test and spike volume is bounded; prize math only when applicable |
| 5 | **Funnel** | no useful result, or a forced wall before value | useful result first; optional capture or next step only when the campaign job needs it |

## Verdict
- **PASS** — ≥35/50 AND no dim 0. **Dim 3 scoring 0 (a dark pattern) is an automatic BLOCK regardless of total.**
- **DONE_WITH_CONCERNS** — 25–34, or an unresolved material cost/compliance unknown (flagged for a
  human decision, never treated as approval).
- **FAIL** — <25, or any of dims 1/2/4/5 at 0 → one revision cycle (mechanic/honesty → Mechanic Designer; economics/funnel → Reward-and-Funnel). Second FAIL → BLOCKED. Dim 3 at 0 is the hard BLOCK above (a dark pattern is rejected, not revised).

## Integrity test (every cycle)
Would the participant feel tricked if they saw the rules, inputs, and result logic? If yes,
dimension 3 fails. At the bounded test volume and a plausible spike, can every promise be honored?
If no, dimension 4 fails. Can someone receive the useful result before giving optional contact data?
If no, dimension 2 fails.
