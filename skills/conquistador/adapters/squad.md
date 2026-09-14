# Advisor/worker squad

Use this behavior when the advisor/worker squad package is installed.

- Worker produces from `write-copy`, `write-social`, or `brief-creative` and a named
  production workflow.
- Advisor critiques from `decision-panel`, `knowledge-review`, or `fresh-eyes-review`
  and a named review workflow. Advisor does not ghost-write the artifact.
- One handoff per run: worker then advisor. Worker cannot self-approve. Advisor cannot
  send, publish, spend, or approve.
- If the host cannot isolate the two roles, follow the squad sequential fallback. That
  pass is not an independent context.
- Per-skill files under an outcome `agents/` directory are not this squad.

The candidate package lives in `agents/squad/` of the product repository and stays out
of this MIT plugin tree. Generic bot import is later work.
