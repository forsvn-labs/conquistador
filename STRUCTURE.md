# Structure navigation

Routing authority: this repo record defines the current provider choice for this concern. A shared index is dated navigation only; it cannot override this file. Recheck the configured resource, approved account/scope, safe access route, and verification before use. If mapping or access is unresolved, report it without selecting another account or provider.

Canonical providers: **Drive plus GitHub**.
Project key: `forsvn/conquistador`.

Code: [https://github.com/forsvn-labs/conquistador](https://github.com/forsvn-labs/conquistador). Local source observed at `7cf05341cd2f84ba93a286ae176d43c021a71f08` on 2026-10-24.

Knowledge architecture: Resolve this neutral key in the authorized private tools `project-sources.json` navigation index. The exact Drive architecture document is **pending verification**. Confirm its account, identity, and current map. Structure does not create another Vision, Status, or Katalon Brain.

## Retained local snapshot

The following material was present before the 2026-10-24 vendor-policy refresh. It retains its original evidence dates and is not a second current authority. Vendor mapping, content migration, and current business state were not verified by retaining it. Preserve unique handoff and recovery material until its owning vendor content is verified.

### Conquistador structure

[forsvn-labs/conquistador](https://github.com/forsvn-labs/conquistador)
owns the public product. The source has one method library, consumed by
the CLI, app API, plugins, and MCP.

#### Selected tracked tree

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

#### Data and execution flow

A host request enters the parent skill or API/MCP tool. The briefing engine
in [tools/brief.mjs](tools/brief.mjs) selects packaged methods and supplied
context. `tools/context-selection.mjs` owns admission before retrieval.
`tools/search-index.json` holds generated bundled search terms; the briefing engine
checks source digests before reuse. `tools/update-completeness.mjs` regenerates it.
Commands have short `ENTRY.md` guides and detailed `COMMAND.md` procedures.
`tools/prompt-advice.mjs` owns shared hook advice and transcript-scoped reuse;
`tools/read-evidence.mjs` verifies returned resource bytes. The host runs the work and checks the result. The app API reads
bundled playbooks and caller context. Host configuration and provider
credentials retain their own owners.

[tools/launch.mjs](tools/launch.mjs) and the installer build reviewed
installation plans. [api/](api/) reuses the MCP engine.
[tools/installation-methods.mjs](tools/installation-methods.mjs) owns the
four installation routes. [CONTRIBUTING.md](CONTRIBUTING.md) owns build,
test, packaging, and generated-manifest commands.

#### External knowledge

[BRAIN.md](BRAIN.md) resolves `forsvn/conquistador` through the authorized
private Google Drive registry. Drive owns private planning, research,
media originals, exports, and verification captures. Public source keeps
code, methods, licenses, required runtime assets, and code-dependent text.
Private folder identities, account details, and discussions stay in the
private lookup. Each knowledge item has one editable original.
