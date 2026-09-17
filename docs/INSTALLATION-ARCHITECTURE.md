# Installation architecture and specification

Conquistador separates package acquisition, owned file installation, host activation, and task
execution. One successful step does not certify the next. This document specifies the installer;
release and observed validation state belong in PROGRESS.md.

## Entry points

`runtime/bin/conquistador.js` dispatches `install`, `operator`, `setup`, and local `mcp` before
importing the optional runtime. Setup needs Node 24 and core Node modules, not a build or bootstrap.
`tools/operator-setup.mjs` preserves the concise project operator commands and relative project paths.
Bare runtime `status` and `doctor` retain their existing meanings.

`tools/setup.mjs` parses and applies managed actions. `setup-routes.mjs` declares the forms, targets,
default project folders, and capability boundaries. `setup-guide.mjs` collects an installation plan
without writing. The default guide asks one route question, uses the current project, shows the
complete payload and destination, and asks once before applying. Other forms select a host and
owned folder. Lifecycle actions use explicit subcommands with a target or path.

`setup list [--json]` lists supported forms, not a global installation inventory. Installation
receipts remain local. There is no background discovery, registry, host-settings crawler, or updater.

## Payload contract

| Payload | Required content | Execution boundary |
| --- | --- | --- |
| Operator / harness | Parent, 38 methods, manual profile, portable contracts, schemas, compatibility metadata, BB adapter | Host executes; harness remains an alias |
| Native plugin source | Complete operator inventory plus host discovery metadata and native Claude agent | Original manager owns activation, trust, cache, and scope |
| Compact skill | Parent, 38 methods, manual profile, completeness manifest, helpers and usage docs | No BB adapter or portable agent schemas; host follows skill contracts |
| Squad | Worker and advisor contracts, declared method subsets, sequential fallback | Host adapter supplies contexts; not full operator parity |
| Local MCP | Owned bundle of server, skills, manifest, and operator inventory | Read-only method tools; copying the adapter does not execute it |
| Runtime MCP | Command/args connector to stable distribution and service | Declared playbooks and persisted artifacts; separate runtime lifecycle |
| Experimental imports | Guide handoff only | No installation or native activation claim |

Domain selection retains its existing restriction file and validation. Domain and standalone skill
copies cannot pass the full-library doctor. MCP does not interpret domain-restriction.json; do not
use full-library MCP to bypass a host's domain access boundary.

## Ownership and mutation

`tools/install.mjs` continues to stage ordinary payloads beside the destination, verify ownership,
rename the original aside, and restore it if replacement fails. Existing
`conquistador.public-install/v1` receipts, `single-agent` mode, and `harness` alias remain valid.
An edited, unowned, linked, or special-file payload must not be replaced or removed.
Outputs, knowledge roots, host routing, client registration, credentials, and runtime data remain
outside installer ownership. Source changes do not silently update installed copies.

Every guided complete or compact/library installation runs read-only doctor afterward. Doctor
failure returns a failure status and leaves the installed owned copy available for inspection.
Successful local checks still report host activation, provider use, and task execution as unverified.
No native manager command is executed by setup. Generated commands are instructions for the
selected host/version and original scope. Windows output is labeled as PowerShell.

## MCP durability

`tools/setup-mcp.mjs` stages local MCP under `INSTALL/bundle/` using regular-file copies from a
bounded source inventory. `connector.json` points at the final owned path and current Node
executable. The existing receipt digest covers the connector and copied files. No package manager,
network request, dependency installation, or host registration occurs during that staging.

Deleting the acquisition cache or source cannot remove this local server. Moving the installed
folder or replacing Node can still invalidate client configuration. Repair uses `setup update
--path ABS` from the intended current release; then the user replaces the client's saved connector
and restarts it. The same update migrates unchanged legacy connector-only local copies. Edits still
block repair and must be preserved.

Runtime MCP does not copy a service or dependency tree. It requires a stable complete distribution
with built runtime and its installed dependency. Known npm/Bun cache roots fail before any connector
write. `--runtime-path ABS` selects a separate stable distribution even when setup runs through npx.
A custom acquisition cache may not have a recognizable path; the operator must still choose a
persistent runtime folder. Update preserves the saved service URL when no replacement is supplied.
Use the intended runtime path again when invoking its update through a cached launcher. Removing a
connector preserves all runtime data, secrets, and shared processes.

## Path and command rules

`install-paths.mjs` shares path containment across managed installers. An absolute result from
`path.relative` is outside the parent, including Windows cross-drive and UNC cases. Files and
ancestors retain symlink rejection. MCP doctor checks executable path components using native
separators rather than a POSIX suffix. Shell output quotes every argument and uses the PowerShell
call operator on Windows. Child execution continues to use Node with argument arrays.

Portable string tests establish path/quoting behavior only. Native Windows execution, junctions,
filesystem permissions, antivirus/file-lock behavior, and host discovery need Windows observation.
macOS and Linux also need their own release checks; a single-host pass is not cross-platform proof.

## Identity and supply chain

Obtain an exact authorized artifact, verify its digest, then execute it. The private publication
guard stays enabled. Installation has no npm postinstall behavior. Full operator transports must
produce equal managed payload digests for equal release bytes. These digests do not authenticate
the publisher. Source commit identity is available only for a Git source root; copied installations
retain their existing receipt version/digest but not independently authenticated provenance.

Keep package-version, host-cache, and source identity separate. Do not silently adopt a copy owned
by skills.sh or a native manager. A future receipt extension must preserve v1 reading and keep
transport-specific acquisition metadata out of the payload parity hash. No such provenance upgrade
is claimed by the current receipt schema.

## Future standalone installer

Do not introduce curl-to-shell for private alpha. Before a standalone installer is offered, require:

- Authenticated acquisition that preserves private access and never embeds credentials in URLs.
- Immutable versioned artifacts and signature verification against a trusted identity before execution.
- macOS, Linux, and Windows bootstrap and PATH behavior, without requiring administrator access by default.
- Atomic update/rollback, explicit version selection, offline recovery, and owned removal.
- The same operator inventory and lifecycle acceptance as npm/source transports.
- No hidden host registration, service startup, account connection, or action authorization.

The installer should delegate to the same setup contract. A new transport must not create a second
operator implementation or advertise host capabilities the package does not provide.
