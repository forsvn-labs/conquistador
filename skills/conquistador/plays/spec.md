---
command: spec
label: Specify a product experience
intents: ["product spec","specify the product experience","product experience spec","feature spec","screens and flows spec"]
chain:
  - { command: flow }
  - { command: ui, when: "the structural flow is accepted" }
  - { method: implementation-planning }
  - { method: service-extraction, when: "the experience needs a service boundary" }
legacy: specify-product-experience
---
# Specify a product experience

Use only when the user explicitly asks for this engineering outcome and a product result spans
screens, states, decisions, native surfaces, and a buildable interface specification.

1. Use `flow` to enumerate known platforms and surfaces, ground every transition in the job,
   cover happy path and failure/recovery states, and define validation cases. When the user requests a
   portable specification and the platform is genuinely undecided, use its bounded
   `platform-unresolved` mode: specify only platform-neutral logic, label platform/native behavior as
   an open decision, and keep implementation blocked until a target is supplied.
2. After the structural flow is accepted, use `ui` to trace screens and components to
   flow nodes, apply semantic design tokens, and specify interaction, responsive, accessibility, and
   recovery behavior.
3. Use the [implementation-planning](../methods/implementation-planning.md) method to order work, dependencies, tests, rollout, and review.
4. Use the [service-extraction](../methods/service-extraction.md) method only when the accepted experience truly requires a service or
   integration boundary.

Challenge a happy path longer than seven user actions. Do not invent screens, raw style values,
product behavior, or a new brand system. This composes a product-operator specification; implementation
occurs only when explicitly requested.

Supplied semantic token names are the complete authority for the token pass. Do not add recovered
prefixes, placeholder tokens, house defaults, or raw values. If a visual or accessibility check needs
resolved values, record the check as unresolved rather than replacing the supplied token.

End with one terminal Review Packet for final human review: accepted flow, complete UI specification,
implementation order, evidence/assumption boundary, and one next action.
