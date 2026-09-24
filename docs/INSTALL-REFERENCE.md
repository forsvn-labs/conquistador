# Manual installation reference

Start with the [recommended operator installation](../INSTALL.md#project-operator-recommended). This reference keeps
the direct commands for local source copies, native plugin managers, runtime operators, and
containers. Use the original installer to update and remove a copy. Full skill and plugin packages
include all 38 outcome methods; domain and standalone method packages can contain fewer.

Version 0.0.12 is the latest verified private alpha; this checkout is an unreleased 0.0.13 candidate. See INSTALL.md for the current verified persistent CLI. Do not use a 0.0.13 tag or asset until it is separately verified and released.
`private: true` blocks registry publication; private Git and local package execution remain possible. See [package verification](../INSTALL.md#verify-the-package).

For Git acquisition, use the fixed release tag or its full source commit. Your GitHub account must
have repository access, including organization sign-in requirements. A not-found response can mean
missing access or a missing reference. A supplied private ZIP/tarball avoids Git acquisition.

The private release tarball is also the supported Bun package runner input. Bun still starts the
Node shebang, so Node 24 is required. Do not use the private HTTPS Git reference with Bun unless a
release explicitly verifies that credential path. See the [standard install](../INSTALL.md#project-operator-recommended)
for both commands.

## Complete operator from source or ZIP

Use this route when a package runner cannot use your Git credentials or when you need to inspect
the source before installation. From the receiving project, run:

```sh
node /absolute/path/conquistador-source/runtime/bin/conquistador.js
node /absolute/path/conquistador-source/runtime/bin/conquistador.js operator doctor
```

The source path can be a clean clone or an extracted release ZIP. The command installs the same
complete package at `.conquistador/` as the npm and Bun routes. For the same release bytes,
the managed receipt digest and doctor result must match the package-runner installations.

## Let your coding agent do the setup

Ask your existing agent to follow [INSTALL.md](../INSTALL.md) for the current project. It can check
prerequisites, install the root bundle, and check discovery without a separate clone. You handle
account sign-in, repository access and any host-required approval. Do not paste credentials into chat.
Conquistador becomes usable after the host reads its parent contract; it cannot install itself beforehand.

During later tasks, Conquistador checks missing tools and prepares routine local prerequisites
through the host when permitted. It installs only what the task needs. For example,
[Lavish preview](PREVIEW.md) uses a cached package launcher. Model access comes from your host;
paid providers and external account connections remain separate.

## skills.sh from a local source

Prefer `conquistador --skills --host HOST` or managed setup for the fewest installation steps. If your host uses the pinned skills CLI,
first stage a parent-first compact folder from the authorized verified distribution:

```sh
node /absolute/path/conquistador-source/runtime/bin/conquistador.js setup install --target skill --path /absolute/path/conquistador-parent
```

From the receiving project, let the skills CLI copy that staged folder. Select the intended host
and project scope when prompted:

```sh
DO_NOT_TRACK=1 DISABLE_TELEMETRY=1 npx --yes skills@1.5.26 add /absolute/path/conquistador-parent --skill conquistador --copy
```

These environment assignments use POSIX shell syntax. In PowerShell set `$env:DO_NOT_TRACK="1"`
and `$env:DISABLE_TELEMETRY="1"` before the npx command. Do not use `--full-depth`, `--all`, a wildcard,
or the editable checkout as the source. Only the staged folder has the one-entry layout. It contains
all 38 methods but omits the executable BB adapter. Use the operator or staged plugin for that adapter.
The `--skills` wrapper shows the manager download, host, destination, project scope and lockfile
before approval. It preflights the source and host paths even with `--dry-run`. The pinned CLI
copies to `.claude/skills/conquistador` for Claude Code and `.agents/skills/conquistador` for
Codex, Cursor and Copilot. These four mappings were exercised with `skills@1.5.26` in isolated
projects, including byte parity with the staged source. This proves copied files, not host discovery.

The pinned upstream CLI creates receiving-project `skills-lock.json`. Use managed setup instead
when the project must remain free of lockfiles. The upstream CLI owns its copied files, discovery
links, and manager metadata. Its own status, update, and removal commands apply; do not use setup
to adopt a third-party-owned copy. Host-specific removal can retain a shared skill directory for
another detected host. Review all intended hosts on removal, then verify the directory is gone.
The manager's lockfile can remain after the last skill is removed. A copied Conquistador receipt
does not change that ownership. Setup refuses to adopt, update or uninstall copies recorded by
skills.sh. The wrapper also refuses existing copies before running the manager, so it cannot
use the manager's overwrite option to discard local edits.
[Skills CLI documentation](https://github.com/vercel-labs/skills#install-a-skill).

After copying, start a fresh host session and select Conquistador. Run a first task from
[the usage guide](USAGE.md). A manager listing does not establish activation. Keep the original
staging folder unchanged so setup can update or remove it, and keep work outputs elsewhere.

The historical source-root-copy procedure exposes the canonical specialist files and is no longer
the default. Users deliberately opting into those globals can still use the canonical source, but
must account for discovery budgets and remove each copy through its original owner. Existing native
caches and source-root copies do not migrate when the CLI alone is updated.

## Optional private release ZIP

This subsection documents the original private `v0.1.0` archive. Its frozen ZIP predates guided
setup and the installation doctor. Use this manual reference for that artifact, or a newer
complete distribution for diagnostics. Choose a fresh download directory:

```sh
gh release download v0.1.0 --repo forsvn-labs/conquistador --pattern conquistador-0.1.0.zip --dir /absolute/path/conquistador-download
```

Expect `conquistador-0.1.0.zip` in that directory. Extract it into a new folder, locate the root
containing `SKILL.md`. For this old archive, use its historical manual procedure; obtain the current
implementation and stage a parent-first folder before using the skills CLI above. This is a private
release asset, not a public npm registry package. The release also supplies the npm tarball,
`SHA256SUMS` and `assembly.json` for package identity and integrity checks. A missing release or
asset means this route is not available yet; use the authorized branch clone or supplied ZIP.

## Update or remove an installation

The tool that created a copy owns its lifecycle. Updating the source clone does not update an
installed copy, and removing a skill does not erase project outputs or runtime data.

| Installed through | Update | Remove |
| --- | --- | --- |
| Complete project operator | Run the same release launcher with `operator update` from the receiving project | Run the same release launcher with `operator uninstall` from the receiving project |
| skills.sh with the local path above | Update the unchanged parent-first staging folder from an exact distribution and repeat the same `skills add` command for the same project and host | Run `DO_NOT_TRACK=1 DISABLE_TELEMETRY=1 npx --yes skills@1.5.26 remove conquistador` in that project and review the selected hosts |
| Host plugin manager | Refresh its local marketplace source and use the host's update controls | Use the host's uninstall controls; remove the marketplace registration if no longer needed |
| `tools/install.mjs` | Use `upgrade` with the original mode and destination from a complete distribution | Use `remove` with that same mode and destination |

Preserve local edits before replacement. Keep user work outside installer-owned directories.
A local-path install does not promise automatic branch tracking. After an update, start a fresh
host session and repeat a small task. For runtime state retention and erasure, use the separate
[runtime state guide](../runtime/STATE.md).

## Claude Code plugin and agent

Use the [current host lifecycle](PLATFORMS.md#claude-code) for status, updates and uninstall with
data retention. The commands below prepare a project-local registration.

Stage a self-contained parent-first plugin from the verified distribution with Node 24:

```sh
node tools/install.mjs install plugin /absolute/path/conquistador-plugin
claude plugin marketplace add /absolute/path/conquistador-plugin --scope local
claude plugin install conquistador@conquistador --scope local
```

In Claude Code, use `/conquistador:conquistador` for the parent skill. To start its native agent:

```sh
claude --agent conquistador:conquistador
```

You can also select `conquistador:conquistador` in the agent picker. The agent inherits the host's
model and permitted tools and loads the same parent method. It does not enable hooks or recursive
agent delegation by installation. During a task, the master agent can request bounded Claude worker
contexts when the current host exposes them. The plugin contains one native agent; specialist role
files remain inside the method tree and portable squad documentation stays outside Claude's
recursively scanned `agents/` directory.

See [Claude marketplaces](https://code.claude.com/docs/en/plugin-marketplaces) and
[native agents](https://code.claude.com/docs/en/sub-agents#invoke-subagents-explicitly).

## Codex plugin

Use the [current host lifecycle](PLATFORMS.md#codex) for status, local-source updates and removal.

Use the staged parent-first plugin directory, not the authoring checkout. With a Codex version that supports
plugin marketplaces, add the local marketplace and install Conquistador:

```sh
codex plugin marketplace add /absolute/path/conquistador-plugin
codex plugin add conquistador@conquistador
```

Expect the host to register the marketplace and install `conquistador@conquistador`. Confirm
Conquistador appears in the host's plugin/skill controls before starting a task. If your version
lacks these commands, use the skills.sh alternative. The repo includes
`.agents/plugins/marketplace.json`, `.codex-plugin/plugin.json` and the complete method library.
The portable JSON agent contracts are not native Codex agents. See
[Codex plugin packaging](https://learn.chatgpt.com/docs/build-plugins).

## Agent Plugins and other hosts

The root `plugin.json` follows [Agent Plugins 1.0.0](https://agent-plugins.org/specification), the
specified discovery format. It uses fixed `skills/` discovery. Import the directory
through a compatible client's plugin controls; the standard does not define one universal install
command or native agent format. The Claude and Codex files add their host-specific discovery.
No MCP server or hook starts automatically.

For GitHub Copilot CLI, see its [current lifecycle](PLATFORMS.md#github-copilot-cli). The documented marketplace path is:

```sh
copilot plugin marketplace add /absolute/path/conquistador-plugin
copilot plugin install conquistador@conquistador
```

See [Copilot plugin installation](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/plugins-finding-installing).
Manifest checks and skills CLI installs do not establish native host activation or model quality.
For Cursor, OpenCode, Gemini CLI, Pi and other skill-capable hosts, use the skills.sh route above.

## Domain packages

Use `setup.mjs --domain ABS` on coding-agent, plugin, and harness installs to write
`domain-restriction.json`. Optional `--knowledge-roots ABS` maps logical handles (`name` or
`scope:name`) to operator-owned directories outside the product. The restriction is the load-time
allowlist. The callable coordinator refuses undeclared siblings even if copied later.
Compact skill installs only filter copied methods; their host must enforce the restriction file.
`createDomainAuthorizer(root)` is available for that host integration. Parent integration uses `skills=[]` and does not inherit
`write-copy`. An `outcome` assignment may name any skill in `allowed.skills`. The mandatory final
review still uses `fresh-eyes-review`, which is always in the closure.

Domain packages do not apply to MCP. `conquistador_methods` / `conquistador_read` serve the skills
tree they were started from and do not load `domain-restriction.json`. A domain-staged plugin
omits unselected skill folders, so MCP pointed at that folder only sees copied methods. MCP started
from the complete distribution can list every method.

## Compact local installation

From the complete distribution with Node 24, choose a new directory in the host's skill location:

```sh
node tools/install.mjs install conquistador /absolute/path/to/skills/conquistador
```

This stages one root `SKILL.md`, the parent and all outcome methods as internal `METHOD.md` files under `library/`, and the optional
proactive helper. Import that folder through the host's skill controls. No Node process or
Conquistador service is needed when the host loads the methods. Native BB specialist dispatch
(`hosts/coding-agent/`) is not in this compact folder; use the complete distribution, or stage
`plugin` / `single-agent`, which copy those executable modules.

Advanced users can stage an independently usable method:

```sh
node tools/install.mjs install skill:write-copy /absolute/path/write-copy-install
```

That folder contains `skills/write-copy/`. It is not the complete Conquistador entry point.

For installations created by this helper, upgrade or remove from the complete distribution:

```sh
node tools/install.mjs upgrade conquistador /absolute/path/to/skills/conquistador
node tools/install.mjs remove conquistador /absolute/path/to/skills/conquistador
```

Use the same mode and destination. The helper checks ownership and hashes and refuses to replace
or remove modified files. Keep user outputs and configuration elsewhere. Stage a new directory to
retain an edited version. `node tools/install.mjs list` lists all modes. Host plugin managers own
their activated copies; update or remove those through the host's controls.

## Portable agent harnesses

```sh
node tools/install.mjs install single-agent /absolute/path/conquistador-agent
node tools/install.mjs install squad /absolute/path/conquistador-squad
```

The `single-agent` install contains the portable master contract in `agent/agent.json`, the operator
profile, specialist assignment files, methods under `agent/skills/`, and the native dispatch modules
under `hosts/coding-agent/` including `README.md` plus `agents/conquistador/agent.json`. `harness`
is the setup alias for this mode. When `domain-restriction.json` is present,
the callable coordinator enforces the file before loading or dispatching, without an optional
callback. The consuming host decides how many worker contexts it can run. The squad contains worker and advisor contracts and their methods. The worker produces; the advisor
reviews. The host must create separate contexts for independent review. Otherwise follow the
installed `sequential-fallback.md` and identify the review as the same context. These are portable
contracts that need a host adapter. For a native Claude agent, use its plugin above.

The `eve` and `grok-bot` modes stage experimental import packages. Native activation is unverified.

## Preview and proactive help

For visual previews and annotations, follow [Lavish setup](PREVIEW.md). The parent chooses
that review path on demand; no Conquistador preview application or global session hook is required.

[Proactive help](PROACTIVE.md) describes the opt-in local helper and its three host events.
Configure it outside the installation, then have the host invoke it and pass the returned
instructions to Conquistador. It cannot register hooks, run a schedule, access a provider or
authorize an action. Installation leaves it disabled. Installing methods grants no new permission
to publish, spend, persist learning or submit feedback.

Codex and Claude Code can opt into Conquistador mode through `tools/conquistador-mode.mjs`, which
writes only owned hooks into `.codex/hooks.json` or `.claude/settings.local.json`. See
[Proactive help](PROACTIVE.md#optional-conquistador-mode-for-codex-and-claude-code). Grok Bot and
Eve have no mode adapter.

## Optional runtime, terminal chat and MCP

The runtime is optional. Coding-agent skills use the host's model and tools. To use durable
playbooks and HTTP/MCP access, use Node 24 and npm. Make a separate working copy of the complete
distribution, or extract its ZIP into a second fresh directory. Keep the pristine source used by
the skills CLI free of dependencies and runtime state. Run these commands from the separate
working copy root to install the runtime dependency:

```sh
npm run bootstrap
node runtime/bin/conquistador.js version
node runtime/bin/conquistador.js init
node runtime/bin/conquistador.js doctor
```

Expect `version` to print the product version and `init` to create the default configuration.
`doctor` reports configuration or prerequisite gaps; a fresh setup is not ready for generation yet.
Configure a model accepted by the runtime configuration and supply its credential through the
configured environment variable. Do not put credentials in chat or Git. Then:

```sh
node runtime/bin/conquistador.js serve
```

In another terminal:

```sh
node runtime/bin/conquistador.js chat --url http://127.0.0.1:4317 \
  --intent "content intelligence loop" --product "Example product" \
  --audience "Independent designers" --channel "Email" --goals "Qualified trials"
```

For an MCP-capable host, configure a stdio server with this command and arguments, replacing the
absolute path. This example does not automatically start the HTTP service:

```json
{
  "command": "node",
  "args": ["/absolute/path/conquistador/runtime/bin/conquistador.js", "mcp", "--url", "http://127.0.0.1:4317"]
}
```

The four MCP tools, `conquistador_run`, `conquistador_artifacts`, `conquistador_artifact` and
`conquistador_cancel`, run a supported playbook, list artifacts, read an artifact and cancel work.
They do not approve work or publish. Supply `CONQUISTADOR_CHAT_TOKEN` in the host's secret settings
only if bearer transport is enabled. Never provide human review/action tokens to the agent.
See [runtime setup and review](../runtime/README.md) for the service configuration and authority flow.
Skill-only routes give guidance; they are not silently turned into executable playbooks.

## Persistent CLI

A supplied verified tarball can install the CLI globally in a user-owned prefix. This also provides
a stable distribution for runtime MCP. It creates dependencies only in the chosen prefix. Run
setup from the receiving project:

```sh
npm install --global --prefix /absolute/path/conquistador-cli --ignore-scripts /absolute/path/forsvn-conquistador-0.0.12.tgz
/absolute/path/conquistador-cli/bin/conquistador setup
```

On macOS/Linux the executable is `PREFIX/bin/conquistador` and package directory is
`PREFIX/lib/node_modules/@forsvn/conquistador`. On Windows they are `PREFIX/conquistador.cmd` and
`PREFIX/node_modules/@forsvn/conquistador`. Add the executable directory to PATH through your
normal user environment controls, or use its absolute path. Setup never edits PATH.
For `--runtime-path`, pass the package directory, not the executable or prefix itself.
[npm folder layout](https://docs.npmjs.com/cli/v11/configuring-npm/folders/)

Repeat installation with an exact verified newer artifact to update the CLI. Installed project
copies and native host caches do not update automatically. Remove those with their original owners
as needed, then run `npm uninstall --global --prefix ABS @forsvn/conquistador`. Do not remove a
prefix that also contains unrelated packages. A global install using your existing user-managed
Node prefix can omit `--prefix`; administrator access is not a setup prerequisite.

## Container

Build the provided Dockerfile locally; no published image is claimed:

```sh
docker build -t conquistador:0.0.5 .
docker volume create conquistador-data
docker run --rm -v conquistador-data:/data conquistador:0.0.5 init
docker run --rm -v conquistador-data:/data conquistador:0.0.5 doctor
```

The image runs as the `node` user in writable `/data`. Configure the volume and model environment
before running the service. The default service binds loopback inside its host; exposing it outside
the container requires the runtime's documented authenticated single-node/TLS configuration.
A bind mount must be writable by the image's user. Local container creation is not registry publication.

## Integrations and development

[Services](SERVICES.md) distinguishes methods, host tools, catalog adapters and Eval Lab.
[CONTRIBUTING.md](../CONTRIBUTING.md) covers root bootstrap, build, tests and packaging without private
release records. A package or install receipt is not live-provider evidence or release approval.

## Troubleshooting

| Symptom | Recovery |
| --- | --- |
| GitHub reports repository not found or access denied | Check the active account and private repository access; if `gh` works but HTTPS Git fails, run `gh auth setup-git` |
| The skill is in the wrong project or scope | Remove it through the original installer in that scope, then install from the intended project for the intended host |
| Conquistador appears in the install summary but not in the host | Confirm the project and selected host, then start a fresh session; check the plugin namespace if applicable |
| The parent cannot find a method | Use the [read-only completeness check](../INSTALL.md#read-only-completeness-check) from the complete CLI, preserve edits, and reinstall the root bundle; do not copy the nested parent alone |
| Managed MCP has an unchanged receipt but will not start | Run `operator doctor --path ABS` from a complete distribution to check its saved Node/package paths; update/repair the managed local connector, then replace the client entry; a runtime bridge still needs its stable source |
| The compact helper reports `Destination exists` | Choose a new directory, or use `upgrade` only for an unchanged helper-owned install |
| The helper reports modified files or a differing receipt | Preserve the edits and stage a new directory; do not alter the receipt to force replacement |
| Runtime configuration or model access fails | Follow `doctor` diagnostics and the runtime guide; verify the configured credential environment variable through the host's secret settings |
| A runtime request returns skill guidance instead of a session | That outcome has no selected executable playbook; use the coding-agent skill route |

Host command examples describe setup procedures. They do not establish activation in your host.
Use the [private-alpha checklist](PRIVATE-ALPHA.md) to record that separately.
