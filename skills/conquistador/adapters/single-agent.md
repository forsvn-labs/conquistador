# Single-agent routing

Use the parent as the main entry point. A complete single-agent install supplies the parent and all
38 outcome skills. Select only the outcome needed for the request, including engineering work when
requested. Preserve the user's scope and the host's declared role.

- Resolve sibling links relative to the installed parent tree, including when a wrapper loads it
  from a bundled library. Do not assume that all skill bodies are already in context.
- Load an outcome only when its `SKILL.md` is available on disk. If it is missing, do not invent its
  body or fetch it. Use available parent methods for work they support and state any capability gap.
- Load more outcomes or references only when needed for the requested result. A marketing request
  about an app does not authorize an engineering task.
- Workflow Markdown, including `content-intelligence-loop`, is skill composition. Do not claim an
  executable playbook ran without a real runner trace.
- Keep send, publish, spend, deployment, and external writes behind explicit human authority.

The advisor/worker squad has separate role constraints in [squad.md](squad.md). A single-agent
review does not establish independent review.
