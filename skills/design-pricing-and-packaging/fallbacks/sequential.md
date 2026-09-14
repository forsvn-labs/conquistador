# Sequential fallback — pricing and packaging

Use when the host cannot run research, economics, fence review, and red-team passes as separate
contexts. Keep the same method; change only the machinery. Label the result **single-context
pricing analysis**, not independent validation.

## Order of work

1. **Frame and evidence inventory.** Write the decision frame (audience, job, maturity, objective,
   constraints, current offer, migration risk, horizon). Inventory every pricing data point with its
   evidence class, date, and sample per [WTP evidence](../references/wtp-evidence.md). Missing
   sources are recorded as missing, never assumed.
2. **Value metric scoring.** Score candidates against the five tests in the
   [pricing method](../references/pricing-method.md). One pass to score, a second pass arguing the
   strongest case against the winner. Record the weakest test.
3. **Packages and fences.** Draft tiers with jobs and exclusions from
   [package fences](../references/package-fences.md). Walk every boundary-customer case before
   moving on.
4. **Corridor and unit economics.** Set corridor bounds with evidence classes, then run all five
   [unit economics checks](../references/unit-economics-checks.md) at the lower bound. Reject or
   resize failing tiers immediately.
5. **Red-team pass.** Re-read the draft as the most price-sensitive customer, then as procurement,
   then as a heavy user hunting for a cheaper path. Each persona gets written objections; each
   objection gets a design answer or a test-plan item.
6. **Rubric and reversal.** Score the deliverable against the
   [pricing rubric](../references/pricing-rubric.md). Write the reversal condition and smallest
   distinguishing test before finalizing the recommendation.

## Stops

- **Missing input:** no audience, no cost data, and no buying evidence at all → return a bounded
  offer hypothesis under sparse-evidence mode; do not fabricate a corridor.
- **Factual uncertainty:** a load-bearing number cannot be traced to an evidence class → label it
  hypothesis or remove it.
- **Credential stop:** billing, entitlement, or checkout systems are out of scope without explicit
  approval; this skill never touches them.
- **External action:** no price changes, customer communications, or contract edits — analysis and
  recommendations only.
- **Critic failure:** after one red-team cycle objections remain unresolved → ship them listed as
  open risks, never silently dropped.
- **Human verdict:** every output ends at a human decision gate; nothing here approves a launch.
