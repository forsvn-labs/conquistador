---
title: Knowledge Review Method
lifecycle: canonical
status: stable
produced_by: factcheck
load_class: METHOD
---

# Knowledge review method

Audit whether a decision rests on credible, current, and honestly uncertain evidence. Produce a
source table, a contradiction matrix, a labeled resolution, and a recheck trigger — not a padded
review that agrees with its requester.

## 1. Fix the claim under review

State the factual claim or decision the review must support, exactly as it will be used (published,
shipped, decided). One claim per claim row; compound claims get split. Enumerate every source and
data point the work currently leans on, including the ones the author did not cite.

Classify each item before judging it: observed evidence, reasonable inference, or assumption.
Reclassify anything mislabeled upstream and record that you did.

## 2. Assess every source

For each source record:

- **authority:** primary or secondary; provenance; perspective; known bias; incentive to publish;
- **freshness:** explicit date, plus how fast this category of claim goes stale;
- **uncertainty:** confidence, sample size and recruitment, what finding would change it;
- **provenance trail:** which tool, route, or reviewer supplied this item — see
  [review evidence scope](provenance.md).

An unavailable source is **missing data**, never zero and never permission to substitute an
assumption.

## 3. Build the contradiction matrix

Follow the [contradiction protocol](contradiction-protocol.md): one row per source, per claim —
what it asserts, authority, date, uncertainty — with every direct contradiction marked explicitly.
Conflicts stay visible; they are never merged, averaged, or counted away.

## 4. Resolve by weighing, not voting

Reconcile conflicts by weighing authority × recency × causal plausibility:

- a narrow but direct primary source outranks broad secondary repetition;
- recency wins only when the claim's category actually decays;
- causal plausibility can demote even strong observational evidence (correlation without a control
  is attribution risk, not proof);
- record why the losing evidence lost, in one sentence per loser.

Label the resolved position with its confidence: established, probable, contested, unresolved.

## 5. Verify the resolution honestly

When a separate provider, model family, reviewer context, or evidence tool is available, give it the
claim table **without** the first resolver's conclusion and record which separate route checked it.
Only call the result independent when a separate context actually ran.

Without that capability, perform a single-context counter-read: construct the strongest evidence-led
case against the resolution and state what survives. Label it as fallback, never as independent
corroboration. See [sequential fallback](../fallbacks/sequential.md).

## 6. Unknowns and recheck

List what remains unknown after resolution. Set a recheck trigger per unknown: a date, an event, or
a condition ("when the next cohort closes", "when a control group exists"). An unknown that silently
ages into a fact is the failure mode this skill exists to prevent.

## Deliverable shape

1. claim(s) under review, stated exactly;
2. source table with authority, freshness, uncertainty, provenance;
3. contradiction matrix with marked conflicts;
4. resolved position with confidence label and reasons losers lost;
5. verification route (independent / single-context counter-read) and what it found;
6. surviving unknowns with recheck triggers;
7. what the resolution does **not** authorize.

## Scope and boundaries

This reviews knowledge, sources, and factual claims — never code, diffs, or implementations. Keep
the review proportional to the decision. Never fabricate, pad, or simulate sources. The resolution
informs a human decision; it does not approve publication, spend, send, deploy, or release.
