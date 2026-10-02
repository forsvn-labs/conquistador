---
command: landing
label: Create a landing page
intents: ["create a landing page","build a landing page","new landing page","landing page from scratch","design a landing page","landing page and build brief"]
chain:
  - { command: position, when: "audience, promise, proof, or alternatives are unresolved" }
  - { command: copy, for: "section argument and final copy" }
  - { command: creative, for: "build brief, asset slots, states" }
  - { command: convert, for: "decision path and one test" }
  - { method: share-card-verification, when: "the page must render correctly when shared" }
legacy: create-landing-page
---
# Create a landing page

Use when the user needs a complete page argument and implementation-ready handoff.

1. Use `position` when audience, costly moment, promise, mechanism, proof, objection, or
   alternatives remain unresolved.
2. Use `copy` for the complete section argument and final copy.
3. Use `creative` for hierarchy, real or labeled-representative asset slots, responsive behavior,
   states, accessibility, and build acceptance.
4. Use `convert` to verify the decision path and define one discriminating test.
5. Use the [share-card-verification](../methods/share-card-verification.md) method when the live or staged page must render correctly when
   shared.

Load the landing method under [landing/](landing/) (architecture,
hypothesis, section spec, conversion critic, visitor decisions) and its versioned review contract.

Match the method to the requested delivery mode. A bounded inline request may return the
page argument, section copy, responsive build brief, claim boundary, and first test in the terminal
Review Packet. It does not require project brand files, a 250-line artifact, companion handoff files,
or approval of intermediate hypotheses. Treat supplied brand facts and semantic token names as the
available brand source; label missing visual values and real assets instead of inventing them. Use the
full file-oriented method only when the user asks for persistent artifacts or an execution handoff.
Use the evidence-bound page argument and one useful test in either mode. The retired formula-based
rubric does not apply; use `landing-decision-review-v1` and preserve UNKNOWN checks.
Do not choose a web framework, emit `index.html`, or write a companion implementation prompt. If a later
implementation handoff is requested and no stack is verified, label the stack unresolved.

Every section must advance the same decision spine. Do not invent customers, metrics, compatibility,
product behavior, or decorative proof. Keep implementation and live deployment behind explicit scope.

End with one terminal Review Packet for final human review: strategic bet, finished copy, build brief,
claim boundary, first test, and one next action. Review is advisory for a bounded brief. Explicit
approval remains required before implementation, publication, deployment, or another external action.
