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
- Treat browser, image generation, publishing, and analytics connectors as optional tools.
- Ask for approval immediately before any send, publish, spend, credential, or external write.

The complete coding-agent plugin installs `conquistador` and its compact outcome skills. Conquistador
selects them privately; users may also install a single outcome skill with a generic skill installer.
The host remains responsible for tools, permissions, memory, and thread continuity.

This adapter is the coding-agent plugin door. It is not the Eve agent package, not official xAI Grok
Bot, not Grok CLI, not the single-agent package, and not the advisor/worker squad.
Candidate Eve and Grok Bot packages live in `hosts/` of the product repository. Candidate agent and
squad packages live in `agents/`. Those trees stay out of this portable plugin.

