# Diagnostic evidence examples

All values and scenarios are synthetic teaching inputs. No live observations, source lookup,
customer quotes or causal tests occurred. The filename is retained for existing consumers;
examples do not require a particular diagram type.

## Signup gap and co-timed changes

Weekly signups are 200 versus an observed comparison of 350. Gap is 150 signups/week;
relative decline is 150 / 350 = 42.9%. A homepage release and targeting change occurred together
in the scenario. Candidates include recording failure, population mix, within-segment behavior
and an external demand change. They can interact and share users.

Deciding evidence: aligned event definitions, independent server acceptance records, exposure
and completions by stable segment, release assignment and time. If paid conversion changes from
3.5% to 1.2%, that is -2.3 percentage points or -65.7% relative. It does not identify targeting
as the cause without comparison and exposure data. A bounce-rate rise from 35% to 52% is 17
percentage points; it is not evidence of lost trust by itself.

## Exact arithmetic with an interaction

Synthetic order data: period 0 has 1,000 eligible sessions at 4% order rate, giving 40 orders.
Period 1 has 800 sessions at 3%, giving 24. The change is -16 orders.

- Volume term: (800 - 1,000) × 0.04 = -8.
- Rate term: 1,000 × (0.03 - 0.04) = -10.
- Interaction: (800 - 1,000) × (0.03 - 0.04) = +2.
- Reconciliation: -8 -10 +2 = -16.

Revenue then equals orders × average recognized revenue per order, with matching recognition
and refund definitions. Neither identity proves the cause of a rate, volume or value change.
An allocation that places the +2 interaction with volume or rate must state that convention.

## Composition without within-segment change

Segment A converts at 5% and B at 1% in both periods. Their shares change from 75%/25% to
25%/75%. Blended conversion changes from 0.75×5% + 0.25×1% = 4% to
0.25×5% + 0.75×1% = 2%. The observed composition accounts for the blended change arithmetically.
It does not identify why the shares changed or prove an external/internal campaign mechanism.

## Churn, pipeline and delayed outcomes

Synthetic monthly churn is 6% against a 3% target. Keep the target distinct from prior observed
churn. Failed payments, product issues, price changes and customer budget cuts can affect the same
accounts. Join billing events, cancellations and exposure dates before allocating lost accounts.
A cancellation reason is evidence from that source, not necessarily the sole cause.

Synthetic content-attributed pipeline is $200K/quarter against a $500K target, a $300K planning
gap. Check attribution definitions, lead eligibility, opportunity maturity and overlapping touches.
Do not add channel-attributed totals when they credit the same opportunities.

For a slower sales process, compare stage-entry cohorts and completed/censored opportunities
under the same observation window. A larger share of unfinished deals can alter the apparent
cycle time. Deciding data includes stage timestamps, eligibility and follow-up horizon. Do not
blame negotiation or budget without evidence discriminating those explanations.

## Local review outcome

Preserve the supported calculations, candidate alternatives, evidence owners and unknowns.
Hypotheses may remain Inconclusive; potential contribution can stay unknown. No branch count,
coverage assertion or forced percentage closure supplies missing causal evidence.
