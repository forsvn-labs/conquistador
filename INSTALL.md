# Install Conquistador

Version `0.0.7` is the shipped private alpha on the `private-alpha` channel. It continues the same private
delivery sequence as dogfood. Public alpha is planned to start at `0.1.0`.
Use the [private release](https://github.com/forsvn-labs/conquistador/releases/tag/v0.0.7) and its
exact tag or source commit. The repository remains private and no npm package is published.
The observed installation platform is macOS with Node 24. Windows/Linux commands below are
portability guidance; native execution and native host registration still need their own checks.

## Project operator and native skill, recommended

The commands below use the immutable `v0.0.7` tag.
Use Node 24, npm, Git, and a GitHub account with access to the repository. Install the CLI once:

```sh
npm install -g --ignore-scripts --install-links git+https://github.com/forsvn-labs/conquistador.git#v0.0.7
```

In each receiving project, run:

```sh
conquistador
```

The next guide in this source checkout is implemented but unshipped. It has multi-selection:
Space toggles choices, arrows move, and Enter continues. The default selects the complete operator
and native host skills. Choose one or more hosts, then review all folders before confirming once.
The complete operator goes into `.conquistador`, with `SKILL.md` at its root. Native skills use:

| Coding agent | Project skill |
| --- | --- |
| Codex | `.agents/skills/conquistador` |
| BB | Complete `.conquistador` operator; no native skill registration |
| Claude Code | `.claude/skills/conquistador` |
| Cursor | `.cursor/skills/conquistador` |
| GitHub Copilot | `.github/skills/conquistador` |
| Other / files only | Read `.conquistador/SKILL.md` explicitly |

The operator and selected native skills contain the method library. The operator also includes
the BB adapter, portable contracts, schemas and profile. These owned copies share one
update/removal lifecycle. BB uses an explicit project/environment and its chosen provider. It is
not an alias for Codex. No BB plugin, provider registration or automatic request router is installed. An
unchanged existing managed skill can be adopted; modified or unowned content is refused. Domain
restrictions must agree. A new host session is needed to refresh native discovery. Setup does not
start automatic project routing, watchers, services or hooks.

For automation, `conquistador install` selects the current project and Codex skill. Use
`--host bb`, `--host cursor`, `--host claude-code`, `--host copilot` or `--host none` to choose differently.
This checkout also supports `--hosts codex,bb,cursor` for several hosts. During update, it can add
hosts while retaining existing owned skills. Removing an owned native host requires uninstalling
the unchanged operator first. Existing single-host commands and v1 receipts remain supported.
`--dry-run` checks install/update paths and ownership without creating files.
The CLI itself lives in npm's global prefix. The receiving project gets no `package.json`,
`node_modules` or lockfile. Avoid `sudo`; choose a user-writable npm prefix if necessary.

If the earlier v0.0.6 Git command reported success but `conquistador` is missing or resolves into
npm's cache, remove that dangling global entry before installing the corrected release:

```sh
npm uninstall -g @forsvn/conquistador
npm install -g --ignore-scripts --install-links git+https://github.com/forsvn-labs/conquistador.git#v0.0.7
conquistador version
```

The one-time launcher remains available when you do not want a persistent CLI:

```sh
npx -y --ignore-scripts --package=git+https://github.com/forsvn-labs/conquistador.git#v0.0.7 conquistador
```

Git acquisition can take time before Conquistador starts. Repeated npx invocations may resolve
GitHub again. The persistent CLI removes that repeated acquisition. `--ignore-scripts` skips npm's
automatic lifecycle hooks; it does not block the explicitly requested Conquistador command.
`--install-links` is required for the persistent private-Git route. It prevents npm 11 from keeping
a global executable linked to its temporary Git checkout. Tarball installations already copy files
and do not need that flag. Check acquisition immediately with `conquistador version`.

For a supplied release tarball, use the same persistent installation:

```sh
npm install -g --ignore-scripts /absolute/path/forsvn-conquistador-0.0.7.tgz
conquistador
```

Verify the tarball checksum first. A private Git tag, source checkout, ZIP, npm or Bun tarball must
produce the same complete operator. Git authentication can be configured with `gh auth setup-git`.
No token belongs in the command. See the optional transport table below.

### Verify the package

Obtain the tarball and its `SHA256SUMS` from the same authorized private distribution, with a trusted
release identity. Calculate the file's SHA-256 and compare it with the exact tarball entry before
execution. A checksum detects changed bytes; a checksum supplied by an untrusted sender does not
authenticate that sender. Keep the tag, full source commit, and checksum together when recording the installed build.

| System | Calculate SHA-256 |
| --- | --- |
| macOS | `shasum -a 256 /absolute/path/forsvn-conquistador-0.0.7.tgz` |
| Linux | `sha256sum /absolute/path/forsvn-conquistador-0.0.7.tgz` |
| Windows PowerShell | `Get-FileHash -Algorithm SHA256 "C:\Downloads\forsvn-conquistador-0.0.7.tgz"` |

Node/npm must work before the guide can start. A supplied tarball does not require GitHub sign-in
or Git, but npm may need registry access for package dependencies. No provider account is needed
for work based on supplied facts.

### First task

In a fresh coding-agent session in the receiving project, ask:

```text
Use Conquistador, or read .conquistador/SKILL.md and follow it.
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

## One entry, selected specialists

Managed host skill targets install exactly one discoverable `SKILL.md`. Staged native plugins and
the complete operator also contain one. Internal methods use `METHOD.md`; their versions, safety
rules, scripts, and resources remain intact. Conquistador reads its operating contract and compact
capability catalog after selection, then loads the relevant methods. It names the public capabilities
and specialists it uses without exposing internal paths or claiming independent review that did not run.

A long global skill list can shorten or omit descriptions. Codex budgets its initial names,
descriptions and paths separately from the full method bodies, which load after selection.
[Official discovery guidance](https://learn.chatgpt.com/docs/build-skills). One entry reduces this
package's contribution; it cannot prevent warnings caused by other installed skills.

An unchanged managed copy migrates through its normal update command. Modified copies remain
protected. Refresh the native host or its activated plugin cache afterward. Independently installed
specialists remain owned by their original manager and are not silently removed.

## Combine integrations

The next guide can prepare these together. Each folder has one owner:

| Selection | Shared files and lifecycle | What to do after setup |
| --- | --- | --- |
| Complete operator + native skills | `.conquistador` owns the selected native skill copies; changes stage and roll back together | Refresh each selected native host; BB uses explicit file invocation or its team adapter |
| Operator + portable harness | Reuses `.conquistador/agent/agent.json`; no duplicate operator | Attach the contract through your consuming adapter |
| Several native plugins | One staged source; each host manager owns its activated copy | Register through each original manager and scope |
| Local + runtime MCP | Separate connector folders and receipts | Register separate client entries; runtime also needs its existing service |
| Squad or named specialist | Separate owned package | Load its specific contract or method in the consuming host |
| Experimental imports | Guidance only, no installed copy | Review the target's documented limitations |

The guide refuses overlapping destinations and a skill plus plugin for the same named native host.
Both contain the same parent; choose one discovery route for that host. Cursor also scans
`.agents/skills` and `.claude/skills`, so combined native copies need a fresh host check for
duplicate discovery and precedence. File ownership does not certify that behavior.
[Cursor discovery locations](https://cursor.com/docs/skills#skill-directories). It does not inspect
external host registrations. Check those in the original manager. Generic Agent Plugins sources
have no known host, so their activation must also avoid duplicate discovery.

Adding skills to a project with an existing operator updates that operator's ownership record.
Existing owned hosts are retained. A standalone installer cannot separately update or remove a
paired native skill. An unrelated MCP/plugin/squad copy remains independently removable.

Setup checks every selected destination before applying. The operator and native skills form one
transaction. The entire selection is not one transaction: a later connector or plugin failure
leaves earlier completed copies owned and usable. Setup lists those copies and their inspection
and removal commands. It never claims a complete rollback of independent installations.

A domain-restricted operator cannot be combined with full-library local MCP in the guide. Existing
domain restrictions survive updates; the full-library doctor does not certify subset readiness.

## Choose a different integration

Prefer a host's native manager when you want a native plugin. The generic guide prepares local
files and prints host steps; it does not implement universal registration.

| Form | Guide target | Contents and execution | Update and removal owner |
| --- | --- | --- | --- |
| Complete project operator | `operator` | 38 methods, profile, contracts/schemas, BB adapter; host executes | `operator` lifecycle |
| Native plugin source | `claude-plugin`, `codex-plugin`, `copilot-plugin`, `agent-plugins` | Complete operator inventory plus discovery metadata; native capabilities depend on host | Setup owns source; original host manager owns activated copy |
| Parent-first compact skill | `codex`, `claude-code`, `copilot`, `cursor`, `skill` | One entry, 38 internal methods and profile; no portable schemas or BB adapter | Setup for managed copies; skills CLI for its copies |
| Portable agent | `harness` | Same complete operator; consuming adapter required | Setup plus host detachment |
| Fixed squad | `squad` | Worker/advisor contracts and declared method subsets; no BB adapter | Setup plus host detachment |
| Local MCP | `mcp`, no URL | Owned server and library copy, including operator inventory; tools only list/read methods | Setup owns copy; client owns registration/process |
| Runtime MCP | `mcp` with `--url` | Connector only; separate service executes supported playbooks, not all 38 methods | Setup/client; runtime and data remain separate |
| Experimental import | `eve`, `grok-bot` | Guidance only; guide creates no files; native activation unverified | Consuming app, if supported |

Domain packages and standalone methods contain fewer methods and do not pass the full-library
doctor. The [architecture and specification](docs/INSTALLATION-ARCHITECTURE.md) defines these
contracts. The [official mechanism matrix](docs/INSTALL-MECHANISMS.md) explains host differences,
including AI-app plugins and permission boundaries.

### One named specialist, explicitly

For example, prepare only the copy method and its resources:

```sh
conquistador setup install --target skill:write-copy --path /absolute/path/write-copy-package
```

Point the host at `write-copy-package/skills/write-copy`, or load its `SKILL.md` explicitly. This
adds one named specialist when you register it. It has no parent router or complete operator.
Use setup status/update/uninstall with the owned package path. Full-library doctor does not certify
standalone or domain-restricted copies. The guide also accepts `skill:NAME` under Host skill integration.

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
| Optional persistent CLI | `npm install --global --ignore-scripts /absolute/path/forsvn-conquistador-0.0.7.tgz`, then `conquistador setup` in the receiving project |
| Bun tarball | `bunx --package /absolute/path/forsvn-conquistador-0.0.7.tgz conquistador setup`; Node 24 remains required by the shebang |
| Source or ZIP | `node /absolute/path/conquistador-source/runtime/bin/conquistador.js setup` in the receiving project |
| Exact private Git | `npx -y --ignore-scripts --package=git+https://github.com/forsvn-labs/conquistador.git#COMMIT conquistador setup`; replace `COMMIT` with the full commit from the release assembly record. For a persistent global copy add `--install-links` to `npm install -g`. |

For a persistent CLI, repeat the global install with the intended verified tarball to update it.
Remove project/plugin/connector copies first as needed, then `npm uninstall --global @forsvn/conquistador`.
A user-owned prefix avoids administrator permissions; see the [prefix instructions](docs/INSTALL-REFERENCE.md#persistent-cli).
A normal project-local `npm install PACKAGE` changes that project's dependencies and is not the
recommended operator flow. The npm publication guard remains `private: true`.

Private Git requires Git and the intended GitHub account's repository access, including organization
sign-in rules. If GitHub CLI can read the repo but HTTPS Git cannot, use `gh auth setup-git`.
Never put a token in the command. A missing branch is distinct from missing account access.
[GitHub credential-helper setup](https://cli.github.com/manual/gh_auth_setup-git)

Maintainers verify a released private-Git tag from a neutral project, isolated npm prefix and empty
cache with `npm run verify:private-git -- --spec GIT_SPEC --version VERSION`. The check removes its
acquisition cache before executing the CLI, then runs install, doctor, start, update and uninstall.
A tarball lifecycle cannot substitute for this Git durability check.

The private HTTPS Git form is not the supported Bun route. Use its verified tarball form. There is
no curl-to-shell installer. A future standalone installer needs authenticated private acquisition,
verified signed versioned artifacts, Windows/macOS/Linux support, safe PATH handling, rollback and
removal, and the same payload checks. [Future installer criteria](docs/INSTALLATION-ARCHITECTURE.md#future-standalone-installer)

<a id="skills"></a>
## Host skill integration

For native skill discovery, select the host in the guide or use its `setup install --target` command.
The optional skills.sh manager writes its own project `skills-lock.json`; use managed setup for
the no-lockfile path. For a skills.sh-managed parent-first copy, follow the [pinned local-source procedure](docs/INSTALL-REFERENCE.md#skillssh-from-a-local-source).
That staged compact copy omits the BB adapter. Use the operator or staged plugin for the adapter.
Never copy only the canonical source `skills/conquistador` folder, which needs sibling methods.
Select the installed skill in a fresh session.

### Update or remove the skill

Use the original installer and scope. For the pinned skills CLI, repeat its staged-folder `add`
command to update; use `npx --yes skills@1.5.26 remove conquistador` to remove. Removal limited to
one host can preserve a shared skill directory for another host. Review the selected hosts and
check the remaining files. The manager can leave its lockfile. Keep outputs outside the skill folder.
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
