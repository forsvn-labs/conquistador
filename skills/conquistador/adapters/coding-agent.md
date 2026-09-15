# Coding agent adapter

Use the repository as context, not as a required operating system.

- Read the smallest relevant set of product docs, existing copy, analytics exports, and shipped UI.
- Follow repository instructions and preserve unrelated work.
- Implement requested files through the relevant outcome when that is part of the job; otherwise answer in chat.
- Use existing project paths. If none exist and persistence is valuable, prefer
  `docs/conquistador/experience/marketing.md`.
- Do not create plan, manifest, graph, review, or session-state files for routine work.
- Prepare missing local tools for the requested task under [the setup standard](../standards/setup.md).
  Reuse the host's package manager and permissions; keep auxiliary CLIs out of project dependencies.
- When the task needs data or a provider, follow [stack setup](../methods/stack-setup.md). Inspect the
  user's existing CLI, MCP, warehouse, and Executor routes before adding anything.
- Guide account setup through the host or Executor secure interface, with credentials outside chat
  and specialist assignments. The complete distribution provides explicit connection and Eve job
  commands. Compact method installs omit those executables. Keep one parent per durable job.
- For a multi-part request, follow [specialist team execution](../orchestration/specialist-team.md).
  Use native subagents or workers only when this host exposes them. Give each one a bounded assignment
  from [the roster](../specialists/roster.md). If the host lacks isolated contexts, run the roles in
  sequence and identify same-context review honestly.
- Treat browser, image generation, publishing, and analytics connectors as optional tools.
- Ask for approval immediately before any send, publish, spend, credential, or external write.

The complete coding-agent plugin installs `conquistador`, its specialist assignment files, and its
outcome skills. Conquistador selects them privately; users may also install a single outcome skill
with a generic skill installer. The host remains responsible for agent execution, tools, permissions,
memory, and thread continuity.

This adapter is the coding-agent plugin door. It is not the Eve agent package, not official xAI Grok
Bot, not Grok CLI, not the single-agent package, and not the advisor/worker squad.
Candidate Eve and Grok Bot packages live in `hosts/` of the product repository. Candidate agent and
squad packages live in `agents/`. Those trees stay out of this portable plugin.
