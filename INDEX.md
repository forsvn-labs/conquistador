# Conquistador index

Map of this repository. Read with `AGENTS.md` and the four horsemen.

## Horsemen

| Path | What it is |
|---|---|
| `VISION.md` | Why this exists, how it plays, and its boundaries |
| `ROADMAP.md` | What will ship, in order |
| `PROGRESS.md` | Implemented, not yet shipped |
| `CHANGELOG.md` | What has shipped, by date |

## Layout

| Path | What it is |
|---|---|
| `skills/conquistador/` | The one host skill: `SKILL.md`, `commands/<command>/COMMAND.md`, `plays/<command>.md`, and shared playbooks |
| `runtime/` | Runner, CLI entry (`runtime/bin/conquistador.js`), and maintained `runtime/lib` output |
| `catalog/` | Typed tools, provider operations, and their fixtures |
| `evals/` | Evidence contracts, benchmarks, and adapters |
| `hosts/` | Installation contracts per host (coding agents, Eve, Executor, Grok Bot) |
| `agents/` | Portable agent, squad, and receipt schemas and packages |
| `hooks/` | Plugin hooks that add the playbook brief (command or play) to prompts |
| `mcp/`, `mcp.json` | Playbook MCP server |
| `api/`, `vercel.json`, `.vercelignore` | Hosted MCP server as a Vercel function |
| `tools/` | Installer, start flow, packaging, and development helpers; `tools/e2e/` holds the E2E tests |
| `release/` | `completeness.json`, the hash list the installer and doctor check |
| `docs/MASTER-AGENT.md` | Execution modes and the full operating contract |
| `docs/` | Install references, architecture, integrations, and working review documents |
| `assets/` | Plugin icon |
| `.claude-plugin/`, `.codex-plugin/`, `.cursor-plugin/`, `.agents/`, `plugin.json` | Per-agent plugin manifests and marketplaces |
| `.github/workflows/` | CI (`checks.yml`), integration checks, and npm publishing (`publish.yml`) |
| `Dockerfile`, `.dockerignore` | Runtime container image; its build runs the public runtime tests |

## Top-level documents

| Path | What it is |
|---|---|
| `README.md` | Product overview and install line |
| `INSTALL.md` | Install, update, and removal |
| `CONTRIBUTING.md` | Development, packaging, and the npm release steps |
| `AGENTS.md`, `CLAUDE.md` | Contributor instructions for coding agents |
| `SKILL.md` | Root pointer to `skills/conquistador/SKILL.md` |
| `VERSIONS.md` | Product and method version policy |
| `MIGRATION.md` | Mapping from old skill and workflow IDs to commands and plays |
| `NOTICE.md`, `LICENSE` | Attribution and MIT license |
