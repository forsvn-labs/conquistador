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
without writing. The default guide selects a route and coding agent, uses the current project, shows the
complete payload and skill destination, and asks once before applying. Other forms select a host and
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

## Parent-first discovery and lazy methods

Canonical authoring sources remain `skills/<method>/SKILL.md`. The managed installer transforms
copies with `stage-method-library.mjs`; it never edits those sources. A compact host skill has:

```text
SKILL.md
agents/openai.yaml
library/conquistador/METHOD.md
library/conquistador/catalog.md
library/conquistador/operator-profile.json
library/<outcome>/METHOD.md
library/<outcome>/references/...
library/<outcome>/scripts/...
```

The entry description starts with the product's task triggers and stays below 180 characters.
The installed root contains exactly one file named SKILL.md, including recursive descendants.
The entry reads the operating contract and catalog, then only the chosen method bodies and their
resources. The catalog uses public capability labels and lists only included methods. During work,
the parent discloses relevant capabilities, specialist labels and actual execution/review mode.
Installation does not create isolated workers or prove that a host followed these instructions.

A staged plugin nests this same entry at `skills/conquistador/`; an operator/harness puts it at
the installation root, with `SKILL.md` and `library/`. Both retain the complete operator inventory. The native Claude agent
still targets that SKILL.md, and BB resolves its selected logical method IDs to internal METHOD.md
files. Profile lookup supports both old and new layouts. Contracts, schemas and method IDs do not
change. Squad members each have one parent entry plus their declared internal subset, intended for
separate adapter contexts. The whole squad is not a global skill installation.

All method versions/frontmatter and non-Markdown resource bytes are preserved. Markdown adaptation
changes the internal document token SKILL.md to METHOD.md, retaining relative sibling geometry.
External URLs and the explicit operator/plugin wrapper path stay intact. Canonical methods may not
use the reserved METHOD.md token, which keeps the transform reversible. Full-library doctor checks
normal form and hashes the reversed bytes against the canonical completeness manifest. Tests also
compare every method/resource byte, executable bits where supported, the catalog and local links.
This establishes packaged content parity; it does not certify equivalent model performance.

Domain/squad subsets retain only selected method files, roles and workflows. Links to omitted files
become explicit unavailable text instead of dangling load instructions. This is the only additional
subset adaptation. The filtered catalog is not a permission grant. The same domain restriction and
callable admission checks remain authoritative. Full-library doctor continues to reject restricted
or standalone copies as incomplete, rather than claiming full-library or domain execution proof.

Local MCP retains its canonical resource API and all 39 entries, parent plus 38 outcomes. Those
entries are MCP read resources, not native discoverable skills. Runtime MCP retains its separate
playbook contract. Explicit standalone `skill:NAME` packages keep their original SKILL.md and
independent resources. Experimental Eve/Grok guidance still creates no files; low-level legacy
exports remain unverified import formats, not supported native skill installation targets.

### Source and host-cache boundary

Source archives and npm packages contain editable canonical sources. Their acquisition is followed
by setup. Native plugin managers and third-party skill copiers do not run that transformation.
Give them a staged parent-first folder by default. Registering the source root directly is an
explicit specialist-exposure option, not the one-entry experience. Agent Plugins fixes discovery
at immediate children of skills/, so no manifest pointer can hide canonical siblings across hosts.
The staged layout satisfies that rule and also survives recursive host skill scans.
[Agent Plugins specification](https://agent-plugins.org/specification).

An unchanged v1 managed receipt can update to this layout through the same owner. Its digest changes
because filenames and links change. Edited copies are still refused. Keep user work outside managed
folders and refresh host registration/cache after the local update. Old hand-written specialist
paths need the new library path or explicit standalone installation. The CLI does not remove other
skill-manager copies, host caches, or independently registered specialists. Repeated 0.1.0 plugin
builds may require an explicit manager refresh; no new release identity is inferred.

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

## Project installation and migration

The `0.0.6` candidate puts the complete operator in `.conquistador`. `SKILL.md` and `library/`
are at its root. The project guide asks for a coding agent, then installs a contained compact
copy at that host's native project skill path. A compact copy retains every method/resource; the
operator additionally retains the executable BB adapter, profile, contracts and schemas.

`project-installation.json` binds the selected host names and native-copy digests to the operator's
managed digest. Hosts resolve only to fixed project-relative paths. Status and doctor check the
paired skill, and update/removal refuse changed files in either copy. Both replacements stage
before any rename; failures roll back prior directories. Existing unchanged managed compact
skills can be adopted through the displayed setup plan. Domain restrictions must agree.

Default project update migrates an unchanged `.conquistador-operator` to `.conquistador`, including
its domain selection. Explicit legacy `--path` stays supported. If both roots exist, a write
requires an explicit path. Unowned `.conquistador` contents, including older runtime state, are
preserved by refusal. Runtime's new default is `.conquistador-runs`; existing unmanaged `.conquistador/runs` remains
the default when present. Explicit existing `--runs-dir` paths remain valid. No runtime data migrates or is deleted by setup.

Host skill placement is not live host acceptance. A fresh native session must still demonstrate
discovery, selection and useful method execution. The filesystem doctor does not certify it.
