# Sequential fallback

Use when the host cannot run intake-validator, screen-inventory, component-system,
token-application, layout-state, handoff, and critic as separate agents.

Keep the same method. Change only the machinery. Label this single-context. Do not call it
independent corroboration.

1. Prove the source flow per `COMMAND.md`. Prefer an existing `flow` artifact; if none exists,
   run compact flow validation inside this skill (job, entry, success, stable nodes, transitions,
   branches, failure/recovery, unresolved decisions). Do not invent product behavior.
2. Apply the recovered lenses in this order, using each matching file as a sequential pass:
   1. [intake-validator](../agents/intake-validator-agent.md)
   2. [screen-inventory](../agents/screen-inventory-agent.md)
   3. [component-system](../agents/component-system-agent.md)
   4. [token-application](../agents/token-application-agent.md)
   5. [layout-state](../agents/layout-state-agent.md)
   6. [handoff](../agents/handoff-agent.md)
   7. [critic](../agents/critic-agent.md)
3. Enforce the 8-checkpoint rubric in [`../references/gates-and-rubric.md`](../references/gates-and-rubric.md).
   On FAIL, revise the named weak unit (max two cycles) rather than softening a checkpoint.
4. Follow [`../references/ui-brief-method.md`](../references/ui-brief-method.md),
   [`../references/format-conventions.md`](../references/format-conventions.md), and
   [`../references/anti-patterns.md`](../references/anti-patterns.md).
5. Emit a portable SPEC, never rendered UI. Prefer
   `.forsvn/artifacts/product/brief-product-ui/` for durable artifacts.

Never invent screens, raw brand tokens, metrics, or consent. Keep rendering, publishing, and
external writes behind explicit approval.
