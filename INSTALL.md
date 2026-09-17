# Install Conquistador

The current implementation is unshipped private-alpha preparation. Product version remains 0.1.0;
the proposed `private-alpha` channel is not an available release established by this checkout.
Use a supplied private tarball containing this implementation. Do not substitute an older dogfood
artifact. No public npm package, remote branch, tag, or release is created by these instructions.

## Project operator, recommended

Use Node 24 and npm. Verify the supplied tarball below, then run from your receiving project:

```sh
npx -y --ignore-scripts --package=/absolute/path/forsvn-conquistador-0.1.0.tgz conquistador setup
```

Replace the absolute path with your file. Quote the whole `--package=...` argument if it contains
spaces. In PowerShell or cmd, use a Windows path such as
`"--package=C:\Downloads\forsvn-conquistador-0.1.0.tgz"`.

Press Enter for the recommended operator, then confirm the displayed installation once. The guide
defaults to the current project. It shows the selected payload, capability limits, scope, and
activation step. It checks local files after installation and prints a first task. Other routes
ask for their host and owned folder. `conquistador setup list` explains every route without writing.

`--ignore-scripts` is a safety flag: npm skips automatic package lifecycle hooks during acquisition.
The explicitly requested Conquistador command still runs. The flag is not a sandbox or proof of
package trust. [npm configuration](https://docs.npmjs.com/cli/v11/using-npm/config/#ignore-scripts)

The package runs from npm's cache. It adds no dependency manifest, `node_modules`, or lockfile to
the receiving project. The default `.conquistador-operator/` contains the parent, 38 methods,
manual operator profile, portable contracts and schemas, and BB adapter. Keep this private folder
out of public commits, for example through a project-local Git exclude, and keep outputs elsewhere.
Setup does not change Git excludes or host settings. It starts no service, hook, or watcher.
[How npm exec uses its cache](https://docs.npmjs.com/cli/v11/commands/npm-exec/)

### Verify the package

Obtain the tarball and its `SHA256SUMS` from the same authorized private distribution, with a trusted
release identity. Calculate the file's SHA-256 and compare it with the exact tarball entry before
execution. A checksum detects changed bytes; a checksum supplied by an untrusted sender does not
authenticate that sender. The filename and `0.1.0` version alone do not distinguish alpha builds.

| System | Calculate SHA-256 |
| --- | --- |
| macOS | `shasum -a 256 /absolute/path/forsvn-conquistador-0.1.0.tgz` |
| Linux | `sha256sum /absolute/path/forsvn-conquistador-0.1.0.tgz` |
| Windows PowerShell | `Get-FileHash -Algorithm SHA256 "C:\Downloads\forsvn-conquistador-0.1.0.tgz"` |

Node/npm must work before the guide can start. A supplied tarball does not require GitHub sign-in
or Git, but npm may need registry access for package dependencies. No provider account is needed
for work based on supplied facts.

### First task

In a fresh coding-agent session in the receiving project, ask:

```text
Read .conquistador-operator/agent/skills/conquistador/SKILL.md and follow it.
Use docs/product.md and docs/audience.md to draft a launch email in docs/launch/.
Mark claims that need evidence. Keep this as a draft.
```

Use your own input paths or paste facts. This explicit file invocation needs no native skill
registration. The host must be able to read the file. A portable JSON contract does not register
a native agent. The BB adapter can execute an explicit [specialist team](hosts/coding-agent/README.md).
Project routing requires a host adapter calling `admitRequest`; installation does not wire it up.
Activation remains `manual`. [Activation and execution](docs/MASTER-AGENT.md)

### Capability parity

npm tarball, Bun tarball, source, ZIP, and an authorized exact Git reference must install the same
operator payload for the same release. Compare its managed digest and doctor result. A complete
operator has all 38 methods, the profile, contracts, schemas, and BB adapter. Identical files do
not establish equal host execution. Reduced integrations below must retain their stated limits.

## Choose a different integration

Prefer a host's native manager when you want a native plugin. The generic guide prepares local
files and prints host steps; it does not implement universal registration.

| Form | Guide target | Contents and execution | Update and removal owner |
| --- | --- | --- | --- |
| Complete project operator | `operator` | 38 methods, profile, contracts/schemas, BB adapter; host executes | `operator` lifecycle |
| Native plugin source | `claude-plugin`, `codex-plugin`, `copilot-plugin`, `agent-plugins` | Complete operator inventory plus discovery metadata; native capabilities depend on host | Setup owns source; original host manager owns activated copy |
| Compact skill | `codex`, `claude-code`, `copilot`, `cursor`, `skill` | 38 methods and profile; no portable schemas or BB adapter | Setup for managed copies; skills CLI for its copies |
| Portable agent | `harness` | Same complete operator; consuming adapter required | Setup plus host detachment |
| Fixed squad | `squad` | Worker/advisor contracts and declared method subsets; no BB adapter | Setup plus host detachment |
| Local MCP | `mcp`, no URL | Owned server and library copy, including operator inventory; tools only list/read methods | Setup owns copy; client owns registration/process |
| Runtime MCP | `mcp` with `--url` | Connector only; separate service executes supported playbooks, not all 38 methods | Setup/client; runtime and data remain separate |
| Experimental import | `eve`, `grok-bot` | Guidance only; guide creates no files; native activation unverified | Consuming app, if supported |

Domain packages and standalone methods contain fewer methods and do not pass the full-library
doctor. The [architecture and specification](docs/INSTALLATION-ARCHITECTURE.md) defines these
contracts. The [official mechanism matrix](docs/INSTALL-MECHANISMS.md) explains host differences,
including AI-app plugins and permission boundaries.

## CLI lifecycle

The examples use a persistent `conquistador` command. With the tarball launcher, replace that word
with the entire verified `npx ... conquistador` prefix above. Choose the exact newer package when
updating. Updating a CLI package does not update any project copy automatically.

```sh
conquistador setup list
conquistador install
conquistador operator status
conquistador operator doctor --json
conquistador operator update
conquistador operator uninstall
```

`install` is the concise noninteractive complete-operator command. It defaults to the current
project; `--project PATH` selects another. `operator` lifecycle commands share those defaults.
For any other managed copy, use its target or absolute owned path:

```sh
conquistador setup install --target cursor
conquistador setup status --target cursor
conquistador setup doctor --target cursor --json
conquistador setup update --target cursor
conquistador setup uninstall --target cursor
```

`setup status|doctor|update|uninstall` requires a target or path, so it cannot silently choose a
wrong installation. Existing `setup ... --target TARGET --project ABS` and `--path ABS` forms remain
supported. Bare `conquistador status` and `conquistador doctor` remain runtime diagnostics.

Managed updates/removal refuse edited or unowned files. Preserve edits and use a fresh folder
when needed. Disable host routing and stop active teams before removal. Remove plugin/client
registration through the original host and scope, then remove the prepared copy. Refresh the host.
User outputs, host settings, service data, and secrets are not installer-owned.

### Read-only completeness check

`operator doctor --path ABS --json` checks files, method versions/hashes, receipt integrity, saved
MCP paths, and Git identity where available. It does not start executables or contact services.
A copy without Git still has unknown source commit identity. Use the doctor from the same release.

```text
38 methods available; local files verified; host activation and task execution unverified.
```

### What successful installation means

Check local completeness, host discovery, and a real first task separately. For substantial tasks,
check the engagement brief, deliverable, labeled review, and execution receipt. Neither a plugin
listing nor a passing doctor proves activation or output quality. Record observations with the
[private-alpha checklist](docs/PRIVATE-ALPHA.md).

## Other ways to obtain the same package

| Transport | Command or procedure |
| --- | --- |
| Optional persistent CLI | `npm install --global --ignore-scripts /absolute/path/forsvn-conquistador-0.1.0.tgz`, then `conquistador setup` in the receiving project |
| Bun tarball | `bunx --package /absolute/path/forsvn-conquistador-0.1.0.tgz conquistador setup`; Node 24 remains required by the shebang |
| Source or ZIP | `node /absolute/path/conquistador-source/runtime/bin/conquistador.js setup` in the receiving project |
| Exact private Git, once authorized and available | `npx -y --ignore-scripts --package=git+https://github.com/forsvn-labs/conquistador.git#COMMIT conquistador setup`; replace `COMMIT` with the supplied full commit |

For a persistent CLI, repeat the global install with the intended verified tarball to update it.
Remove project/plugin/connector copies first as needed, then `npm uninstall --global @forsvn/conquistador`.
A user-owned prefix avoids administrator permissions; see the [prefix instructions](docs/INSTALL-REFERENCE.md#persistent-cli).
A normal project-local `npm install PACKAGE` changes that project's dependencies and is not the
recommended operator flow. The npm publication guard remains `private: true`.

Private Git requires Git and the intended GitHub account's repository access, including organization
sign-in rules. If GitHub CLI can read the repo but HTTPS Git cannot, use `gh auth setup-git`.
Never put a token in the command. A missing branch is distinct from missing account access.
[GitHub credential-helper setup](https://cli.github.com/manual/gh_auth_setup-git)

The private HTTPS Git form is not the supported Bun route. Use its verified tarball form. There is
no curl-to-shell installer. A future standalone installer needs authenticated private acquisition,
verified signed versioned artifacts, Windows/macOS/Linux support, safe PATH handling, rollback and
removal, and the same payload checks. [Future installer criteria](docs/INSTALLATION-ARCHITECTURE.md#future-standalone-installer)

<a id="skills"></a>
## Host skill integration

For native skill discovery, select the host in the guide or use its `setup install --target` command.
For a skills.sh-managed root copy, follow the [pinned local-source procedure](docs/INSTALL-REFERENCE.md#skillssh-from-a-local-source).
That root copy includes the BB adapter; the compact guide route does not. Never install only the
nested `skills/conquistador` folder, which needs sibling methods. Select the skill in a fresh session.

### Update or remove the skill

Use the original installer and scope. For the pinned skills CLI, repeat its root `add` command to
update; use `npx --yes skills@1.5.26 remove conquistador` to remove. Keep outputs outside its folder.
See [host paths and invocation](docs/PLATFORMS.md#coding-agents).

## Plugins

Use [native host-manager instructions](docs/PLATFORMS.md#plugins). The guide can prepare a local
plugin source from the supplied distribution before registration. Claude local scope is specific
to the receiving project; Codex and Copilot plugin registration is user-level. Host trust and
permission checks still apply. Conquistador does not bundle an auto-starting MCP server or hook.

## MCP over stdio

Choose local MCP in the guide, or run:

```sh
conquistador setup install --target mcp
```

Copy `.conquistador-mcp/connector.json` into your client's server entry. It contains `command` and
`args`; clients with `mcpServers` wrap that object under the chosen server name. The client starts
and stops the process. Ask it to read `conquistador/SKILL.md`, then request a draft from supplied facts.

The managed folder includes its server and library, so deleting the original source or clearing
npm's cache does not break it. Node itself must remain installed. After Node replacement or moving
this folder, stop the client, run `setup update --path ABS` through the current package launcher,
replace the client's saved entry with the new connector, and restart it. Modified files still cause
repair to refuse. Old connector-only receipts are supported and become self-contained on local update.

For runtime MCP, choose the separate guide route and supply an existing service origin plus a stable
runtime distribution. Cache-backed runtime creation fails before writing. See the
[runtime bridge instructions](docs/PLATFORMS.md#optional-runtime-bridge). Removing a connector never
erases service data or stops a shared service.

## Recovery

| Problem | Action |
| --- | --- |
| Unsupported Node version | Use Node 24 before starting setup |
| Tarball identity is unclear | Obtain the exact private build and trusted checksum; do not infer identity from its filename |
| Destination already exists or has edits | Inspect its original owner; preserve edits and select a new folder |
| Doctor passes but host cannot invoke it | Follow the selected host's activation step and use a fresh session |
| MCP entry has old paths | Update/repair the owned copy, replace client configuration, and restart the entry |
| Runtime MCP rejects a cache | Install a separate stable runtime prefix and pass its package directory with `--runtime-path` |

Accounts and durable jobs remain optional. Set up Executor only when live access blocks a task;
Eve jobs and runtime playbooks have their own prerequisites. [Connection guidance](docs/INTEGRATIONS.md)
