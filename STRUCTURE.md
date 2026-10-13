# conquistador structure

This Git root owns the files tracked in [forsvn-labs/conquistador](https://github.com/forsvn-labs/conquistador). The repository is public. Keep private planning and external folder identities in the authorized Drive lookup.

VISION.md records purpose. ROADMAP.md owns priorities, active work, blockers, and the live handoff. CHANGELOG.md records verified delivery. STRUCTURE.md maps ownership and working commands. DRIVE.md locates external materials.

## Architecture and ownership

skills/conquistador/ owns command and play methods. runtime/ owns the CLI and runner. catalog/ owns provider tool contracts; evals/ checks evidence. hooks/ and hosts/ adapt loading for clients. mcp/ and worker.mjs expose methods. release/ owns package completeness.

## Source map

| Path | Purpose |
|---|---|
| `VISION.md` | Why this exists, how it plays, and its boundaries |
| `ROADMAP.md` | What will ship, in order |
| `CHANGELOG.md` | What has shipped, by date |
| `skills/conquistador/` | The one host skill: `SKILL.md`, `commands/<command>/COMMAND.md`, `plays/<command>.md`, and shared playbooks |
| `runtime/` | Runner, CLI entry (`runtime/bin/conquistador.js`), and maintained `runtime/lib` output |
| `catalog/` | Typed tools, provider operations, and their fixtures |
| `evals/` | Evidence contracts, benchmarks, and adapters |
| `hosts/` | Installation contracts per host (coding agents, Eve, Executor, Grok Bot) |
| `agents/` | Portable agent, squad, and receipt schemas and packages |
| `hooks/` | Plugin hooks that add the playbook brief (command or play) to prompts |
| `mcp/`, `mcp.json` | Playbook MCP server |
| `worker.mjs`, `wrangler.toml` | Hosted MCP server as a Cloudflare Worker |
| `examples/verify-gate/` | Host gate that accepts drafts only after `conquistador_verify` (repository only, not in the npm package) |
| `kit/` | HTML templates for visual review in Lavish |
| `tools/` | Installer, start flow, packaging, and development helpers; `tools/e2e/` holds the E2E tests |
| `release/` | `completeness.json`, the hash list the installer and doctor check |
| `docs/MASTER-AGENT.md` | Execution modes and the full operating contract |
| `docs/` | Install references, architecture, integrations, and working review documents |
| `assets/` | Plugin icon |
| `.claude-plugin/`, `.codex-plugin/`, `.cursor-plugin/`, `.agents/`, `plugin.json` | Per-agent plugin manifests and marketplaces |
| `.github/workflows/` | CI (`checks.yml`), integration checks, and npm publishing (`publish.yml`) |
| `Dockerfile`, `.dockerignore` | Runtime container image; its build runs the public runtime tests |
| `README.md` | Product overview and install line |
| `INSTALL.md` | Short install commands; points to the docs site |
| `docs-site/` | The Mintlify docs site, <https://conquistador.app/docs> |
| `context7.json` | Tells Context7 to index `docs-site/` |
| `CONTRIBUTING.md` | Development, packaging, and the npm release steps |
| `AGENTS.md`, `CLAUDE.md` | Contributor instructions for coding agents |
| `SKILL.md` | Root pointer to `skills/conquistador/SKILL.md` |
| `VERSIONS.md` | Product and method version policy |
| `MIGRATION.md` | Mapping from old skill and workflow IDs to commands and plays |
| `NOTICE.md`, `LICENSE` | Attribution and MIT license |

## Working commands

- From `.`, run `bun install` before package work. Available commands: `bun run build`, `bun run test`.

Use [README.md](README.md) for setup details and project-specific validation. This record migration does not re-run application release or deployment gates.

## Record history

Useful current work moved to ROADMAP.md where this is a product. Location and repository facts moved here. Earlier exact records remain in Git history:

- [PROGRESS.md at 8b0d400](https://github.com/forsvn-labs/conquistador/blob/8b0d40011e07da4996642f883dbe4ab3613db3d3/PROGRESS.md)
- [INDEX.md at 8b0d400](https://github.com/forsvn-labs/conquistador/blob/8b0d40011e07da4996642f883dbe4ab3613db3d3/INDEX.md)

## External materials and recall

Use DRIVE.md for original media, sendables, and verification evidence. Keep deployable assets needed by a build in Git with their source and license. Mem0 is optional recall through the correct Executor v2 account. Store a scope, project key, source pointer, and truth date; open the current source before using a recalled claim. Do not upload credentials, private identity, medical, finance, or employer-confidential source bodies.
