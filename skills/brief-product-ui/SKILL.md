---
name: brief-product-ui
description: "Turn an approved product flow into an implementation-ready UI brief. Use for screen inventory, reusable components, design-token application, interaction and system states, accessibility, and build handoff. Not for marketing landing pages or brand identity."
metadata:
  version: 2.1.0

---

# Brief a product interface

Produce a buildable interface specification grounded in an accepted product flow. Do not render or
invent product behavior unless the user separately asks for implementation.

## Prove the source flow

Identify the flow, platforms, surfaces, nodes, decisions, and states this brief implements. If no
usable flow exists, perform a compact flow validation inside this skill: state the job, entry, success,
stable nodes, transitions, branches, failure/recovery, and unresolved decisions. Do not hard-depend on
a sibling skill or silently invent behavior.

Every screen, component, state, and action must trace to a flow node, edge, native platform
requirement, or explicit product decision. Do not add speculative dashboards or settings.

## Define the interface system

Specify:

- screen/surface inventory and source-flow trace;
- reusable component names, jobs, content, and variants;
- layout hierarchy and responsive/native behavior;
- existing semantic color, type, spacing, radius, motion, and focus tokens;
- default, hover, focus, pressed, disabled, selected, loading, success, warning, and error states;
- empty, permission, offline, interruption, and recovery treatment;
- keyboard, assistive-technology, contrast, reduced-motion, and target-size requirements.

When project tokens are missing, define semantic roles that must be mapped before implementation.
Do not invent arbitrary raw values or silently create a new brand system.
When the request supplies semantic token names, those names are authoritative. Do not replace them
with recovered examples, house-brand tokens, default scales, raw values, or a different naming scheme.

## Make the handoff testable

For every screen, state what the user understands, can do, and sees after the action. Name content
requirements, truncation/overflow, validation, persistence, analytics events when requested, and
platform-native boundaries.

## Deliver

Return:

1. outcome and source-flow trace;
2. screen inventory;
3. component system;
4. token application map;
5. per-screen layout and content hierarchy;
6. interactions and complete state coverage;
7. accessibility requirements;
8. implementation order and test cases;
9. explicit non-goals and unresolved decisions.

Finish with acceptance criteria a designer and engineer can review without reconstructing the product
logic.

Before delivery, load the recovered method instead of paraphrasing it:

- [intake-validator](agents/intake-validator-agent.md) for flow/token presence;
- [screen-inventory](agents/screen-inventory-agent.md),
  [component-system](agents/component-system-agent.md), and
  [token-application](agents/token-application-agent.md) for the system inventory;
- [layout-state](agents/layout-state-agent.md) for layout, interaction, and full state coverage;
- [handoff](agents/handoff-agent.md) for buildable acceptance and the no-render boundary;
- [critic](agents/critic-agent.md) with the 8-checkpoint
  [gates and rubric](references/gates-and-rubric.md);
- [UI brief method](references/ui-brief-method.md),
  [format conventions](references/format-conventions.md),
  [component patterns](references/component-patterns.md),
  [layout conventions](references/layout-conventions.md),
  [token application patterns](references/token-application-patterns.md), and
  [anti-patterns](references/anti-patterns.md).

Reference routing is source-specific. For supplied semantic tokens, load the portable
[`semantic-token-walkthrough`](references/examples/semantic-token-walkthrough.md) and do not load the
house-token bindings or house dashboard walkthrough. Load
[`house-token-bindings`](references/house-token-bindings.md) and the house walkthrough only when the
operator explicitly declares `brand_source: house`. Examples are never default inputs.

If the host cannot run those as separate agents, use [sequential fallback](fallbacks/sequential.md).
Prefer `.forsvn/artifacts/product/brief-product-ui/` for durable interface briefs. Emit a portable
spec; do not render UI unless the user separately asks for implementation.
