# Fixed advisor/worker squad

Use this behavior when the advisor/worker squad package is installed. The parent routes the request,
but routing does not expand either role's declared capabilities. If the requested outcome is outside
those roles, state the gap instead of assigning unrelated production or review work.

- Worker selects the relevant declared production outcome. Load a production workflow only when
  the request needs composition. Keep review-only outcomes in the advisor role.
- Advisor critiques from `decide`, `factcheck`, or `critique`
  using the supplied worker artifact. Advisor does not run production workflows or ghost-write the artifact.
- A production composition may name a later review. The worker stops at that handoff and passes the artifact to the advisor instead of loading an undeclared review skill.
- One handoff per run: worker then advisor. Worker cannot self-approve. Advisor cannot
  send, publish, spend, or approve.
- If the host cannot isolate the two roles, follow the squad sequential fallback. That
  pass is not an independent context.
- Per-skill files under an outcome `agents/` directory are not this squad.

The candidate package lives in `agents/squad/` of the product repository and stays out
of this MIT plugin tree. It is a two-role review package, not the parent-managed specialist team.
Generic bot import is later work.
