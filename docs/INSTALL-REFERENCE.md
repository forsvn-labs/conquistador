# Manual installation reference

Start with [guided setup](../INSTALL.md). This reference keeps the direct commands for existing
skills.sh installations, native managers, runtime operators and container users. Use the same
owner to update and remove a copy. Both skill and plugin packages include all 38 outcome methods.

Version 0.1.0 is private. The source is
[forsvn-labs/conquistador, branch dogfood/0.1.0](https://github.com/forsvn-labs/conquistador/tree/dogfood/0.1.0).
Your GitHub account must have access, including any organization sign-in requirements.
A repository-not-found response can mean that the account lacks access. Use a supplied private
ZIP if you do not have repository access. There is no public package to install from npm.

## Let your coding agent do the setup

Ask your existing agent to follow the quick start below for the current project. It can check
prerequisites, obtain a clean source folder, install the entry point and check discovery. You handle
account sign-in, repository access and any host-required approval. Do not paste credentials into chat.
Conquistador becomes usable after the host discovers it; it cannot install itself beforehand.

During later tasks, Conquistador checks missing tools and prepares routine local prerequisites
through the host when permitted. It installs only what the task needs. For example,
[Lavish preview](PREVIEW.md) uses a cached package launcher. Model access comes from your host;
paid providers and external account connections remain separate.

## skills.sh alternative

Use an existing coding-agent project and Node 24 with npm. The clone route also needs Git and an
authenticated GitHub CLI. Replace every `/absolute/path/...` below with your own path. Keep the
source clone separate from the project receiving the skill.

1. Confirm that the active GitHub account can read the private repository:

   ```sh
   gh repo view forsvn-labs/conquistador --json nameWithOwner,isPrivate
   ```

   Expect `forsvn-labs/conquistador` and `isPrivate: true`. If access fails, complete GitHub sign-in
   or request repository access from the owner, then retry. Do not bypass this with another source.

2. Clone the dogfood branch into a new, dedicated directory:

   ```sh
   gh repo clone forsvn-labs/conquistador /absolute/path/conquistador-source -- --branch dogfood/0.1.0 --single-branch
   git -C /absolute/path/conquistador-source rev-parse HEAD
   git -C /absolute/path/conquistador-source status --short
   ```

   Expect a commit ID and no status output. Record the full commit ID for your dogfood notes.
   The branch can advance; compare the ID with the build your maintainer asked you to test.
   Do not install dependencies, build, or save project files in this source folder before copying it.
   If the destination already exists, choose a new directory instead of deleting or cleaning it.

   If you received a ZIP, extract it into a new directory and use the extracted root containing
   `SKILL.md` instead. Record its supplied build identity. Git checks apply only to a clone.

3. In the project where you want to use Conquistador, install the root entry point:

   ```sh
   cd /absolute/path/your-project
   DO_NOT_TRACK=1 DISABLE_TELEMETRY=1 npx skills add /absolute/path/conquistador-source --skill conquistador --copy
   ```

   Choose your host when prompted. Expect an installation summary for `conquistador` in the project
   scope. To select a host explicitly, add `--agent codex` or `--agent claude-code` to that command.
   Review the installer choices before accepting them.

4. Check discovery, then start a new host session:

   ```sh
   DO_NOT_TRACK=1 DISABLE_TELEMETRY=1 npx skills list
   ```

   Expect `conquistador` in the installed skills. Select it in your host and try the first request
   in [the usage guide](USAGE.md). The host may use `/conquistador`, `$conquistador` or a picker.
   A listing proves installation metadata; the first task checks actual host activation.

The root `SKILL.md` carries the complete library of 38 outcomes. Do not install only the nested
`skills/conquistador` folder or use `--full-depth`; the parent needs its bundled methods.
The agent selects the methods for each request.

The skills CLI copies a local directory, which can include untracked files and dependencies.
Use a fresh clone or extraction, never a working development tree with `node_modules`, `dist`,
secrets, local state or symlinks. Keep this private product out of public project commits.
The [compact helper](#compact-local-installation) stages a smaller alternative.

The telemetry variables above disable the third-party installer's telemetry. Supported options and
host names are in the [skills CLI source documentation](https://github.com/vercel-labs/skills#install-a-skill).
This guide uses an authenticated clone plus a local install so the source branch and commit can be
checked before installation.

## Optional private release ZIP

The private `v0.1.0` prerelease is available to accounts with repository access. Its frozen ZIP
predates the guided setup command. Use this manual reference for that artifact, or clone the
current dogfood branch for guided setup. Choose a fresh download directory:

```sh
gh release download v0.1.0 --repo forsvn-labs/conquistador --pattern conquistador-0.1.0.zip --dir /absolute/path/conquistador-download
```

Expect `conquistador-0.1.0.zip` in that directory. Extract it into a new folder, locate the root
containing `SKILL.md`, and use that root as the source in the skills.sh installation step above. This is a private
release asset, not a public npm registry package. The release also supplies the npm tarball,
`SHA256SUMS` and `assembly.json` for package identity and integrity checks. A missing release or
asset means this route is not available yet; use the authorized branch clone or supplied ZIP.

## Update or remove an installation

The tool that created a copy owns its lifecycle. Updating the source clone does not update an
installed copy, and removing a skill does not erase project outputs or runtime data.

| Installed through | Update | Remove |
| --- | --- | --- |
| skills.sh with the local path above | Obtain a fresh branch clone or distribution, record its commit, and repeat the same `skills add` command for the same project and host | Run `DO_NOT_TRACK=1 DISABLE_TELEMETRY=1 npx skills remove conquistador` in that project and review the selected hosts |
| Host plugin manager | Refresh its local marketplace source and use the host's update controls | Use the host's uninstall controls; remove the marketplace registration if no longer needed |
| `tools/install.mjs` | Use `upgrade` with the original mode and destination from a complete distribution | Use `remove` with that same mode and destination |

Preserve local edits before replacement. Keep user work outside installer-owned directories.
A local-path install does not promise automatic branch tracking. After an update, start a fresh
host session and repeat a small task. For runtime state retention and erasure, use the separate
[runtime state guide](../runtime/STATE.md).

## Claude Code plugin and agent

Use the [current host lifecycle](PLATFORMS.md#claude-code) for status, updates and uninstall with
data retention. The commands below prepare a project-local registration.

Use the fresh distribution root, or create a smaller plugin folder from it with Node 24:

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

Use the same fresh distribution or staged plugin directory. With a Codex version that supports
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

## Compact local installation

From the complete distribution with Node 24, choose a new directory in the host's skill location:

```sh
node tools/install.mjs install conquistador /absolute/path/to/skills/conquistador
```

This stages one root `SKILL.md`, the parent, all outcome methods under `library/`, and the optional
proactive helper. Import that folder through the host's skill controls. No Node process or
Conquistador service is needed when the host loads the methods.

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

The `single-agent` install contains the portable master contract in `agent/agent.json`, specialist
assignment files, and its methods under `agent/skills/`. The consuming host decides how many worker
contexts it can run. The squad contains worker and advisor contracts and their methods. The worker produces; the advisor
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

## Optional runtime, terminal chat and MCP

The runtime is optional. Coding-agent skills use the host's model and tools. To use durable
playbooks and HTTP/MCP access, use Node 24 and Bun. Make a separate working copy of the complete
distribution, or extract its ZIP into a second fresh directory. Keep the pristine source used by
the skills CLI free of dependencies and runtime state. Run these commands from the separate
working copy root to install the runtime dependency:

```sh
bun install
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

The supplied npm tarball can also install the CLI into a dedicated prefix:

```sh
npm install --prefix /absolute/path/conquistador-cli --ignore-scripts /absolute/path/forsvn-conquistador-0.1.0.tgz
/absolute/path/conquistador-cli/node_modules/.bin/conquistador --help
```

## Container

Build the provided Dockerfile locally; no published image is claimed:

```sh
docker build -t conquistador:0.1.0 .
docker volume create conquistador-data
docker run --rm -v conquistador-data:/data conquistador:0.1.0 init
docker run --rm -v conquistador-data:/data conquistador:0.1.0 doctor
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
| GitHub reports repository not found or access denied | Check the active account and private repository access; ask the owner for access or a private distribution |
| Conquistador appears in the install summary but not in the host | Confirm the project and selected host, then start a fresh session; check the plugin namespace if applicable |
| The parent cannot find a method | Reinstall the complete root bundle from clean source; do not copy the nested parent alone |
| The compact helper reports `Destination exists` | Choose a new directory, or use `upgrade` only for an unchanged helper-owned install |
| The helper reports modified files or a differing receipt | Preserve the edits and stage a new directory; do not alter the receipt to force replacement |
| Runtime configuration or model access fails | Follow `doctor` diagnostics and the runtime guide; verify the configured credential environment variable through the host's secret settings |
| A runtime request returns skill guidance instead of a session | That outcome has no selected executable playbook; use the coding-agent skill route |

Host command examples describe setup procedures. They do not establish activation in your host.
Use the [dogfood checklist](DOGFOOD.md) to record that separately.
