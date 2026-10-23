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
release/                 Generated payload integrity manifests
docs/                    Product and contributor references
docs-site/               Published documentation source
.github/workflows/       CI and separately authorized publication
```

List tracked paths with `git ls-tree -r --name-only HEAD`.

## Data and execution flow

A host request enters the parent skill or API/MCP tool. The briefing engine
in [tools/brief.mjs](tools/brief.mjs) selects packaged methods and supplied
context. The host runs the work and checks the result. The app API reads
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
