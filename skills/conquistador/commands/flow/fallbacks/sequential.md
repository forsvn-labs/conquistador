# Sequential fallback

Use when the host cannot run structure, edge-case, diagram, wireframe, validation, and critic as
separate agents.

Keep the same method. Change only the machinery. Label this **single-context flow mapping**, not
independent corroboration.

Encode the historical layer order without host dispatch ceremony:

1. **Platforms + surfaces first.** Enumerate explicit platforms and native surfaces from
   [`../references/platform-touchpoints.md`](../references/platform-touchpoints.md). Reject
   "cross-platform" as a specification. Warm/cold intake questions:
   [`../references/intake-prompts.md`](../references/intake-prompts.md). Gates:
   [`../references/gates-and-rubric.md`](../references/gates-and-rubric.md). For an explicit bounded
   portable request with an undecided target, declare `platform-unresolved`, omit platform mini-frames
   and native assertions, preserve platform questions, and block implementation.
2. **Structure + edge-case.** Write the numbered happy path, decisions, and state matrix with
   [`../agents/structure-agent.md`](../agents/structure-agent.md), then cover empty/loading/error/
   permission/offline/recovery and per-surface edges with
   [`../agents/edge-case-agent.md`](../agents/edge-case-agent.md) +
   [`../references/research-checklist.md`](../references/research-checklist.md). No diagrams yet.
3. **Diagram + wireframe.** Translate the locked structure with
   [`../agents/diagram-agent.md`](../agents/diagram-agent.md) and
   [`../agents/wireframe-agent.md`](../agents/wireframe-agent.md). Optional Mermaid helper:
   [`../scripts/generate_flow.py`](../scripts/generate_flow.py).
4. **Validation.** Run [`../agents/validation-agent.md`](../agents/validation-agent.md) against
   platforms × surfaces, decision exits, and recovery completeness.
5. **Critic.** Gate with [`../agents/critic-agent.md`](../agents/critic-agent.md). Max two rewrite
   cycles. Check [`../references/anti-patterns.md`](../references/anti-patterns.md). Format:
   [`../references/report-template.md`](../references/report-template.md). Method:
   [`../references/flow-mapping-method.md`](../references/flow-mapping-method.md). Worked example:
   [`../references/examples/checkout-walkthrough.md`](../references/examples/checkout-walkthrough.md).

Preserve unresolved product decisions instead of smoothing them away. Prefer
`.forsvn/artifacts/product/map-user-flow/` for durable flow artifacts. Never invent platform support
the product does not ship.
