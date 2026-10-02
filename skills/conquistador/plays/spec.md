# Specify-product-experience workflow

This workflow is parent-routed skill composition, not an executable playbook. Load it only when the
requested product specification needs multiple outcomes. A narrow flow or UI request can use its
primary outcome alone.

Use it only when the user explicitly asks for this engineering outcome and a product result spans
screens, states, decisions, native surfaces, and a buildable interface specification.

1. Use `map-user-flow` to enumerate known platforms and surfaces, ground every transition in the job,
   cover happy path and failure/recovery states, and define validation cases. When the user requests a
   portable specification and the platform is genuinely undecided, use its bounded
   `platform-unresolved` mode: specify only platform-neutral logic, label platform/native behavior as
   an open decision, and keep implementation blocked until a target is supplied.
2. After the structural flow is accepted, use `brief-product-ui` to trace screens and components to
   flow nodes, apply semantic design tokens, and specify interaction, responsive, accessibility, and
   recovery behavior.
3. Use the `implementation-planning` method to order work, dependencies, tests, rollout, and review.
4. Use the `service-extraction` method only when the accepted experience truly requires a service or
   integration boundary.

Challenge a happy path longer than seven user actions. Do not invent screens, raw style values,
product behavior, or a new brand system. This composes a product-operator specification; implementation
occurs only when explicitly requested.

Supplied semantic token names are the complete authority for the token pass. Do not add recovered
prefixes, placeholder tokens, house defaults, or raw values. If a visual or accessibility check needs
resolved values, record the check as unresolved rather than replacing the supplied token.

End with one terminal Review Packet for final human review: accepted flow, complete UI specification,
implementation order, evidence/assumption boundary, and one next action.
