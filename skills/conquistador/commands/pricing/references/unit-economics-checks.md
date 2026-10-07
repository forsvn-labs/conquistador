---
title: Unit Economics Checks
lifecycle: canonical
status: stable
produced_by: pricing
load_class: METHOD
---

# Unit economics checks

A price clears demand evidence only if it also survives the cost side. Run every proposed tier and
corridor bound through these checks; a failure rejects the design no matter how attractive the
demand story.

## The checks

### 1. Gross margin per account

For each tier, at the corridor's **lower bound**:

- direct costs: hosting or usage metering, third-party per-unit fees, payment processing;
- allocated support and success time for that tier's typical customer;
- margin = (price − direct costs) / price.

Flag any tier below the operator's stated floor. If no floor is stated, flag tiers under 70% gross
margin for software products and ask for the real floor.

### 2. Payback period

For sales-led motion: acquisition cost divided by monthly gross profit per account. For self-serve:
blended CAC against the same denominator. Payback beyond twelve months needs an explicit retention
argument; beyond twenty-four months is a rejection unless the operator owns the exception.

### 3. Cost-to-serve outliers

Heavy users, low-margin segments, and abuse cases identified in the fence checks get their own math.
A tier whose worst decile loses money needs either an overage mechanism, a capacity fence, or a
written acceptance of the loss as strategy.

### 4. Discount and downgrade floors

- deepest discount that still clears margin, before approval escalation;
- downgrade path's effect on margin — the escape hatch must not become the profitable direction;
- annual-discount rate consistent with the cash-flow benefit, not just competitive mimicry.

### 5. Metering cost

If the value metric requires instrumentation that does not exist, estimate build and run cost of
metering honestly and include it in the timeline. A metric you cannot meter yet is a roadmap item,
not a launch dependency.

### 6. Platform fees and cash timing

- For app-store or marketplace billing, subtract the platform commission at its current,
  dated rate from the price before you compute margin. Check whether a reduced small-seller rate
  applies and whether the seller qualifies.
- Model cash timing apart from lifetime value. Acquisition is paid now; platform payouts arrive
  later; monthly or weekly revenue arrives over months. A tier that pays back on lifetime value
  can still exhaust cash.
- When acquisition cost per paying customer approaches the first-period price, flag the cash
  gap and show how an up-front annual plan changes it.

## Output

Each check returns pass, fail, or unknown-with-owner. The deliverable carries the table; failed
checks appear next to the affected tier, not in an appendix. Unknowns name who supplies the missing
number and by when.

## Data rules

Costs follow the same evidence discipline as prices: label observed, estimated, and assumed. An
estimated cost used to reject a design is fine; an assumed cost silently shaping a corridor is not.
