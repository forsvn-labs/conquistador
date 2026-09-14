# Format the funnel model for handoff

Keep the artifact self-contained. Include skill, date, decision, target period, unit of analysis, and draft status. Preserve the user's language and identifiers only where authorized.

## Required content

Include the decision and target definition, assumptions with source and owner, base model with formulas, downside/base/upside sensitivity, capacity and cost constraints, decision-sensitive assumptions, evidence plan, and recommendation. Distinguish observed results from scenario outputs.

## Target table

Retain these column names for consumers that read an existing target table:

| Initiative | Metric | Baseline | Benchmark (Good) | Target | Variance vs. Benchmark | Justification | Owner |
|---|---|---|---|---|---|---|---|
| Actual initiative | Defined event and unit | Observed value and source, or unavailable | Optional comparable evidence, or unavailable | Desired value and period | Calculate only for comparable values | Mechanism and labeled assumptions | Responsible owner |

The historical column label `Benchmark (Good)` does not establish that a result is good or typical. Define the comparison and its limits in the cell or linked evidence record. A missing comparison is valid. Never populate it with an installed default or substitute it for the baseline.

Use separate rows or an attached assumptions table for scenario values. A missing baseline can support a planning exercise when the limitation is explicit; it cannot support an observed lift claim.

## Stage and evidence tables

For each stage, record entry, completion, population, numerator, denominator, period, and event source. Map each initiative to its affected event or delay. Explain any unmapped initiative.

For evidence, record source, date, metric definition, uncertainty, and permitted use. For sensitivity, record changed input, scenario output, capacity required, and decision effect. Preserve formulas and units so the next reader can reproduce the arithmetic.

## Recommendation

State the recommended alternative, reason, limits, next action, owner, and review trigger. Use an explicit no-go when the target requires impossible capacity or unjustified assumptions. A model verdict does not grant authority to execute the plan.
