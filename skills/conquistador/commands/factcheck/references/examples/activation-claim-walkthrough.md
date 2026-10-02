---
title: Worked Example — Activation Claim Audit
lifecycle: canonical
status: stable
produced_by: knowledge-review
load_class: EXAMPLE
---

# Worked example: the activation-lift claim

**This example is fictional.** The product "Fieldnote", its metrics, cohorts, sources S1–S4, and all
numbers are invented to teach structure. No real claim, company, or source is described, and this
example does not count as an execution of the skill or as evidence of any kind.

## Invocation

> "Our launch page will say the new onboarding raised activation by eleven percentage points. Check
> whether we can publish that."

## Step 1 — Claim under review

Split into two claim rows: (a) activation rose eleven points after the onboarding change;
(b) **the change caused** the rise. The page needs (b); publishing (a) alone would be misleading.

## Step 2 — Source table

| Source | Asserts | Authority | Date | Uncertainty | Provenance |
|---|---|---|---|---|---|
| S1: Fieldnote pilot analytics export | +11 points, last quarter's pilot cohort | primary, direct observation | dated | single cohort, no control group; seasonality unexamined | product DB export, pulled by requester |
| S2: partner blog post | repeats the +11 number | secondary repetition, no method shown | 3 weeks old | unknown sample | supplied by partnerships team |
| S3: internal benchmark memo | comparable launches average +4 points | internal aggregation | 14 months old | mixed cohorts; category moves fast | docs archive |
| S4: support ticket thread | three users reported skipped steps during the pilot window | anecdotal, primary | dated | tiny, self-selected | support tool search |

S2 is recorded as repetition of S1 — one origin for resolution purposes.

## Step 3 — Contradiction matrix

- S1 vs S3 — **causal conflict**: magnitude differs (+11 vs +4) and S3 notes pilots without control
  groups overstate lifts.
- S1 vs S4 — **scope conflict**: a clean +11 story vs evidence some pilot users bypassed onboarding.
- S2 — no conflict; adds no independent support.

## Step 4 — Resolution

Claim (a): **probable but narrow** — one cohort, direct measurement, no contradicting data on the
number itself within that cohort. Claim (b) — **contested**: causal attribution fails the plausibility
weighing because the pilot lacked a control group and S3 shows category-typical inflation of
uncontrolled pilots. Loser reasoning recorded: S1 loses on design, not on authority; S2 discarded as
repetition; S4 too small to overturn anything, kept as dissent.

## Step 5 — Verification route

No separate reviewer context available in this run → single-context counter-read performed: the
strongest case *for* causation (lift size exceeds seasonal variation in prior years) was constructed;
it survives partially — it supports "likely real effect" but cannot exclude seasonality. Labeled
fallback, not independent corroboration.

## Step 6 — Unknowns and recheck

- Unknown: would a holdout cohort reproduce the lift? Trigger: next cohort closes at quarter end.
- Unknown: does the lift persist past 30 days? Trigger: 60-day retention readout.
- Until either fires, the page may say "early pilot data showed an eleven-point activation
  improvement in one cohort" — not "raised activation".

## Verdict

Review graded against the rubric: pass with limitations (no separate verification context). The
review decides nothing about publication — that is a human call outside this skill.
