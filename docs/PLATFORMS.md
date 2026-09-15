# Conquistador in your host

Start with [guided setup](../INSTALL.md). This page contains the details for the one host you
selected. Installing files, registering a host and running a real task are separate checks.

## Coding agents, recommended

Managed setup installs the same complete skill in the project's host-specific folder:

| Host | Target | Project folder |
| --- | --- | --- |
| Codex | `codex` | `.agents/skills/conquistador` |
| Claude Code | `claude-code` | `.claude/skills/conquistador` |
| GitHub Copilot | `copilot` | `.github/skills/conquistador` |
| Cursor | `cursor` | `.cursor/skills/conquistador` |

After setup, refresh the host and select Conquistador. Invocation may use `/conquistador`,
`$conquistador` or the host's skill picker. A local receipt proves which files were prepared;
it does not prove host discovery or task quality.

Run `setup.mjs status`, `update` or `uninstall` with that exact folder as `--path`. Setup refuses
modified or unowned folders. It leaves project outputs alone. If you used skills.sh instead,
use its [own lifecycle](INSTALL-REFERENCE.md#update-or-remove-an-installation).

Folder references: [Codex](https://learn.chatgpt.com/docs/build-skills),
[Claude Code](https://code.claude.com/docs/en/skills),
[Copilot](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills),
[Cursor](https://cursor.com/docs/skills).

## Plugins

Choose a plugin only when you want host-managed plugin controls or the native Claude agent.
Setup prepares the bundle and prints the host steps. The host owns its activated copy. Before
removing the prepared folder, uninstall the plugin through the same host and scope. Marketplace
registrations may be shared; remove only the Conquistador registration when no other install uses it.

### Claude Code

Run these from the project where you want Conquistador. Replace the plugin path with the folder
printed by setup. Use local scope so the registration is not written into shared project settings.

| Action | Command |
| --- | --- |
| Register source | `claude plugin marketplace add /absolute/path/conquistador-plugin --scope local` |
| Install | `claude plugin install conquistador@conquistador --scope local` |
| Check | `claude plugin list --json` |
| Refresh source | `claude plugin marketplace update conquistador` |
| Update installed plugin | `claude plugin update conquistador@conquistador --scope local` |
| Uninstall and keep data | `claude plugin uninstall conquistador@conquistador --scope local --keep-data` |

Update the prepared source through setup before refreshing the marketplace. Host cache updates
also depend on plugin versions. For a copy installed in a different scope, use that original scope.
Only after checking other registrations, remove an unused local marketplace with
`claude plugin marketplace remove conquistador --scope local`. Omitting scope can affect other
scopes, and marketplace removal can uninstall remaining plugins. Do not use it as the first
uninstall step. [Claude reference](https://code.claude.com/docs/en/plugins-reference).

The plugin includes the native `conquistador:conquistador` agent. Select it in Claude's agent
picker, or use the namespaced `/conquistador:conquistador` skill.

### Codex

Codex plugin registration uses user configuration. Choose the coding-agent skill route above
when you want only project-local files.

| Action | Command |
| --- | --- |
| Register source | `codex plugin marketplace add /absolute/path/conquistador-plugin` |
| Install | `codex plugin add conquistador@conquistador` |
| Check | `codex plugin list --json` |
| Update from refreshed local source | `codex plugin add conquistador@conquistador` |
| Uninstall | `codex plugin remove conquistador@conquistador` |

Update the prepared source through setup before adding it again. There is no `codex plugin update`
command in the audited CLI. `marketplace upgrade` applies to Git marketplaces, not staged local
folders. Remove an unused marketplace separately with `codex plugin marketplace remove conquistador`.
Keep outputs outside plugin caches. These commands require a Codex version with plugin support.
[CLI source](https://github.com/openai/codex/blob/a8964cb1bad67bc26a826fb07d1bef99c6a3f008/codex-rs/cli/src/plugin_cmd.rs),
[marketplace source](https://github.com/openai/codex/blob/a8964cb1bad67bc26a826fb07d1bef99c6a3f008/codex-rs/cli/src/marketplace_cmd.rs).

### GitHub Copilot CLI

Copilot's native plugins are user-level installations. For project-only setup, use its skill route.

| Action | Command |
| --- | --- |
| Register source | `copilot plugin marketplace add /absolute/path/conquistador-plugin` |
| Install | `copilot plugin install conquistador@conquistador` |
| Check and find installed name | `copilot plugin list` |
| Refresh source | `copilot plugin marketplace update conquistador` |
| Update | `copilot plugin update NAME` |
| Uninstall | `copilot plugin uninstall NAME` |

Replace `NAME` with the installed Conquistador name returned by list. Update the prepared source
first. Remove an unused marketplace with `copilot plugin marketplace remove conquistador` only
after uninstalling its dependents. Do not use `--force`. Data-retention guarantees for native
uninstall are unverified, so keep project outputs and runtime data outside its install cache.
[Copilot reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference).

The commands above were checked against primary documentation or source. They were not executed
in a native host. If a command is unavailable in your installed version, use the default skill
route instead.

For another [Agent Plugins 1.0.0](https://agent-plugins.org/specification) client, import the bundle
through that client's controls and use the same client to disable, update or uninstall it. The
standard defines a package format; it does not define one universal manager command.

## MCP

MCP connects a client to the optional Conquistador runtime. It is useful for supported playbook
runs and reading persisted draft artifacts. It does not make all 38 methods executable tools.
Use [runtime setup](../runtime/README.md) to configure and start the service first.

Setup prepares `connector.json` for your service URL. Add its command and arguments to your MCP
client's settings. Supply transport credentials through the client's secret settings when required.
Never pass human review or action credentials to the agent.

Local setup status checks the connector files; it does not probe a running service. Runtime
`doctor` checks configuration, and runtime `status` checks a run. Neither means the MCP client is
connected.

To disconnect, remove only this Conquistador entry from the client, then uninstall the prepared
connector directory through setup. The service, run data and credentials remain separate. Stop the
service yourself when no other client uses it; use [runtime state controls](../runtime/STATE.md)
only when you intend to export or erase data.

## Agent harnesses

Choose `harness` for one agent, or `squad` for separate production and review roles. Setup prepares
portable contracts and their method libraries. Your host adapter executes those contracts. Use the
native Claude plugin if you want an already defined host-specific agent instead.

To remove a harness, detach it in your host adapter, then uninstall its prepared directory through
setup. Separate host contexts are required for independent review. A same-context fallback must
be identified. Host credentials, task outputs and external state are not installer-owned.

## Grok Bot and Eve

These are experimental import contracts. Native import and execution have not been verified, so
the setup guide does not offer them as ready integrations. Grok CLI is a different host from the
Grok Bot app. Use the coding-agent route for current dogfooding.

If you previously staged one of these packages with `install.mjs`, managed status and removal can
inspect its receipt. Remove any host registration in that app before deleting the prepared folder.
Do not treat file staging as a connected or running bot. Do not delete a Bot to remove this package: that can delete its conversation and routines.
[Official Bot lifecycle](https://docs.x.ai/grok-bot/bots) and
[skills and routines](https://docs.x.ai/grok-bot/skills-routines-and-automations) describe the host;
the exact private-package import and removal contract for Conquistador remains unverified.
