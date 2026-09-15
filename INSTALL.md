# Install Conquistador

Choose a skill install for everyday use. Choose a plugin if you want your host's plugin manager
and, in Claude Code, the native Conquistador agent. Both include all 38 outcome methods.
The optional runtime is a separate choice for durable playbooks and MCP.

Version 0.1.0 is currently unpublished. Use a fresh extracted distribution for the local commands
below. The intended GitHub URL still needs publication of this source; remote commands in this
page are explicitly for use after that step. No npm registry package or hosted service is claimed.

## Recommended: skills.sh

From your project directory, install from a fresh extracted Conquistador ZIP:

```sh
DO_NOT_TRACK=1 npx skills add /absolute/path/extracted-conquistador --skill conquistador --copy
```

The skills CLI asks which installed agents should receive the skill. To select one explicitly:

```sh
DO_NOT_TRACK=1 npx skills add /absolute/path/extracted-conquistador --skill conquistador --agent codex --copy
```

Agent names include `claude-code`, `codex`, `cursor`, `opencode`, `github-copilot`, `gemini-cli`
and `pi`. These commands install into the current project. Leave out `--yes` to review the CLI's
choices. `DO_NOT_TRACK=1` disables the third-party installer's telemetry.

After this source is published at the intended repository, the short command will be:

```sh
DO_NOT_TRACK=1 npx skills add forsvn-labs/conquistador --skill conquistador --copy
```

The root `SKILL.md` forwards to the authored parent in `skills/conquistador/`. The complete public
bundle travels with it, so every method stays available. The agent loads only relevant methods.
Do not select the nested `skills/conquistador` directory alone or use `--full-depth` for this install.
That would bypass the complete entry point.

For a local source, use a fresh extracted distribution. The skills CLI copies the selected directory,
including untracked content and dependencies if present. Do not point it at a development checkout
containing `node_modules`, `dist`, local state, secrets or symlinks. The compact installer below
provides a smaller alternative without the development modules.

Start a new host session and select Conquistador. Ask `/conquistador` for your outcome. A host may
use `$conquistador` or its skill picker instead. You do not need to choose the underlying methods.
Use the skills CLI's `list`, `remove` and update controls for installations it owns. See the
[skills CLI documentation](https://www.skills.sh/docs/cli) for supported host names and options.

## Claude Code plugin and agent

Use the fresh distribution root, or create a smaller plugin folder from it with Node 24:

```sh
node tools/install.mjs install plugin /absolute/path/conquistador-plugin
claude plugin marketplace add /absolute/path/conquistador-plugin
claude plugin install conquistador@conquistador
```

After repository publication, replace the marketplace path with `forsvn-labs/conquistador`.
In Claude Code, use `/conquistador:conquistador` for the parent skill. To start its native agent:

```sh
claude --agent conquistador:conquistador
```

You can also select `conquistador:conquistador` in the agent picker. The agent inherits the host's
model and permitted tools and loads the same parent method. It does not enable hooks or recursive
agent delegation. The plugin contains one native agent; portable squad documentation is outside
Claude's recursively scanned `agents/` directory.

See [Claude marketplaces](https://code.claude.com/docs/en/plugin-marketplaces) and
[native agents](https://code.claude.com/docs/en/sub-agents#invoke-subagents-explicitly).

## Codex plugin

Use the same fresh distribution or staged plugin directory:

```sh
codex plugin marketplace add /absolute/path/conquistador-plugin
codex plugin add conquistador@conquistador
```

After repository publication, replace the marketplace path with `forsvn-labs/conquistador`.
Select Conquistador through the host's plugin/skill controls. The repo includes
`.agents/plugins/marketplace.json`, `.codex-plugin/plugin.json` and the complete method library.
The portable JSON agent contracts are not native Codex agents. See
[Codex plugin packaging](https://learn.chatgpt.com/docs/build-plugins).

## Agent Plugins and other hosts

The root `plugin.json` follows [Agent Plugins 1.0.0](https://agent-plugins.org/specification), the
current standard reached from Open Plugins. It uses fixed `skills/` discovery. Import the directory
through a compatible client's plugin controls; the standard does not define one universal install
command or native agent format. The Claude and Codex files add their host-specific discovery.
No MCP server or hook starts automatically.

For GitHub Copilot CLI, the documented marketplace path is:

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

The single-agent install contains `agent/agent.json` and its methods under `agent/skills/`.
The squad contains worker and advisor contracts and their methods. The worker produces; the advisor
reviews. The host must create separate contexts for independent review. Otherwise follow the
installed `sequential-fallback.md` and identify the review as the same context. These are portable
contracts that need a host adapter. For a native Claude agent, use its plugin above.

The `eve` and `grok-bot` modes stage experimental import packages. Native activation is unverified.

## Preview and proactive help

For visual previews and annotations, follow [Lavish setup](docs/PREVIEW.md). The parent chooses
that review path on demand; no Conquistador preview application or global session hook is required.

[Proactive help](docs/PROACTIVE.md) describes the opt-in local helper and its three host events.
Configure it outside the installation, then have the host invoke it and pass the returned
instructions to Conquistador. It cannot register hooks, run a schedule, access a provider or
authorize an action. Installation leaves it disabled. Installing methods grants no new permission
to publish, spend, persist learning or submit feedback.

## Optional runtime, terminal chat and MCP

The runtime is optional. Coding-agent skills use the host's model and tools. To use durable
playbooks and HTTP/MCP access, install the runtime dependency from the full distribution:

```sh
bun install
node runtime/bin/conquistador.js version
node runtime/bin/conquistador.js init
node runtime/bin/conquistador.js doctor
```

Configure an exact supported model and supply its credential through the configured environment
variable. Do not put credentials in chat or Git. Then:

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

The four MCP tools run a supported playbook, list artifacts, read an artifact and cancel work.
They do not approve work or publish. Supply `CONQUISTADOR_CHAT_TOKEN` in the host's secret settings
only if bearer transport is enabled. Never provide human review/action tokens to the agent.
See [runtime setup and review](runtime/README.md) for the service configuration and authority flow.
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

[Services](docs/SERVICES.md) distinguishes methods, host tools, catalog adapters and Eval Lab.
[CONTRIBUTING.md](CONTRIBUTING.md) covers root bootstrap, build, tests and packaging without private
release records. A package or install receipt is not live-provider evidence or release approval.
