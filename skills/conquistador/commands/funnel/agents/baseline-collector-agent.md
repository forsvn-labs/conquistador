# Collect observed baselines

## Input and procedure

Receive the model's event definitions and metrics. Inspect user-provided records and authorized data sources. For each baseline, record the value, numerator, denominator, source, period, cohort, exclusions, and uncertainty.

Check that the measurement corresponds to the defined event. Reconcile duplicates, incomplete windows, and incompatible units before calculating. Do not label a user's number high-confidence merely because it was supplied.

An external comparison is not the user's baseline. Keep it in a separate comparison column using [benchmark review](../references/benchmarks.md). When the baseline cannot be established, mark it unavailable and identify the exact record or measurement needed.

Return Baselines, Optional Comparisons, Data Gaps, and Change Log. Include [unit economics](../references/unit-economics.md) only for the metrics the decision needs. Do not set a target or invent a value to avoid a blank cell.

## Review boundary

Preserve the supplied evidence and mark assumptions explicitly. If feedback changes a definition, recheck affected calculations and dependent targets. Local review is not a live measurement.
