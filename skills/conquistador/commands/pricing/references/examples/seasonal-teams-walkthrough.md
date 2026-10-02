---
title: Worked Example — Seasonal Teams Packaging
lifecycle: canonical
status: stable
produced_by: pricing
load_class: EXAMPLE
---

# Worked example: repackaging for seasonal teams

**This example is fictional.** The product, company, numbers, quotes, and market are invented for
teaching structure only. Nothing here is evidence about any real product, and this example does not
count as an execution of the skill.

## Invocation

> "Our scheduling tool charges $12/seat/month. Seasonal event teams use us hard for three months and
> idle the rest of the year, so they churn every winter and come back in spring. Heavy users say
> per-seat punishes them. A procurement-led competitor just listed $9. Redesign the packaging."

## Step 1 — Frame

- Audience: seasonal event teams (5–40 seats), plus year-round agencies (control group).
- Job: schedule crews across rotating events.
- Maturity: early revenue; 60% of revenue from the top eight accounts.
- Objective: retain seasonal teams without cutting year-round account pricing.
- Constraint: billing system supports monthly and annual only — no metering today.
- Migration risk: 200 existing subscribers on simple per-seat.
- Horizon: decision needed before spring re-acquisition season.

## Step 2 — Value metric scoring

Candidates: seats, active-roster seats, events scheduled per month, workspaces.

| Test | Seats | Active roster | Events/mo | Workspaces |
|---|---|---|---|---|
| Value alignment | weak (punishes idle months) | strong | strong | medium |
| Understandability | strong | strong | medium | medium |
| Predictability | strong | strong | weak | medium |
| Measurability | strong now | needs roster flagging — build required | needs metering — build required | strong now |
| Expansion neutrality | weak | strong | medium | strong |

Winner: **active roster seats** — but measurability requires a roster-management feature that does
not exist. Honest output: adopt seats now as a proxy with a season-pause mechanic, target active
roster next cycle once metering ships. Weakest test (predictability of paused-billing rules) named,
with the overturning condition: if pause-related support tickets exceed a set threshold in the pilot,
the mechanic is redesigned.

## Step 3 — Packages and fences

| Tier | Job | Price (fictional) | Fences | Exclusion reason |
|---|---|---|---|---|
| Crew | one-off events, up to 10 roster slots | $29/event-month | capacity + term (monthly only) | multi-event reporting is an agency job, not a crew job |
| Company | recurring season, 11–40 slots | $199/season-month flat | capacity + quality (priority support) | single-season teams don't need cross-year analytics |
| Agency | unlimited seasons, multi-team | $499/month annual-only | audience + term | procurement and SLA load justify commitment |

Boundary walk finds: a 12-slot team at the Company floor resents paying agency-adjacent price →
guardrail: slot-band pricing inside Company. Agencies sharing logins to dodge per-seat disappear
because Agency is flat — accepted trade-off, written down.

## Step 4 — Corridor and unit economics

- Evidence: two years of observed churn/rejoin cycles (class 2), nine interviews (class 4, language
  only), competitor page dated this quarter (class 6). No transaction tests at new prices (missing).
- Corridor for Company: $179–$239. Lower bound from cost-to-serve + support allocation; upper bound
  from churn-cycle math (rejoin friction valued at roughly two months of price). Interview numbers
  explicitly excluded from bound-setting.
- Unit economics at $179: margin 74% (pass, above floor); payback self-serve <1 month (pass);
  worst-decile heavy users covered by slot bands (pass); discount floor $149 (annual only).
- Metering cost for active-roster flagged as roadmap dependency, not launch blocker.

## Step 5 — Red-team objections

- Procurement: "flat seasonal price has no benchmark" → publish comparison math on the pricing page.
- Heavy user: "pause feels like a trick" → pause keeps data and settings intact, stated in-product.
- Existing subscriber: "my bill changed" → grandfather current per-seat for twelve months; migrate
  at renewal with side-by-side bill comparison.

## Step 6 — Rubric and reversal

Rubric: dimensions 1, 3, 4, 5, 8 pass; 2 pass with the login-sharing note; 6 and 7 pass after
grandfathering. Verdict: **ready with material cautions** (no transaction-grade evidence at new
prices).

Reversal test: offer Company tier to half of churning-or-returning seasonal accounts at renewal for
one quarter; primary signal is return-rate delta versus control; keep if ≥15-point lift with no
margin breach, revise if mixed, stop if return rate falls. Check date set at quarter close.

Human gate: pricing-page copy, billing config, and grandfather policy all wait for explicit owner
approval. This example approves nothing.
