# conquistador structure

This Git root owns the files tracked in [forsvn-labs/conquistador](https://github.com/forsvn-labs/conquistador). The repository is public. Keep private planning and external folder identities in the authorized Drive lookup.

VISION.md records purpose. ROADMAP.md owns priorities, active work, blockers, and the live handoff. CHANGELOG.md records verified delivery. STRUCTURE.md maps ownership and working commands. BRAIN.md locates external materials.

## Architecture and ownership

skills/conquistador/ owns command and play methods. runtime/ owns the CLI and runner. catalog/ owns provider tool contracts; evals/ checks evidence. hooks/ and hosts/ adapt loading for clients. mcp/ and worker.mjs expose methods. release/ owns package completeness.

## Source map

| Path | Purpose |
|---|---|
| `VISION.md` | Why this exists, how it plays, and its boundaries |
| `ROADMAP.md` | Priorities, live handoff, ready-to-ship work, and remaining acceptance |
| `CHANGELOG.md` | What has shipped, by date |
| `skills/conquistador/` | The one host skill: `SKILL.md`, `commands/<command>/COMMAND.md`, `plays/<command>.md`, and shared playbooks |
| `runtime/` | Runner, CLI entry (`runtime/bin/conquistador.js`), and maintained `runtime/lib` output |
| `catalog/` | Typed tools, provider operations, and their fixtures |
| `evals/` | Evidence contracts, benchmarks, and adapters |
| `hosts/` | Installation contracts per host (coding agents, Eve, Executor, Grok Bot) |
| `agents/` | Portable agent, squad, and receipt schemas and packages |
| `hooks/` | Plugin hooks that add the playbook brief (command or play) to prompts |
| `mcp/`, `mcp.json` | Playbook MCP server |
| `packages/conquistador/` | Short npm CLI alias; exact-version dependency on the main package; separate publication |
| `api/` | Public npm app imports and TypeScript declarations: `createConquistador`, and the Node/Fetch MCP mounts |
| `worker.mjs`, `wrangler.toml` | Hosted MCP server as a Cloudflare Worker |
| `examples/verify-gate/` | Host gate that accepts drafts only after `conquistador_verify` (repository only, not in the npm package) |
| `examples/app-integration/` | Runnable app and MCP on one port, included in the npm package |
| `kit/` | HTML templates for visual review in Lavish |
| `tools/` | Installer, start flow, packaging, and development helpers; `tools/e2e/` holds the E2E tests |
| `release/` | `completeness.json`, the hash list the installer and doctor check |
| `docs/MASTER-AGENT.md` | Execution modes and the full operating contract |
| `docs/` | Install references, architecture, integrations, and working review documents |
| `docs/APP-INTEGRATION.md` | Canonical app dependency contract, tool calls, host verification, and deployment guidance |
| `assets/` | Plugin icon |
| `.claude-plugin/`, `.codex-plugin/`, `.cursor-plugin/`, `.agents/`, `plugin.json` | Per-agent plugin manifests and marketplaces |
| `.github/workflows/` | CI (`checks.yml`), installed app E2E (`app-e2e.yml`), integration checks, and npm publishing (`publish.yml`) |
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

From the full source checkout, run `bun install`. Use `bun run bootstrap` for the module lockfiles,
`bun run build` for maintained runtime output and type checks, and `bun run test` for product checks.
`node tools/e2e/installer.mjs --out dist/e2e/installer` records terminal screens and source hashes.
See [CONTRIBUTING.md](CONTRIBUTING.md) for focused checks and package verification.

The terminal front door uses `tools/launch.mjs` and `tools/front-door.mjs`. The Ink UI in
`tools/installer-tui.mjs` and the line flow in `tools/onboard.mjs` build the same installation plan.
`tools/installer-operation.mjs` runs host changes in child processes. `tools/mcp-apps.mjs` manages
client config. `tools/executor-source.mjs` selects the legacy v1 or configured v2
source adapter. `tools/executor-v2.mjs` owns gateway selection, bounded app lifecycle and MCP requests;
`tools/connect.mjs` reads npm or desktop-app version metadata without invoking the CLI;
`tools/executor-capabilities.mjs` owns v2 capability discovery and read verification.
`tools/e2e/executor-v2.mjs` tests the pinned actual native runtime with isolated
state and writes a repeatable report. `hosts/executor/` holds the optional SDK
probe and fixed GitHub metadata callback. These clients do not read browser credentials.

The four public command routes are in `tools/installation-methods.mjs`. They reuse the owned
installer in `tools/launch.mjs` and `tools/onboard.mjs`. Hosted OAuth is isolated in
`tools/hosted-oauth.mjs`; `tools/vendor-oauth.mjs` copies provider 1.2.3 and its MIT license
without modification. The CLI and app API do not load this Worker-only dependency.
`tools/e2e/installation-methods.mjs`, `installation-packages.mjs`, and `oauth.mjs` write JSON
reports outside Git; `.github/workflows/installation-methods.yml` runs them in CI.

`api/` reuses `tools/skills-mcp.mjs` and `tools/mcp-http.mjs`. It exposes the packaged library
without home playbooks or project context discovery. `tools/app-guide.mjs` owns the shared CLI
and TUI app setup text. `tools/e2e/app-integration.mjs --package /path/package.tgz` tests public
imports from an actual installed app and writes repeatable receipts. Use `--installer bun`
and `--runtime /path/to/node` for separate supported-toolchain runs.

`tools/e2e/performance.mjs` measures deterministic app calls and fragmented stdio
frames without a model, network or home discovery. `--source-root` selects a clean
comparison checkout; `--reference` checks output equality. Reports contain source
hashes, raw timing samples and variance. [The October MCP review](docs/MCP-REVIEW-2026-10.md)
records scope, regressions, measured tradeoffs and acceptance limits.

Use [README.md](README.md) for setup details and project-specific validation. This record migration does not re-run application release or deployment gates.

## Record history

Useful current work moved to ROADMAP.md where this is a product. Location and repository facts moved here. Earlier exact records remain in Git history:

- [PROGRESS.md at 8b0d400](https://github.com/forsvn-labs/conquistador/blob/8b0d40011e07da4996642f883dbe4ab3613db3d3/PROGRESS.md)
- [INDEX.md at 8b0d400](https://github.com/forsvn-labs/conquistador/blob/8b0d40011e07da4996642f883dbe4ab3613db3d3/INDEX.md)

## External materials and recall

Use BRAIN.md for original media, sendables, and verification evidence. Keep deployable assets needed by a build in Git with their source and license. Mem0 is optional recall through the correct Executor v2 account. Store a scope, project key, source pointer, and truth date; open the current source before using a recalled claim. Do not upload credentials, private identity, medical, finance, or employer-confidential source bodies.
