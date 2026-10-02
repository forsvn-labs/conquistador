---
title: Contradiction Protocol
lifecycle: canonical
status: stable
produced_by: knowledge-review
load_class: METHOD
---

# Contradiction protocol

Contradictions are information, not noise. The protocol makes every conflict explicit, resolves it
by weighing evidence rather than counting votes, and preserves what stays unresolved.

## 1. Build the matrix

For each claim under review, one table:

| Source | Asserts | Authority | Date | Uncertainty | Conflict |
|---|---|---|---|---|---|
| S1 (primary) | ... | direct observation | ... | sample, method | vs S3 (causal attribution) |
| S2 (secondary) | repeats S1's number | repetition, no method | ... | unknown sample | none — but adds no independent support |

Rules:

- a source that merely repeats another is recorded as repetition; two rows citing one origin are
  **one** source for resolution purposes;
- mark conflicts in the row where they arise: `vs <source> (<what differs>)`;
- absence of conflict between sources that cannot know each other is coincidence, not corroboration.

## 2. Classify the contradiction

- **Data conflict** — different numbers for the same quantity. Check period, cohort, and definition
  first; most data conflicts are definitional.
- **Causal conflict** — same observation, different explanation. Weigh control quality and
  alternative explanations, not confidence of tone.
- **Scope conflict** — both right, different domains. Record the boundary explicitly so neither is
  over-applied.
- **Freshness conflict** — older finding superseded. Verify the category actually decays before
  discarding the old value.

## 3. Resolve by weighing

Resolution weighs authority × recency × causal plausibility (method step 4). Never resolve by:

- **counting** — ten repetitions of one press release are one source;
- **averaging** — the midpoint of "works" and "does not work" can describe nothing real;
- **seniority of voice** — confidence and rank are not authority;
- **silence** — sources that do not mention the conflict have not resolved it.

Record per conflict: which position wins, why, and one sentence on why the loser lost.

## 4. Preserve dissent and unresolved state

When the losing side retains real force — credible authority, plausible mechanism — record it as
dissent attached to the resolved position instead of erasing it. When no position clearly wins,
label the claim **contested** or **unresolved** and attach a recheck trigger. A forced resolution of
a genuine tie is fabrication with formatting.

## 5. Report

The deliverable carries the matrix verbatim, the classification per conflict, the resolutions with
their reasoning, surviving dissent, and unresolved items with triggers. Never present a smoothed
narrative without the matrix behind it.
