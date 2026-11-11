# Structure

[forsvn-labs/conquistador](https://github.com/forsvn-labs/conquistador) owns the
public product. CLI, app API, plugins, and MCP consume one method library.

## At a glance

```text
skills/conquistador/     Parent skill, commands, plays, and playbooks
runtime/src/             Authored CLI and runner source
runtime/lib/             Maintained runtime output
catalog/                 Typed provider contracts and fixtures
evals/                   Evidence and evaluation contracts
api/                     Public app imports and MCP mounts
mcp/                     Local MCP entry
worker.mjs               Hosted MCP entry
wrangler.toml            Hosted Worker configuration
Dockerfile               Container image definition
tools/                   Briefing, installers, checks, packaging, and E2E
hooks/                   Host prompt hooks
hosts/                   Host-specific integration contracts
agents/                  Portable roles, schemas, and native agents
assets/                  Required runtime assets
packages/conquistador/   Exact-version short CLI alias
examples/                App imports and Composio registration examples
release/                 Generated payload integrity manifests
docs/                    Product, contributor, and verification references
docs-site/               Published documentation source
.github/workflows/       CI and separately authorized publication
```

List tracked paths with `git ls-tree -r --name-only HEAD`.

## Code

| Path | Responsibility |
| --- | --- |
| `tools/brief.mjs`, `tools/context-selection.mjs` | Method routing and admission before retrieval; FACTS_CHANNELS names dated channel facts |
| `tools/search-index.json`, `tools/update-completeness.mjs` | Generated bundled search terms, source-digest checks, and regeneration |
| `tools/method-copies.json`, `tools/method-copies.mjs` | One editable source per byte-identical method group, synchronization, and drift checks |
| `tools/method-policy.mjs` | Shared entry defaults for briefing, app contexts, specialists, installs, MCP discovery, and bot exports |
| `tools/prompt-advice.mjs`, `tools/read-evidence.mjs` | Shared hook advice, transcript-scoped reuse, and returned-resource byte verification |
| `tools/launch.mjs`, `tools/installation-methods.mjs` | Reviewed installation plans and the four installation routes |
| `tools/distill.mjs` | Contributor-only licensed-source distillation |
| `tools/freshness.mjs` | Contributor-only review-date check for dated facts and plays |
| `api/`, `mcp/`, `worker.mjs` | App imports reuse the MCP engine; local and hosted transports |
| `SKILL.md`, `plugin.json`, `mcp.json`, `com.github.copilot/` | Authoring entry and host metadata; plugin overlays live in the hidden plugin folders |
| `kit/`, `context7.json`, `package.json` | HTML review templates, documentation indexing, and package exports/scripts |

Entry points: `runtime/bin/conquistador.js`, `api/index.mjs`, `mcp/server.mjs`,
and `worker.mjs`. Commands: `npm run bootstrap`, `npm run build`, `npm test`,
`npm run package`. [CONTRIBUTING.md](CONTRIBUTING.md) owns their prerequisites and limits.

## Read before changing

- [docs/PRODUCT-CONTRACT.md](docs/PRODUCT-CONTRACT.md) before behavior changes.
- [CONTRIBUTING.md](CONTRIBUTING.md) before source, packaging, or installer changes.
- [docs/INSTALLATION-ARCHITECTURE.md](docs/INSTALLATION-ARCHITECTURE.md) and
  [docs/INSTALLATION-ACCEPTANCE.md](docs/INSTALLATION-ACCEPTANCE.md) before setup or host changes.
- [docs/DISTILL.md](docs/DISTILL.md) before distilling sources.
- [docs/META-WATCH.md](docs/META-WATCH.md) before adding or updating dated facts and plays.

Where new work goes:

| To add | Put it in |
| --- | --- |
| A command or play | `skills/conquistador/commands/` or `skills/conquistador/plays/` |
| CLI or runner logic | `runtime/src/`; compile maintained output through the build |
| A provider contract or evaluation | `catalog/` or `evals/` |
| App tools or host integration | `api/` or `hosts/` |
| Public contributor guidance | `docs/` |

Conventions: commands have short ENTRY.md guides and detailed COMMAND.md procedures.
Kept plays preserve their declared method dependencies. The host runs the work and
checks the result. Host configuration and credentials retain their own owners.

## Knowledge

| Location | Contents |
| --- | --- |
| Google Drive, key `forsvn/conquistador` | Private planning, research, media originals, exports, and verification captures; resolve in the owner's private registry |
| `docs/progress-log.md` | Preserved legacy snapshot with original evidence dates and limits |

New knowledge follows [BRAIN.md](BRAIN.md). Each item has one editable original.

## Other documents

- [README.md](README.md): setup. [CHANGELOG.md](CHANGELOG.md): shipped history.
- [INSTALL.md](INSTALL.md): install routes. [MIGRATION.md](MIGRATION.md): installation migration.
- [VERSIONS.md](VERSIONS.md): version policy. [NOTICE.md](NOTICE.md): licensing notices.
- [docs/performance/thin-surfaces.md](docs/performance/thin-surfaces.md): loader inventory and repeatable checks.
- [docs/performance/REVIEW.md](docs/performance/REVIEW.md): API, CLI, hook, plugin, transport, packaging, and hosted checks.
- [docs/BEHAVIOR-REVIEW-2026-10.md](docs/BEHAVIOR-REVIEW-2026-10.md): task-scoped behavior evidence.
- `AGENTS.md` and `CLAUDE.md`: agent entrypoints.
