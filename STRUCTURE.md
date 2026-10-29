# Conquistador structure

[forsvn-labs/conquistador](https://github.com/forsvn-labs/conquistador)
owns the public product. The source has one method library, consumed by
the CLI, app API, plugins, and MCP.

## Selected tracked tree

```text
skills/conquistador/      Parent skill, commands, plays, and playbooks
runtime/src/             CLI and runner source
runtime/lib/             Maintained runtime output
catalog/                 Typed provider contracts and fixtures
evals/                   Evidence and evaluation contracts
api/                     Public app imports and MCP mounts
mcp/                     Local MCP entry
worker.mjs               Hosted MCP entry
tools/                   Briefing, installer, checks, packaging, and E2E
hooks/                   Host prompt hooks
hosts/                   Host-specific integration contracts
agents/                  Portable roles and schemas
packages/conquistador/   Exact-version short CLI alias
examples/composio/       Remote MCP registration and scoped account verification
release/                 Generated payload integrity manifests
docs/                    Product and contributor references
docs-site/               Published documentation source
.github/workflows/       CI and separately authorized publication
```

List tracked paths with `git ls-tree -r --name-only HEAD`.

## Data and execution flow

A host request enters the parent skill or API/MCP tool. The briefing engine
in [tools/brief.mjs](tools/brief.mjs) selects packaged methods and supplied
context. `tools/context-selection.mjs` owns admission before retrieval.
`tools/search-index.json` holds generated bundled search terms; the briefing engine
checks source digests before reuse. `tools/update-completeness.mjs` regenerates it.
`tools/method-copies.json` names the one editable source of each byte-identical method
file group; `tools/method-copies.mjs` syncs the copies and checks them for drift.
Commands have short `ENTRY.md` guides and detailed `COMMAND.md` procedures.
`tools/method-policy.mjs` owns the shared entry defaults used by briefing, app
contexts, specialist assignments, installs, MCP discovery, and bot exports.
Kept plays preserve their declared method dependencies.
`FACTS_CHANNELS` in `tools/brief.mjs` names channel files that hold only dated facts; a thin
route reads one when the request names its platform. `tools/distill.mjs` is a contributor tool
for distilling licensed sources; [docs/DISTILL.md](docs/DISTILL.md) describes it.
`tools/prompt-advice.mjs` owns shared hook advice and transcript-scoped reuse;
`tools/read-evidence.mjs` verifies returned resource bytes. The host runs the work and checks the result. The app API reads
bundled playbooks and caller context. Host configuration and provider
credentials retain their own owners.

[tools/launch.mjs](tools/launch.mjs) and the installer build reviewed
installation plans. [api/](api/) reuses the MCP engine.
[tools/installation-methods.mjs](tools/installation-methods.mjs) owns the
four installation routes. [CONTRIBUTING.md](CONTRIBUTING.md) owns build,
test, packaging, and generated-manifest commands.

## External knowledge

[BRAIN.md](BRAIN.md) resolves `forsvn/conquistador` through the authorized
private Google Drive registry. Drive owns private planning, research,
media originals, exports, and verification captures. Public source keeps
code, methods, licenses, required runtime assets, and code-dependent text.
Private folder identities, account details, and discussions stay in the
private lookup. Each knowledge item has one editable original.
