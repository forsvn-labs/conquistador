---
title: Product UI Playbook
lifecycle: canonical
status: stable
produced_by: ui
load_class: METHOD
---

# UI brief method

## Why this skill exists

After `flow` produces a validated flow artifact, there is no skill that converts that flow into a screen-level, brand-tokened, component-specified interface spec. The gap is specific:

- **`flow`** stops at flow logic and low-fidelity wireframes — it explicitly is "not for visual brand design."
- **`architect`** is tech-only: schemas, APIs, file structure, deployment topology.
- **`convert` (landing-page conversion brief)** is conversion-locked to single-page marketing surfaces.

Nothing takes _(validated flow + DESIGN/BRAND tokens)_ → _(screen inventory, component system, token-applied layout/state spec)_ → _(buildable handoff)_. `ui` fills exactly that slot in the product stack: the bridge from "what the user does" to "what the interface looks and behaves like, completely specified."

## The SPEC-not-renderer principle

This skill is a **specifier, not a renderer**. It emits a portable, reviewable, token-bound spec. When
the project has an artifact store, the caller may persist it there. Otherwise return it inline. A
renderer or coding agent may consume the spec only when that downstream work is in scope.

The no-render gate is not a limitation. It is the identity.

- `--render` and `--api` are explicitly BLOCKED. The operator's renderer (impeccable, hallmark, stitch, `ce-frontend-design`) consumes the spec; this skill does not race it.
- Portability is the value: a spec that decouples "what to build" from "who builds it" survives toolchain changes, design-to-code transitions, and multi-agent handoffs.
- Reviewability means the artifact exposes its decisions and gaps. It does not require a private store
  or a human verdict before the bounded spec can be returned.

The distinction matters. Many tools collapse spec and render into one step, which ties the output to a specific renderer and makes the spec unreviewed. `ui` separates them.

## Methodology

**Flow is the contract.** Prefer a `flow` artifact; if none exists, run compact flow validation inside this skill. The validated flow source defines every screen in scope. This skill enumerates from it — no screen is invented. If the flow doesn't include a screen, the spec doesn't include a screen.

**Pipeline shape: intake → L1 parallel → merge → layout/state → handoff → critic.**

1. **Intake + validation** — verify the prerequisite flow artifact (path, status `done`), load DESIGN/BRAND tokens, resolve mode tier.
2. **Layer 1 parallel** — three agents run simultaneously: _screen-inventory_ (enumerate screens from the flow), _component-system_ (extract reusable components, define the vocabulary), _token-application_ (map brand tokens to each component and screen state).
3. **Merge** — reconcile the three parallel outputs into a coherent spec: component names consistent with screen inventory, token assignments consistent with component definitions.
4. **Layout + state specification** — for each screen: layout grid, component placement, every interaction state (idle, loading, error, empty, success). This is where the spec becomes buildable.
5. **Handoff** — produce the handoff block: component list with prop surfaces, state matrix, token manifest, implementation notes. The build surface consumes this directly.
6. **Critic gate** — 8-checkpoint rubric. See [`gates-and-rubric.md`](gates-and-rubric.md) for the full CP-01–CP-08 definitions. FAIL re-dispatches the named agent; max 2 cycles.

Full artifact structure (9 required sections) is defined in [`format-conventions.md`](format-conventions.md).

## Core principles

**Flow-grounded.** Every screen in the spec must trace to a node in the validated flow source (`flow` artifact or compact in-skill flow validation). No invented screens, no scope expansion inside this skill. If the flow source is incomplete and cannot be validated here, return `NEEDS_CONTEXT` and name what's missing.

**Systematic.** Components are extracted once and reused across screens — not defined per-screen. A component defined for Screen 3 that also appears on Screen 7 is the same component, not two independent descriptions. Repetition is a failure mode, not thoroughness.

**Token-true.** No raw color values, spacing numbers, or font sizes appear in the spec. Every visual
value references the declared token source. Supplied semantic names remain unchanged. Source-specific
brand rules apply only to that source; recovered house examples never override customer input.

**Buildable without questions.** The Core Question: _can a frontend engineer or design tool implement this spec without asking a single clarifying question?_ If the answer is no — a state is unspecified, a token is missing, a component prop is ambiguous — the spec is not done. The handoff block is the final checkpoint for this.

## When NOT to use this skill

- **Flow does not exist yet** — run compact flow validation inside this skill (or optionally `flow` for a full sibling pass). Do not invent screens without a validated flow source.
- **Visual brand identity from scratch** — use `brand`.
- **Marketing / conversion-surface design** — use `convert` (landing-page conversion brief).
- **Technical API, schema, or file structure** — use `architect`.
- **Rendering or generating actual UI assets** — use `impeccable`, `hallmark`, `ce-frontend-design`, or a design tool directly after receiving this spec.
- **Task decomposition from the spec** — use task decomposition outside this skill downstream.

## History

- **Created 2026-06-07** — new deep-tier product skill. Fills the upstream tool-redirect: `flow` and `architect` previously had no downstream spec skill for the (flow + tokens) → interface-spec pipeline. `ui` is the product-stack home for that redirect, registered in the product capability registry (`id: product-ui`), consuming `flow`'s `id: user-flow` artifact and sitting `map-user-flow → brief-product-ui → architect-software-system` in the chain.

## Further reading

- [`format-conventions.md`](format-conventions.md) — 9 required artifact sections, frontmatter contract, filename grammar
- [`gates-and-rubric.md`](gates-and-rubric.md) — CP-01–CP-08 critic rubric (SoT)
- [`anti-patterns.md`](anti-patterns.md) — failure modes catalog
- [`../fallbacks/sequential.md`](../fallbacks/sequential.md) — agent roster, roles, dispatch protocol
