# Anatomy

[forsvn-labs/conquistador](https://github.com/forsvn-labs/conquistador) owns the
public product. CLI, app API, plugins, and MCP consume one method library.

## Tech stack

| Layer | Technology and boundaries |
| --- | --- |
| CLI and distribution | Node.js 22.18+, ES modules, paired npm packages `conquistador` and `@forsvn/conquistador`; see [package manifest](package.json) and [CLI package](packages/conquistador/package.json). |
| Self-hosted runtime | Node.js 24+, TypeScript 7, jose for signed identity, Ajv for contract tests, and Vitest. See [runtime manifest](runtime/package.json) and [container image](Dockerfile). |
| Catalog and evaluation | Typed provider contracts in [catalog](catalog/); TypeScript and Vite tooling, with test scenarios in [evals](evals/). |
| MCP | [Local entry](mcp/) and [hosted Cloudflare Worker](worker.mjs); the hosted path uses Cloudflare OAuth Provider and Wrangler. |
| Checks and delivery | Bun lockfile and Node orchestration in [tools/dev.mjs](tools/dev.mjs); Oxlint, Playwright, and [GitHub Actions](.github/workflows/) for verification and publishing. Passing CI is not publication. |

### Build and release evidence

- The public Node.js CLI requires Node.js ≥22.18 from the root manifest; runtime source requires Node.js ≥24 from its own manifest and the container. The maintainer workflows and image are separate from user install requirements.
- The paired npm packages and the hosted Cloudflare MCP have distinct release evidence. The last recorded package release is 0.13.1; the last recorded hosted methods are 0.13.0 with named keys. See [PROGRESS.md](PROGRESS.md), [installation verification](docs/INSTALLATION-ACCEPTANCE.md), and the separately gated [publish workflow](.github/workflows/publish.yml).
- The integration catalog, evaluation harness, examples and Eve/Executor adapters below are separate source surfaces. Presence here does not imply their providers are connected. The Worker configuration is [wrangler.toml](wrangler.toml); build images are [runtime](Dockerfile) and [local MCP](mcp/Dockerfile).

### Direct dependencies

Declared specs are manifest constraints, not installed versions. Locked versions come from the cited checked-in lockfile, not a live deployed host. “Not verified” means no single corresponding resolution could be established from that source. Transitive dependencies remain in the lockfiles.

#### Integration catalog

Evidence: [catalog/package.json](catalog/package.json) and [catalog/package-lock.json](catalog/package-lock.json). Declares `node` `>=22.22.0`.

| Direct dependency | Declared spec | Locked version | Role |
| --- | --- | --- | --- |
| `@oxlint/plugins` | `1.82.0` | `1.82.0` | Development · lint rule integration |
| `@types/node` | `22.20.1` | `22.20.1` | Development · development type declarations |
| `oxlint` | `1.82.0` | `1.82.0` | Development · source linting |
| `typescript` | `7.0.2` | `7.0.2` | Development · type checking and TypeScript tooling |
| `vitest` | `4.1.12` | `4.1.12` | Development · frontend or TypeScript test runner |

#### Documentation site

Evidence: [docs-site/package.json](docs-site/package.json) and [docs-site/bun.lock](docs-site/bun.lock).

| Direct dependency | Declared spec | Locked version | Role |
| --- | --- | --- | --- |
| `mint` | `4.2.991` | `4.2.991` | Development · Mintlify docs preview, build validation and link checking |

#### Evaluation harness

Evidence: [evals/package.json](evals/package.json) and [evals/package-lock.json](evals/package-lock.json). Declares `node` `>=22.22.0`.

| Direct dependency | Declared spec | Locked version | Role |
| --- | --- | --- | --- |
| `ajv` | `8.20.0` | `8.20.0` | Development · JSON Schema validation and formats |
| `vitest` | `4.1.12` | `4.1.12` | Development · frontend or TypeScript test runner |

#### Isolated Promptfoo evaluation

Evidence: [evals/promptfoo-isolated/package.json](evals/promptfoo-isolated/package.json) and [evals/promptfoo-isolated/package-lock.json](evals/promptfoo-isolated/package-lock.json). Declares `node` `>=22.22.0`.

| Direct dependency | Declared spec | Locked version | Role |
| --- | --- | --- | --- |
| `promptfoo` | `0.124.1` | `0.124.1` | Runtime · model evaluation harness |

#### Composio example

Evidence: [examples/composio/package.json](examples/composio/package.json) and [examples/composio/bun.lock](examples/composio/bun.lock). Declares `node` `>=22.18`.

| Direct dependency | Declared spec | Locked version | Role |
| --- | --- | --- | --- |
| `@composio/core` | `0.27.0` | `0.27.0` | Runtime · Composio app-registration example |

#### Verification gate example

Evidence: [examples/verify-gate/package.json](examples/verify-gate/package.json) and [examples/verify-gate/bun.lock](examples/verify-gate/bun.lock). Declares `node` `>=24`.

| Direct dependency | Declared spec | Locked version | Role |
| --- | --- | --- | --- |
| `@anthropic-ai/claude-agent-sdk` | `0.3.292` | `0.3.292` | Runtime · Claude Agent SDK verification-gate example |
| `@modelcontextprotocol/sdk` | `1.32.1` | `1.32.1` | Runtime · MCP protocol types and transport |
| `zod` | `4.1.12` | `4.1.12` | Runtime · runtime schema validation |

#### Eve runtime adapter

Evidence: [hosts/eve/runtime/package.json](hosts/eve/runtime/package.json) and [hosts/eve/runtime/bun.lock](hosts/eve/runtime/bun.lock). Declares `node` `>=24`.

| Direct dependency | Declared spec | Locked version | Role |
| --- | --- | --- | --- |
| `ai` | `7.0.143` | `7.0.143` | Runtime · AI SDK provider and generation interfaces |
| `eve` | `0.80.1` | `0.80.1` | Runtime · Eve runtime integration |
| `just-bash` | `3.6.0` | `3.6.0` | Runtime · local Bash-compatible sandbox for the Eve adapter |
| `@types/node` | `26.6.5` | `26.6.5` | Development · development type declarations |
| `typescript` | `7.0.2` | `7.0.2` | Development · type checking and TypeScript tooling |

#### Executor host integration

Evidence: [hosts/executor/package.json](hosts/executor/package.json) and [hosts/executor/bun.lock](hosts/executor/bun.lock). Declares `node` `>=24`.

| Direct dependency | Declared spec | Locked version | Role |
| --- | --- | --- | --- |
| `@modelcontextprotocol/sdk` | `1.32.1` | `1.32.1` | Runtime · MCP protocol types and transport |
| `executor` | `2.0.0-beta.25` | `2.0.0-beta.25` | Development · Executor CLI for native host integration checks |

#### Root package

Evidence: [package.json](package.json) and [bun.lock](bun.lock). Declares `node` `>=22.18`.

| Direct dependency | Declared spec | Locked version | Role |
| --- | --- | --- | --- |
| `jose` | `6.2.8` | `6.2.8` | Runtime · JWT/JWS signing, verification or identity checks |
| `pele` | `1.13.0` | `1.13.0` | Runtime · diagram rendering in the local CLI tool |
| `@cloudflare/workers-oauth-provider` | `1.2.3` | `1.2.3` | Development · OAuth authorization server for the hosted Worker |
| `@oxlint/plugins` | `1.82.0` | `1.82.0` | Development · lint rule integration |
| `oxlint` | `1.82.0` | `1.82.0` | Development · source linting |
| `playwright` | `1.64.0` | `1.64.0` | Development · real browser automation and regressions |
| `wrangler` | `4.148.0` | `4.148.0` | Development · Cloudflare Worker development, build and release CLI |

#### Short npm alias

Evidence: [packages/conquistador/package.json](packages/conquistador/package.json); no adjacent checked-in lockfile. Declares `node` `>=22.18`.

| Direct dependency | Declared spec | Locked version | Role |
| --- | --- | --- | --- |
| `@forsvn/conquistador` | `0.13.1` | Not verified | Runtime · Conquistador library or published CLI payload |

#### Self-hosted runtime

Evidence: [runtime/package.json](runtime/package.json) and [runtime/package-lock.json](runtime/package-lock.json). Declares `node` `>=24`.

| Direct dependency | Declared spec | Locked version | Role |
| --- | --- | --- | --- |
| `jose` | `6.2.8` | `6.2.8` | Runtime · JWT/JWS signing, verification or identity checks |
| `@types/node` | `24.13.3` | `24.13.3` | Development · development type declarations |
| `ajv` | `8.20.0` | `8.20.0` | Development · JSON Schema validation and formats |
| `typescript` | `7.0.2` | `7.0.2` | Development · type checking and TypeScript tooling |
| `vitest` | `4.1.12` | `4.1.12` | Development · frontend or TypeScript test runner |

#### Terminal interface

Evidence: [tools/tui/package.json](tools/tui/package.json) and [tools/tui/bun.lock](tools/tui/bun.lock).

| Direct dependency | Declared spec | Locked version | Role |
| --- | --- | --- | --- |
| `@clack/prompts` | `1.8.1` | `1.8.1` | Runtime · interactive terminal prompts |
| `ink` | `8.0.0` | `8.0.0` | Runtime · React terminal UI runtime |
| `react` | `19.3.0` | `19.3.0` | Runtime · component UI runtime |
| `esbuild` | `0.28.2` | `0.28.2` | Development · JavaScript bundling |

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
