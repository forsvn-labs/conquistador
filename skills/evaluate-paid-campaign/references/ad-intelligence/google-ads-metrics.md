---
type: ad-intelligence
surface: google-ads-metrics
schema_version: 1
status: method
verification: account-input-required
---

# Evaluate Google Ads search evidence

This is a campaign decision procedure. It supplies no performance benchmark or
claim of current platform verification. Record the source, date, placement, region,
and account scope of platform constraints before using them. If verification is
unavailable, deliver a draft with the affected setup decisions unresolved.

Compare by query or keyword scope, intent_tier, destination, and reporting period.
Retain match settings and search-term exclusions where supplied. Do not treat a
branded campaign as automatically worth keeping.

| Signal | Use and limit |
|---|---|
| Cost, conversions, qualified outcomes, revenue | Calculate CPA or ROAS with event lag and scope attached |
| CTR and conversion rate | Show clicks/impressions and conversions/eligible visits; separate query mix changes |
| Quality Score and component ratings | Inspect reported expected CTR, ad relevance, and landing-page experience; no score alone proves overpayment |
| Search Impression Share and lost IS by budget/rank | Identify reported delivery constraints; distinguish availability from profitable demand |
| Ad Strength | Inspect asset coverage; a rating does not establish lift or require an arbitrary asset quota |

For falling impression share, compare eligibility, query mix, budget, rank signals,
and reporting changes before proposing a cause. For clicks without qualified
outcomes, inspect query relevance, destination, tracking, and lag. More budget is
only a candidate test when marginal economics and authority support it.

Apply the agreed loss and evidence rules. There is no universal conversion-count
minimum for a verdict. If a decision would reverse under plausible late conversions
or small changes in observed counts, state that sensitivity and keep it provisional.

## Decision contract

Read ../measurement-over-heuristics.md before assigning confidence. Missing evidence
is missing, never zero. Keep observed results, attribution, and causal inference
separate. Recommendations cannot authorize live account changes.
