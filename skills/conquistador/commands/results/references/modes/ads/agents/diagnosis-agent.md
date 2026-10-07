# Diagnosis agent

Wait for the normalized metric packet. Read the campaign hypothesis and
../references/measurement-over-heuristics.md, then the matching ad-intelligence
metric pack. Do not diagnose from a draft packet while ingest is still running.

For each material outcome change, return a table containing observation, evidence
reference, interpretation, competing explanation, confidence, and discriminating
next observation. Distinguish delivery, platform-attributed events, qualified
outcomes, and causal claims.

Inspect tracking, lag, eligibility, creative version, placement mix, offer changes,
auction conditions, budget changes, and downstream qualification. On Meta, compare
frequency, reach, CTR, cost per outcome, and available feedback on matched windows.
Frequency is an exposure measure; no default threshold proves creative fatigue.

Retain these fatigue fields when available: frequency_at_close, frequency_threshold
with its account-specific rationale or null, ctr_slope_over_window with dates,
negative_feedback_proxy, fatigue_observed as yes/no/borderline/unknown, and
recommended_refresh. A missing measurement cannot become a negative finding.
Use unknown or a tentative hypothesis unless evidence distinguishes fatigue from
other explanations. Do not infer a failed hook solely from falling aggregate CTR.

When return on ad spend moves, break it into its parts on the same windows:
cost per thousand impressions, click-through rate, conversion rate, and average
order value. Report which parts moved, and by how much, before you name a cause.
Check for tracking changes first. Then map each moved part to the class of
explanation to inspect: impression cost to audience, auction, or season; click
rate to creative or message; conversion rate to destination, offer, or tracking;
order value to offer or bundle. List competing explanations for each part. The
breakdown shows where to look; it does not select the fix.

Return audience-match signals with declared and measured scopes and discrepancies.
If a cell cannot be isolated, block its specific diagnosis. Recommend the smallest
additional observation or controlled component test; do not write new creative,
select a spend increase, or turn a historical association into causal lift.
