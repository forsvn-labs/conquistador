# Paid campaign artifact contract

Use an ISO date and a unique scope/date/slug filename. Preserve existing versions
when comparing revisions. Store three files under
`.forsvn/artifacts/mkt/create-paid-campaign/`, or return equivalent sections inline
when that store is unavailable.

| File | Contents |
|---|---|
| [slug].md | Finished hero, variant_a, variant_b; creative and destination requirements; review status |
| [slug].rationale.md | Product evidence, hypotheses, controls, allocation, observation and stop rules, attribution limits |
| [slug].critic-score.md | Per-variant rubric, format results, revisions, unresolved issues, optional polish comparison |

Use the existing frontmatter keys:

```yaml
skill: ads
version: 1
date: YYYY-MM-DD
status: done_with_concerns
network: meta
surface: meta-full-ad
audience_temp: cold
creative_format: dedicated
production_model: in-house
conversion_event: trial_start
critic_total: 0/210
critic_per_variant:
  hero: 0/70
  variant_a: 0/70
  variant_b: 0/70
```

Values above illustrate the schema, not a recommended setup or actual score.
status is done, done_with_concerns, blocked, or needs_context. network is meta,
google-ads, tiktok-ads, or linkedin-ads. Use intent_tier instead of audience_temp
for Google Ads, and targeting_mode for LinkedIn. Keep one scope per artifact.

Meta/TikTok audience_temp is cold or retargeting based on actual eligibility.
Google intent_tier is branded, non-branded, competitor, or generic. LinkedIn
targeting_mode is job-title, company-list, or matched-audience when verified.
These labels carry no assumed intent level, cost, or preferred budget.

creative_format is dedicated or repurposed-ugc; production_model is in-house,
affiliate-creator, or external-freelance. Record rights, cost, and capacity in the
rationale. No format has a preset spending ceiling. conversion_event records the
actual selected event such as trial_start, purchase, lead, install, or view-content;
include observability, lag, and downstream proxy limits.

Read rubric.md for the /70 per-variant and /210 aggregate scoring contract.
Scores assess the draft and never allocate spend automatically. Include claim_list
and protected_tokens with exact qualifiers, terms, and destination URLs.

The rationale follows why-this-works-convention.md: tie each bet to supplied
product or audience evidence and label assumptions. Unknown source material stays
unknown. Compare any optional polish per variant, retain the approved predecessor,
and surface changed claims or terms for review. Artifact completion, human
acceptance, and authorization of a live action are separate states.
