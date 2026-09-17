# Portable master-agent routing

Use the parent as the main entry point. The `operator` setup target, also available as `harness` with --path, installs
the portable master-agent contract, operator profile, specialist assignment files, BB adapter, and
all 38 outcome skills. The consuming host decides whether it can create isolated specialists. Select
only the roles and outcomes needed for the request. Preserve the user's scope and the host's declared
capabilities. Default activation is `manual`; `project` routing needs a host adapter that calls admitRequest.
Setup does not register that adapter. Load the parent entry identified by canonicalSkillRoot in agent/agent.json in a fresh
host session. Off disables the admission function, not direct file access.

- Resolve sibling links relative to the installed parent tree, including when a wrapper loads it
  from a bundled library. Do not assume that all skill bodies are already in context.
- Load an outcome only when its `SKILL.md` is available on disk. If it is missing, do not invent its
  body or fetch it. Use available parent methods for work they support and state any capability gap.
- Load more outcomes or references only when needed for the requested result. A marketing request
  about an app does not authorize an engineering task.
- Workflow Markdown, including `content-intelligence-loop`, is skill composition. Do not claim an
  executable playbook ran without a real runner trace.
- Follow the specialist team contract when more than one role is needed. If the host cannot create
  isolated contexts, run the assignments in sequence and do not claim independent review.
- Keep send, publish, spend, deployment, and external writes behind explicit human authority.

The fixed advisor/worker squad has separate role constraints in [squad.md](squad.md). It is a
different package from the host-bounded specialist team. A same-context review does not establish
independent review.
