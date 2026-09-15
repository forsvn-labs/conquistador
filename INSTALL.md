# Install Conquistador

Use the complete 0.1.0 distribution ZIP or this source checkout. Extract the ZIP, open a terminal
in its root, and use Node 24 for the installation helper. The generated skill package itself needs
no Node process or Conquistador service when the host loads it.

This version is not published to a package registry. Do not use an unverified package with a
similar name. The intended source repository is
[forsvn-labs/conquistador](https://github.com/forsvn-labs/conquistador); remote availability is
still pending. Use the provided local artifact until publication is verified.

## Recommended: one entry point with every method

Choose a new dedicated directory in your host's configured skills location, or stage locally and
import it through the host's skill controls:

```sh
node tools/install.mjs install conquistador /absolute/path/to/skills/conquistador
```

This installs a root `SKILL.md`, Conquistador's operating contract, all 38 outcome methods under
`library/`, and the optional proactive helper. Point the host at that root `SKILL.md`. Start a new
host session and select Conquistador. Ask `/conquistador` for your outcome. If the host uses a
named-skill picker or `$conquistador`, use that spelling for the same entry point.

For a Codex installation whose skill directory is `$CODEX_HOME/skills`, choose
`$CODEX_HOME/skills/conquistador`; the usual default is `$HOME/.codex/skills/conquistador`.
Other agents may use different project or user skill directories. Use the directory documented
by the installed host rather than treating the staging command as host activation.

The parent chooses and composes methods, including engineering methods when the request needs
them. It loads the smallest relevant context. It does not make users install siblings, download
methods at runtime, or approve internal routing steps. A missing tool or authorization is reported
at the operation that needs it; installing methods does not grant those capabilities.

## Plugin and standalone methods

A plugin-capable host can load the full plugin directory:

```sh
node tools/install.mjs install plugin /absolute/path/conquistador-plugin
```

The package contains the Claude and Codex plugin manifests, method library, icon and proactive
helper. Use your host's local-plugin controls to activate it. Plugin hosts can namespace skill
commands, so select the Conquistador parent rather than assuming an exact slash alias is universal.
The recommended single-skill install above avoids requiring users to navigate sibling methods.

Advanced users can still install an individual outcome:

```sh
node tools/install.mjs install skill:write-copy /absolute/path/write-copy-install
```

That command stages `skills/write-copy/`. It is not the complete Conquistador entry point.

## Upgrade and remove

Run these commands from the complete distribution, using the same mode and destination:

```sh
node tools/install.mjs upgrade conquistador /absolute/path/to/skills/conquistador
node tools/install.mjs remove conquistador /absolute/path/to/skills/conquistador
```

The installer checks ownership and file hashes. It refuses to overwrite or remove a modified
installation. Keep user outputs and local configuration outside the owned installation. To retain
an edited install, stage the new version at a different path and switch the host to it.
`node tools/install.mjs list` shows all install modes. No command changes host account settings.

## Agent harnesses

```sh
node tools/install.mjs install single-agent /absolute/path/conquistador-agent
node tools/install.mjs install squad /absolute/path/conquistador-squad
```

The single-agent install contains `agent/agent.json` and all declared methods under `agent/skills/`.
Load the parent first. The squad contains separate worker and advisor contracts and their methods.
The worker produces; the advisor reviews. The host must create separate contexts for independent
review. Otherwise follow `sequential-fallback.md` and identify the review as the same context.
These are portable contracts, not native agent launchers or separately hosted accounts.

The `eve` and `grok-bot` modes stage experimental import packages. Import compatibility and actual
host execution remain unverified. They are not advertised as supported native installations.

## Proactive help

[Proactive help](docs/PROACTIVE.md) describes the opt-in local helper and its three host events.
Configure it outside the installer-owned directory, then have the host invoke it on the selected
event and pass its returned instructions to Conquistador. The helper cannot register hooks, run a
schedule, access a provider, or authorize an action. Installation leaves it disabled.

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
