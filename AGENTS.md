# Conquistador contributor instructions

For a complete product checkout, use the instructions below. A portable-only plugin contains
skills and documentation; its host loads the skill contracts and does not run these development
commands.

This is the editable product source of the public npm package `@forsvn/conquistador`. First read
INDEX.md and the four horsemen: VISION.md, ROADMAP.md, PROGRESS.md (unshipped work), and
CHANGELOG.md (shipped work). Then read README.md, CONTRIBUTING.md, INSTALL.md, and the
relevant module README before changing behavior. Node 24 or later and npm are the supported local toolchain.
This repository owns product code and its release evidence.

- The repository and the npm package are public. Do not push, tag, publish to npm, or merge
  without the user's explicit authorization. Local commits and local packages are allowed.
- `skills/<outcome>/` owns an independently usable method. `skills/conquistador/` owns parent routing.
- `runtime/`, `catalog/`, and `evals/` own runner, typed tools, and evidence contracts.
- `hosts/` and `agents/` contain installation contracts; `tools/` contains local development helpers.
- The repository root is the plugin (Claude Code, Codex, Cursor, Copilot, Agent Plugins). `tools/brief.mjs`
  ranks the playbooks for a task; `mcp/server.mjs`, `hooks/conquistador-hook.mjs`, `conquistador brief`,
  and `conquistador bot` all use it. `tools/front-door.mjs` and `tools/agents.mjs` own the agent installer;
  `tools/launch.mjs` owns the start flow (task picker, agent launch).
- After adding, renaming, or removing a knowledge file, run `node tools/knowledge-map.mjs` and
  `node tools/update-completeness.mjs`. `node tools/knowledge-map.mjs --check` must pass.
  After any plugin payload edit (including hooks, briefing helpers, and README), regenerate `release/plugin-completeness.json` with
  `node tools/update-completeness.mjs`; never hand-edit its expected hashes.
- E2E: `node tools/e2e/routing-breadth.mjs` (offline; marketing breadth, coding silence, tour drift),
  `expect tools/e2e/agent-first.exp` (bare `conquistador` to a pre-filled Claude Code and Codex, isolated
  home, no model call), `node tools/e2e/package-install.mjs` (installs the package from Git and `npx`
  as users do, all detected agents, isolated homes; needs `script` and `expect`, which Windows lacks, so
  those checks report "not run" there; CI runs it on Linux and Windows through `install-e2e.yml`),
  `node tools/e2e/update-latest.mjs` (`conquistador update` against a local Verdaccio registry, all agents),
  and `node tools/e2e/knowledge-use.mjs [--set breadth]` (headless Claude Code; spends tokens). Reports go to `dist/e2e/`.
- Router phrases: curated `intents` describe a method; practitioner wording that only selects it goes
  in `aliases` in `skills/conquistador/routing-overlay.json`. Rebuild with `writeRoutingContract`.
- `tools/tour.mjs` owns the capability areas. After editing it, run `node tools/tour.mjs --write`.
- Keep methods original and retain applicable MIT license and notices. Never add private knowledge,
  customer transcripts, credentials, internal decisions, or private workspace history to this repo.
- Select the relevant skill; do not load the whole library. Preserve explicit human authority for
  publication, spend, external actions, and feedback disclosure. Use Executor for authorized live calls.
- Do not turn synthetic fixtures, passing tests, or local package records into live/provider/human proof.
- Start other programs through `spawnCommand` in `tools/spawn.mjs`, not `spawn` or a shell, so
  Windows `.cmd` agents and npm start with exact arguments.
- Run `npm run build` and `npm test` after code changes. Use focused module tests while iterating.
  Keep maintained runtime/lib output in sync with source and commit it when source changes.
- `npm run package` creates local unbound artifacts from a clean exact Git commit. It does not
  publish, sign, grant approval, or complete release acceptance. No remote action is implicit.

Default tests and development commands are self-contained. `test:source` and historical
candidate-authority tools are maintainer interfaces for the separate private evidence workspace;
they are not public checkout prerequisites. Missing private authority must fail closed.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
