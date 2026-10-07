# Rubric — `measure` (5 dimensions, 0–10 each)

Pass = total **≥35/50** AND **no dimension scores 0**. The critic applies this every cycle and runs the Discrimination Test before passing.

## 1. Attribution (the core)
Each notable result is tied to a **named tested choice and observable outcome** + the number that supports the link, with a confidence class (causal / correlational / coincidence-candidate).
- **0–4:** "the launch went well" — no tactic named, no number.
- **5–7:** some attribution, but mixes confidence levels or leans on one tactic for everything.
- **8–10:** every notable result has source, denominator/window, competing explanations and a justified confidence label; unknown causes remain unknown.

## 2. Falsifiability
Every claim carries its supporting number; anything without a number is labelled a hypothesis.
- **0–4:** unfalsifiable narrative.
- **8–10:** numbers throughout; hypotheses explicitly marked; targets-vs-actuals shown.

## 3. Honesty (anti-sycophancy)
Failures are named as plainly as wins. A missed target is a failure even if the absolute number looks good. At least one "did not work / unknown" is present unless the launch genuinely had none (rare — pressure-test it).
- **0–4:** only wins; softening language; no failures.
- **8–10:** balanced; skipped §5 steps / hit §4 anti-patterns named; their costs remain unknown unless measured.

## 4. Actionability
Concrete keep/drop/test the next launch can execute. Test items are phrased as next-launch hypotheses.
- **0–4:** "keep going" / generic.
- **8–10:** specific, channel-tied, executable.

## 5. Write-back fidelity
The proposed pack changelog entry is dated, accurate and append-only; it separates observations from unrun tests. Any authorized performance row matches the schema.
- **0–4:** overwrites a tactic, or an undated/wrong entry.
- **8–10:** dated, accurate, append-only; performance row correct; no external write is required to earn this score.

## Discrimination test
1. Could this read have been written *without* the numbers? If yes → cap dimensions 1–2 at 4.
2. Does it name anything that did NOT work? If no → pressure-test dimension 3 before passing; assume sycophancy until disproven.

## Machine-readable gate

`conquistador_score` checks a self-score against these rules. Use the single `default` variant.
Apply the Discrimination Test caps before you score; they are judgment and stay outside the gate.

```json conquistador-gate
{
  "scale": { "min": 0, "max": 10 },
  "dimensions": ["Attribution", "Falsifiability", "Honesty", "Actionability", "Write-back fidelity"],
  "variants": {
    "default": { "minEach": 1, "minTotal": 35 }
  }
}
```
