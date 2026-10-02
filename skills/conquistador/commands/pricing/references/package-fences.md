---
title: Package Fences
lifecycle: canonical
status: stable
produced_by: pricing
load_class: METHOD
---

# Package fences

A fence is the rule that decides which tier a customer belongs in. Good fences separate customers by
the value they receive, not by their willingness to search for loopholes.

## Fence types

| Fence | Separates on | Strong when | Weak when |
|---|---|---|---|
| Capacity | volume of the value metric | usage tracks value | heavy users are also price-sensitive champions |
| Feature | capability gating | the feature maps to a distinct job | the gated feature is trivially worked around |
| Quality | limits, speed, support level | segments tolerate the limit | the limit causes data loss or distrust |
| Audience | role, team size, industry | segments have distinct willingness to pay and cost to serve | the line is easy to lie across |
| Term | commitment length | discount buys retention | discount becomes the list price |

Combine two or three fences per boundary. One fence alone is either too porous or too blunt.

## Design rules

1. **Every exclusion needs a reason.** Write why the lower tier excludes the capability, in one
   sentence a rejected buyer would accept.
2. **Fence the job, not the pain.** Gate on what makes the customer's job bigger, not on what makes
   their bill smaller.
3. **Check both sides of every fence.** For each boundary, name:
   - a customer just below the line who resents it;
   - a customer just above the line who feels overcharged;
   - the cheapest workaround across the line.
4. **Upgrade logic must be self-serve where possible.** The path from tier N to N+1 should be one
   decision, not a negotiation. Downgrade paths need equal design attention: punitive downgrades
   become churn at renewal.
5. **Expansion lives inside tiers.** Overage, add-ons, or metered growth keep heavy users inside
   their tier instead of forcing a fence collision.

## Boundary-customer checklist

For each fence line, walk these cases before shipping:

- light users priced out of value they genuinely need;
- heavy users whose bill grows faster than their outcomes;
- teams straddling a per-seat line (shared logins, churn-rejoin cycles);
- seasonal or bursty usage patterns;
- low-margin segments that clear the fence cheaply;
- procurement buyers negotiating the top tier against a competitor bundle;
- accounts sitting within 10% of a threshold at renewal.

Each case gets a predicted behavior and a guardrail. A case you cannot predict is a test-plan item,
not a footnote.

## Anti-patterns

- **Feature soup:** adding features to tiers to win individual deals until tiers stop describing
  anyone.
- **Punishment fences:** limits that exist only to upsell (export disabled, read-only viewers) —
  they convert advocates into detractors.
- **Invisible fences:** boundaries the buyer discovers from an invoice.
- **Grandfather creep:** exceptions accumulating until no customer is on list price.
