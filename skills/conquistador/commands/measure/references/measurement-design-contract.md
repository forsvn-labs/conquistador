# Measurement design contract

Use before observations exist. This is a planned decision system, not a performance readout.

## Required output

1. Decision, owner, and action date.
2. Primary signal with numerator, denominator, eligibility, and source of truth.
3. Diagnostic events and properties, with identity, deduplication, timestamp, consent, retention, and
   missingness rules.
4. Quality, cost, accessibility, privacy, and harm guardrails that apply to the initiative.
5. Baseline, minimum sample or observation floor, window, and keep/revise/stop thresholds. When these
   values are not supplied, label them `pending owner decision`; never invent them.
6. QA plan for event firing, property validity, duplicates, identity stitching, and failure paths.
7. Activation boundary: tracking changes, data collection, and experiment activation require explicit
   human approval.

## Feasibility and harm checks

- Before you choose the change to test, estimate the duration from eligible traffic, the baseline
  rate, and the smallest effect that would change the decision. When the duration exceeds the
  decision window, test a larger change or choose another method, such as a qualitative test or a
  before-and-after comparison labeled as correlational.
- Decide in advance that an inconclusive result at the planned end keeps the control. Do not extend
  the window to chase significance.
- List the downstream signals the change could harm, such as more sign-ups but less activation.
  Read them before you call a winner.

## Paid app install attribution

When paid campaigns drive app installs, decide whether an independent attribution provider is
needed:

- Usually needed: two or more paid sources, web-to-app campaigns, or an ad network without its own
  measurement kit.
- Usually not needed: a single paid source whose own attribution covers the decision.

For each ad network, verify that the subscription or revenue platform forwards trial and revenue
events to it; coverage differs by network. Choose a provider by its cost per attributed conversion
against the unit economics, not by brand name. Record what each option cannot attribute.

Do not require result denominators, confidence intervals, attribution diagnosis, or a durable learning
record in design mode. Those become mandatory only after observations exist.
