# Quality Gate — create-shortform produce phase

Mode-aware critic gate. Single critic agent runs before delivery; per-gate rubric in [`../fallbacks/sequential.md`](../fallbacks/sequential.md).

## Shortform — 4 gates

1. **Schema-and-CTA compliance** (hard). Manifest validates against `references/video-brief-schema.md`; CTA verbatim in final shot `on_screen_text` AND manifest top-level `cta`.
2. **Brand-mark fidelity** (hard). No hallucinated logos; every per-shot prompt cites assets from `brand/DESIGN.md` only.
3. **Caption-pace floor** (hard). `words(on_screen_text) ÷ duration_seconds ≤ 3.0` per shot.
4. **Narrative arc** (soft — FAIL → `done_with_concerns` warning, not block).

## App-Preview — 7 gates

Gates 1/2/3/4 above (mode-aware) **plus**:

5. **Screenshot grounding** (hard). Every `source_id` resolves to a real file on disk; no invented UI elements.
6. **Interaction-vocabulary + mask-transform compliance** (hard). Only the canonical interaction verbs + mask transforms documented in `references/produce-format-conventions.md`; no custom verbs.
7. **Pointer-and-caption-band fidelity** (hard). Pointer effects and caption-band placement match the handoff spec verbatim; no synthetic effects.

## FAIL Handling

- **Hard-gate FAIL (1/2/3 shortform; 1/2/3/5/6/7 app-preview):** re-dispatch prompt-author-agent with specific feedback (max 2 cycles). Two consecutive FAILs → `BLOCKED`.
- **Gate 4 only FAIL:** stop for the human — record internal grade `DONE_WITH_CONCERNS` with concerns pinned at top of manifest; no publish/send/deploy authority until a human accepts.

## Most Common Failures

- **Shortform:** hallucinated logos (Gate 2); caption-pace overshoot on hook shots (Gate 3); inventing CTAs the brief didn't specify (Gate 1).
- **App-preview:** invented UI elements (Gate 5); synthetic pointer effects (Gate 7); drift between handoff and per-shot prompt (Gate 5).
