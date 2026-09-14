---
type: shared-reference
schema_version: 1
method_updated: 2026-09-15
last_verified: null
verifier: none
status: draft
---

# Legibility convention

Keep the `## Legibility` body section before the critic verdict. Social copy places `## Why this
works` immediately after it; measurement does not add that product-fit block.

The block records which local method informed a decision and what remains unknown. A method
update is not platform verification. Read the loaded pack's frontmatter without supplying missing dates.

## States

- `Packed`: a pack was loaded. Draft packs are valid inputs. Show id, `method_updated`,
  `last_verified: null`, `verifier: none`, and `status: draft` exactly when those are its values.
- `Stale`: retain this token only for a loaded pack explicitly marked stale. Explain the declared
  limitation; do not infer verification from the method date or apply a 90-day promotion rule.
- `Absent`: no pack was loaded. Say so. Do not invent section citations or channel-specific knowledge.

A draft pack does not itself require `done_with_concerns`. Unresolved task constraints or inadequate
observations can require that status independently.

## Required content

State the fit/defer decision from §0, opening choice from §1, task-local format checks from §2,
observable measure from §3 and the bounded test from §5. Cite only sections actually used. Timing
comes from operator capacity in §6; the action path comes from §7. Carry unresolved assumptions
from §8. Explain how each choice serves this task. Do not claim it exploits a ranking formula.

For measurement, name the tested choice and the actual outcome, denominator and window. A section
citation explains the question asked; it does not prove the answer or establish causality.

```markdown
## Legibility
**Legibility — applied expertise**
- State: Packed
- Pack: producthunt; method_updated: 2026-09-15; last_verified: null; verifier: none; status: draft.
- Applied method: compare two gallery explanations (§1); use a supplied account constraint checklist (§2).
- Test: measure qualified demo requests among tagged visits (§3/§5); comparison and window pending.
- Timing and path: assign a reply owner before choosing the window (§6); use the stated demo destination (§7).
- Unknowns: current listing limits and preview behavior are not verified (§8).
```

This is a synthetic plan, not a live observation.

## Artifact metadata compatibility

Keep `pack_verified` as a legacy field. Use `none` when the pack's `last_verified` is null or when
no pack was loaded. Never substitute `method_updated`. Keep `applied_tactics` for the specific
method choices narrated in the block; it can be nonempty with `pack_verified: none`.
The explicit block state distinguishes Packed from Absent. In social artifacts,
`platform_intel_version` carries the loaded `method_updated` date, or `none` when absent.

Reject missing, empty, misplaced or contradictory narration. A supplied draft pack must use
Packed, not Absent. Keep all counts, constraints and observations scoped to their source and task.
