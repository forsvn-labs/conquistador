---
name: map-user-flow
description: "Map an in-product flow across screens, decisions, transitions, native platform surfaces, and recovery states. Use for a feature or user journey that spans multiple screens or states, before visual UI design or technical architecture."
metadata:
  version: 2.1.0

---

# Map a product flow

Create the smallest complete flow that lets a product team make interface and implementation
decisions without inventing missing behavior.

## Establish the job and surfaces

State the user job, entry condition, successful end state, and explicit non-goals. Enumerate actual
platforms and native surfaces; reject “cross-platform” as a sufficient specification.

For a bounded portable product specification where the target platform is genuinely undecided, use
`platform-unresolved` mode. Produce only platform-neutral nodes, transitions, decisions, system
states, recovery, and validation. Mark platform, native surface, permission, accessibility, and
handback behavior as unresolved. Do not draw platform mini-frames, assert platform support, or
authorize implementation. This exception does not apply to a build handoff or a request that names
one or more platforms.

Read existing product requirements, shipped UI, analytics, and support evidence when available.
Separate observed behavior, approved requirement, inference, and open decision.

## Write structure before diagrams

Give every screen/state a stable short identifier. For each, specify:

- user intent and information required;
- available actions;
- decision or system condition;
- destination for success, cancellation, and failure;
- state that must persist across the transition.

Keep the happy path short. Challenge more than seven user actions and remove steps that do not create
understanding, control, or required trust.

Seven user actions is a challenge signal, not a universal hard limit. Keep a longer flow when safety,
consent, platform convention, or necessary understanding justifies every step.

## Cover the complete state space

For every relevant surface, cover:

- empty and first-run;
- loading and duplicate-action prevention;
- validation and system error;
- permission denied or revoked;
- offline/degraded operation;
- cancellation, retry, and safe recovery;
- interruption, resume, and destructive confirmation where applicable;
- accessibility and native platform behavior.

Do not add a screen merely to house information that belongs in an existing state.

Keep structure, edge-case challenge, diagram or wireframe translation, and validation as distinct
review roles. Independent specialists are optional; the portable sequential fallback performs those
passes in order and preserves unresolved product decisions instead of smoothing them away.

## Deliver

Return:

1. outcome, assumptions, and non-goals;
2. platforms and surfaces, or an explicit `platform-unresolved` boundary;
3. numbered happy path with explicit transitions;
4. decision branches;
5. state and edge-case matrix;
6. recovery behavior;
7. validation scenarios;
8. unresolved product decisions.

Use a diagram only after the written structure is complete. Finish with the smallest review question
that would materially change the flow.

Before delivery, load the recovered method instead of paraphrasing it:

- [flow-mapping method](references/flow-mapping-method.md) for philosophy and when-not-to-use;
- [gates and rubric](references/gates-and-rubric.md) before any structure work; load
  [platform touchpoints](references/platform-touchpoints.md) only after one or more target platforms
  are declared;
- [intake prompts](references/intake-prompts.md) for warm/cold start questions;
- [structure](agents/structure-agent.md) and [edge-case](agents/edge-case-agent.md) agents before
  [diagram](agents/diagram-agent.md) and [wireframe](agents/wireframe-agent.md);
- [validation](agents/validation-agent.md) then [critic](agents/critic-agent.md);
- [research checklist](references/research-checklist.md), [report template](references/report-template.md),
  and [anti-patterns](references/anti-patterns.md); load the platform-specific
  [checkout walkthrough](references/examples/checkout-walkthrough.md) only in full standalone mode
  with declared platforms;
- optional Mermaid helper [`scripts/generate_flow.py`](scripts/generate_flow.py).

In compact parent composition or `platform-unresolved` mode, do not load platform touchpoints, the
checkout walkthrough, diagram rules, or wireframe dimensions. Use written structure, recovery,
validation, open platform decisions, and the implementation block.

If the host cannot run those as separate agents, use
[sequential fallback](fallbacks/sequential.md) in layer order: platforms+surfaces → structure+edge-case
→ diagram+wireframe → validation → critic. Prefer
`.forsvn/artifacts/product/map-user-flow/` for durable flow artifacts.
