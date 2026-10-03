# Sequential paid evaluation

Use the same dependencies when independent agents are unavailable. Do not claim
parallel or independent review. A supplied evidence packet works without a loop.

1. Resolve source hypothesis, one network/audience cell, primary outcome, period,
   attribution setup, loss ceiling, and evidence requirement. If actual evidence
   is absent, return a measurement plan with blocked evaluation.
2. Run agents/metric-ingest-agent.md. Preserve missing values, denominators, source
   discrepancies, and baseline differences. Split audience scopes before comparison.
3. After ingest completes, run agents/diagnosis-agent.md. Attach competing
   explanations and confidence limits to each material interpretation.
4. Run agents/recommendation-agent.md. State a precise action, reversal evidence,
   and one bounded next test. A pause at the loss limit need not prove failure.
5. Run agents/critic-agent.md with references/rubric.md and the evaluation-loop
   rubric. Revise affected analysis at most twice; unresolved failures remain
   blocked. Do not change measurements to satisfy review.
6. Follow references/format-conventions.md: write the evaluation first, validate
   and append its eight-column results.tsv row once, then promote only a reviewed
   scoped learning. Return equivalent sections inline if no store exists.

Record generation provenance with actual input_artifacts and output_eval. Do not
list nonexistent files as inputs. A critic override requires a visible operator
note; it cannot cure missing data or grant spend authority. Route new creative to
`ads` with the exact hypothesis and controls. Do not launch,
publish, alter budgets, or modify accounts as part of evaluation.
