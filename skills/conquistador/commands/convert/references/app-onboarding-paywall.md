# App onboarding and paywall

Use this when the conversion surface is the onboarding-to-paywall flow of a subscription app.
Treat the flow from first open to purchase or trial start as one surface, and diagnose it apart
from the in-app experience that follows. The Reach→Value ladder in `COMMAND.md` still applies;
this file adds the flow structure and the honesty limits.

## Set the flow length

Choose the length from the problem, not from a "shorter is better" default:

- A low-stakes utility the user understands at once suits a short flow.
- A painful problem the user has failed to solve before (weight, money, habits, relationships)
  can carry a longer flow, because each answer makes the plan more personal.

Label the choice an assumption until step-level drop-off data supports it.

## Order the screens

Use this default order and record any deviation with its reason:

1. **Promise:** one outcome, in the user's words.
2. **Demo:** the core moment of the product, shown briefly.
3. **Questions:** what the plan needs to know.
4. **Progress:** where the user is in the flow.
5. **Plan reveal:** the plan built from the user's answers.
6. **Paywall.**

Every screen must either learn something that changes the plan or show the user something true
about their problem. Cut every other screen.

## Write the questions

- Use low-effort inputs: sliders and single- or multiple-choice answers.
- Put harder or more personal questions late, after the user has invested some time.
- After a key answer, a confirmation screen may reflect that answer back. Every statistic or chart
  on it must be true and sourced.
- When the flow runs the core feature on the user's own input before the paywall, run it for real
  and offer a skip path. A progress or analysis screen must reflect processing that happens.

## Build the paywall

- Restate the user's goal from their answers.
- Offer few plans and mark one as the anchor. State the real billed price and billing period
  clearly; a per-day or per-week breakdown may support it but never replace it.
- Ask for account creation after purchase or trial start, unless the product cannot work without
  an account.
- When a trial exists, say that a reminder comes before it ends, and send that reminder.
- Read current app-store rules before you design trial toggles, a discount screen after a decline,
  or a rating prompt inside onboarding. Store policy on these changes; cite the dated rule.

## Never ship

- a close button that appears late or is hard to find;
- a price shown only as a daily or weekly figure;
- a countdown, "only for you" discount, or limited-spots claim that is not literally true;
- invented user counts, awards, reviews, or testimonials;
- "free trial" copy when the charge is immediate;
- a paywall on every app open;
- a rating prompt that asks for a specific star value or appears before the user has seen value.

## Measure and change

Measure completion at each step of the flow. Change the order or wording of questions to raise
completion before you add or remove screens. When paywall views are healthy but purchases are
not, route the problem to offer and price (`pricing`) rather than to onboarding.
