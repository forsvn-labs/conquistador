# Critical Gates + Quality Rubric — Full Detail

Cited by `COMMAND.md` "Critical Gates" and "Quality Gate" sections. Read in full before any Layer 1 dispatch — gates fire on every run regardless of mode (`--fast` does **not** bypass them; see `../fallbacks/sequential.md` § safety-gates-supersede).

## Why this block precedes "Before Starting"

The platforms+surfaces gate (Gate 1) must fire before full standalone mapping. A bounded
`platform-unresolved` portable spec is the explicit exception: it may document platform-neutral
structure and keep native behavior and implementation blocked. Do not force a platform choice merely
to satisfy wireframe sizing.

## The 7 Critical Gates

1. **No platform-specific Layer 1 before platforms + surfaces enumerated.** See
   `platform-touchpoints.md`. The only exception is an explicit bounded `platform-unresolved` portable
   spec. That mode may cover platform-neutral logic and states, but it must omit mini-frames and native
   assertions, list the platform decisions, and block implementation.
2. **Reject "cross-platform" as a platform.** Enumerate explicitly: macOS, iOS, iPadOS, Android, Windows, web-desktop, web-mobile, watchOS, tvOS, visionOS, CarPlay, Android Auto, Linux.
3. **No diagrams before structure.** Diagram-agent needs structure + edge-case outputs first.
4. **No skipping edge cases.** Error / empty / loading / permission / offline + per-surface edge states for every screen and surface.
5. **Challenge >7 happy-path steps.** Miller's threshold. Every step must justify itself.
6. **One flow = one file.** No pooling. Each run writes `.forsvn/artifacts/product/map-user-flow/map-user-flow-<YYYY-MM-DD>-<slug>.md`.
7. **Stale product context (>30 days) misaligns flows.** Recommend re-running `position` before proceeding.

## Quality Gate — Critic Rubric (PASS checks)

The critic agent (`agents/critic-agent.md`) runs the full rubric. All checks below are non-negotiable PASS conditions:

- Platforms + per-platform surfaces explicitly enumerated (no "cross-platform"), or explicit
  `platform-unresolved` portable mode with the implementation block and open decisions
- Every declared platform × surface has entry + mini-frame + per-surface edge state; N/A in
  `platform-unresolved` mode because no platform is declared
- Mini-frame dimensions match `platform-touchpoints.md`; N/A in `platform-unresolved` mode
- Every decision point has ≥2 labeled exits; no dead-end errors
- Happy path ≤7 steps; ≤3 primary actions per screen
- Full standalone mode: every core screen has an ASCII wireframe and description. Compact parent
  composition or platform-unresolved mode: N/A unless the caller requested wireframes.
- 2-3 critical edge-state variants included

## Critic FAIL handling

Re-dispatch named agent(s) with feedback per `../anti-patterns.md` § "When the critic FAILs." Max 2 cycles. After 2 failures, stop for the human with the best flow and critic annotations pinned. `status: DONE_WITH_CONCERNS` is an internal grade only, not delivery or implementation authority.
