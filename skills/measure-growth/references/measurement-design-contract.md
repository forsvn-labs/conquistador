# Measurement design contract

Use before observations exist. This is a planned decision system, not a performance readout.

## Required output

1. Decision, owner, and action date.
2. Primary signal with numerator, denominator, eligibility, and source of truth.
3. Diagnostic events and properties, with identity, deduplication, timestamp, consent, retention, and
   missingness rules.
4. Quality, cost, accessibility, privacy, and harm guardrails that apply to the initiative.
5. Baseline, minimum sample or observation floor, window, and keep/revise/stop thresholds. When these
   values are not supplied, label them `pending owner decision`; never invent them.
6. QA plan for event firing, property validity, duplicates, identity stitching, and failure paths.
7. Activation boundary: tracking changes, data collection, and experiment activation require explicit
   human approval.

Do not require result denominators, confidence intervals, attribution diagnosis, or a durable learning
record in design mode. Those become mandatory only after observations exist.
