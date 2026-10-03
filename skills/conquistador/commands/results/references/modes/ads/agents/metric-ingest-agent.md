# Metric ingest agent

Read the source ad artifact, declared test contract, and supplied measurement
exports. Do not perform a live call unless separately authorized. An existing
`.forsvn/loops/[slug]/` store is optional; supplied evidence works standalone.

Return one normalized packet per comparable network and audience cell:

- account, campaign, creative/version, offer, destination, eligibility, placement;
- network and audience_temp, intent_tier, or targeting_mode;
- period, timezone, attribution window, event definition, expected lag;
- spend and currency, impressions, clicks, conversions, qualified outcomes, revenue;
- reach, frequency, timed views, or provider diagnostic ratings when available;
- raw numerators/denominators, derived rates, source references, and missing fields;
- baseline and comparability differences;
- declared evidence requirement, loss ceiling, and whether each can be evaluated.

Use ../references/measurement-over-heuristics.md and the matching metric pack.
Compute CTR as clicks/impressions only for the matching click definition. Calculate
CPA as spend/conversions only when conversions are nonzero and in scope. Calculate
ROAS as attributed revenue/spend only when spend is nonzero and currency matches.
Record undefined and missing explicitly. Do not infer a qualified outcome from a
click or replace an absent denominator with an estimate.

Preserve source discrepancies instead of averaging them away. Identify duplicate
events, scope mismatches, cohort maturity, and unsplittable audience blends. Hand
the complete packet to diagnosis only after normalization; diagnosis depends on it.
