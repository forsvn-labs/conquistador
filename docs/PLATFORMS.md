# Conquistador in your host

Start with [installation](../INSTALL.md). This page contains the details for the one host you
selected. Installing files, registering a host and running a real task are separate checks.
[Master-agent modes](MASTER-AGENT.md) explains which surfaces can run isolated specialists and which
use the sequential fallback.

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

The installed parent can assign bounded work to native agents or workers when the selected host
exposes that feature. The product does not create a background process or require native delegation.
When a host has no isolated worker context, the parent runs the same specialist contracts in sequence.

Run `setup.mjs status`, `update` or `uninstall` with that exact folder as `--path`. Setup refuses
modified or unowned folders. It leaves project outputs alone. If you used skills.sh instead,
use its [own lifecycle](INSTALL-REFERENCE.md#update-or-remove-an-installation).

Folder references: [Codex](https://learn.chatgpt.com/docs/build-skills),
[Claude Code](https://code.claude.com/docs/en/skills),
[Copilot](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills),
[Cursor](https://cursor.com/docs/skills).

## Plugins

Register the private GitHub repository directly when you want host-managed plugin controls or the
native Claude agent. Managed setup can also prepare a local plugin folder. The host owns its activated copy. Before
removing the prepared folder, uninstall the plugin through the same host and scope. Marketplace
registrations may be shared; remove only the Conquistador registration when no other install uses it.

### Claude Code

Run these from the project where you want Conquistador. Use local scope so the registration is not
written into shared project settings. Your host needs GitHub access to this private repository.

| Action | Command |
| --- | --- |
| Register source | `claude plugin marketplace add forsvn-labs/conquistador@dogfood/0.1.0 --scope local` |
| Install | `claude plugin install conquistador@conquistador --scope local` |
| Check | `claude plugin list --json` |
| Refresh source | `claude plugin marketplace update conquistador` |
| Update installed plugin | `claude plugin update conquistador@conquistador --scope local` |
| Uninstall and keep data | `claude plugin uninstall conquistador@conquistador --scope local --keep-data` |

For a local marketplace, update its prepared source through setup before refreshing. Host cache updates
also depend on plugin versions. For a copy installed in a different scope, use that original scope.
Only after checking other registrations, remove an unused local marketplace with
`claude plugin marketplace remove conquistador --scope local`. Omitting scope can affect other
scopes, and marketplace removal can uninstall remaining plugins. Do not use it as the first
uninstall step. [Claude reference](https://code.claude.com/docs/en/plugins-reference).

The plugin includes the native `conquistador:conquistador` master agent. Select it in Claude's agent
picker, or use the namespaced `/conquistador:conquistador` skill. It can request Claude worker
contexts when the current host exposes them. The plugin contains one native Conquistador definition;
specialist role files stay inside its method tree. Optional Conquistador mode is a separate, disabled
hook adapter; see [Proactive help](PROACTIVE.md#optional-conquistador-mode-claude-code).

### Codex

Codex plugin registration uses user configuration. Choose the coding-agent skill route above
when you want only project-local files.

| Action | Command |
| --- | --- |
| Register source | `codex plugin marketplace add forsvn-labs/conquistador@dogfood/0.1.0` |
| Install | `codex plugin add conquistador@conquistador` |
| Check | `codex plugin list --json` |
| Refresh Git source | `codex plugin marketplace upgrade conquistador` |
| Update installed plugin | `codex plugin add conquistador@conquistador` |
| Uninstall | `codex plugin remove conquistador@conquistador` |

Refresh the Git marketplace before adding the plugin again. There is no `codex plugin update`
command in the audited CLI. For staged local folders, update the files through setup and repeat
`plugin add`; `marketplace upgrade` applies only to Git marketplaces. Remove an unused marketplace separately with `codex plugin marketplace remove conquistador`.
Keep outputs outside plugin caches. These commands require a Codex version with plugin support.
[CLI source](https://github.com/openai/codex/blob/a8964cb1bad67bc26a826fb07d1bef99c6a3f008/codex-rs/cli/src/plugin_cmd.rs),
[marketplace source](https://github.com/openai/codex/blob/a8964cb1bad67bc26a826fb07d1bef99c6a3f008/codex-rs/cli/src/marketplace_cmd.rs).

### GitHub Copilot CLI

Copilot's native plugins are user-level installations. For project-only setup, use its skill route.

| Action | Command |
| --- | --- |
| Register source | `copilot plugin marketplace add forsvn-labs/conquistador#dogfood/0.1.0` |
| Install | `copilot plugin install conquistador@conquistador` |
| Check and find installed name | `copilot plugin list` |
| Refresh source | `copilot plugin marketplace update conquistador` |
| Update | `copilot plugin update NAME` |
| Uninstall | `copilot plugin uninstall NAME` |

Replace `NAME` with the installed Conquistador name returned by list. For local marketplaces,
update the prepared source first. Remove an unused marketplace with `copilot plugin marketplace remove conquistador` only
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

The default `conquistador mcp` command starts a local stdio server. It serves the bundled methods
to your MCP host, which supplies the model, project tools and permission controls. No separate
service or API key is required. Use the [copyable client configuration](../INSTALL.md#mcp-over-stdio).

The tools list available methods, list a method's text resources and read a selected file. Start
with `conquistador/SKILL.md`, then follow Conquistador's routing. The server does not execute code,
write project files, collect feedback or run the optional runtime. Reads are bounded and restricted
to the installed skill tree. The MCP client, not this server, creates any specialist contexts.

Your MCP client owns the process. Remove its `conquistador` entry to disconnect. To update, stop
the entry, refresh its package from the current branch, then restart it. The npm launcher caches
packages; when you need to confirm an exact revision, use the clone route and inspect `git rev-parse HEAD`.
For a local clone, the entry is `node /absolute/path/conquistador/runtime/bin/conquistador.js mcp`.

Managed setup with `--target mcp --path ABS` prepares a `connector.json` for this local command.
It does not edit client settings. Status checks the connector's files, not host registration.
Keep the source folder while using that connector. Disconnect the client before removing its
owned connector folder through setup.

### Optional runtime bridge

`conquistador mcp --url ORIGIN` retains the existing bridge to a configured HTTP runtime service.
It runs supported playbooks and reads persisted draft artifacts; it does not expose all 38 methods
as executable tools. Follow [runtime setup](../runtime/README.md#mcp-stdio-client) for this mode.
Only this mode may need `CONQUISTADOR_CHAT_TOKEN`. Never pass human review or action credentials
to an agent. Removing a connector does not erase service data or stop a shared service.

## Agent harnesses

Choose `harness` for the portable master agent, or `squad` for the fixed production and review roles.
Setup prepares the contracts and their method libraries. Your host adapter executes those contracts.
The master contract allows the number of specialist assignments needed by the task, subject to host
limits. The fixed squad always has one worker and one advisor. Use the native Claude plugin if you
want an already defined host-specific parent instead.

A domain-specific adapter may restrict the roster, knowledge roots, tools, and outcome methods.
Pass `--domain ABS` on coding-agent, plugin, and harness installs to write `domain-restriction.json`.
The load-time authorizer is `createDomainAuthorizer(root)` from `tools/domain-package.mjs`. It is
automatic whenever that file is present. An `outcome` assignment authorizes listed skills against
that allowlist; MCP stdio does not. Compact skill installs do not copy `hosts/coding-agent/`;
use the complete distribution or a plugin/harness folder for native dispatch.

To remove a harness, detach it in your host adapter, then uninstall its prepared directory through
setup. Separate host contexts are required for independent review. A same-context fallback must
be identified. Host credentials, task outputs and external state are not installer-owned.

## Optional Executor and Eve runtimes

The complete distribution offers `conquistador connections setup` and `conquistador jobs --help`.
`connections setup` inspects whether Executor is installed and prints official next steps. It does
not itself install a package or start a service. The parent skill runs those official commands
through the host when helping a new user. Read [accounts and durable jobs](INTEGRATIONS.md) for
setup, credential boundaries, and update checks.

## Portable Grok Bot and Eve packages

These are experimental import contracts. Native import, specialist delegation, and execution have not been verified, so
the setup guide does not offer them as ready integrations. Grok CLI is a different host from the
Grok Bot app. Use the coding-agent route for current dogfooding.

If you previously staged one of these packages with `install.mjs`, managed status and removal can
inspect its receipt. Remove any host registration in that app before deleting the prepared folder.
Do not treat file staging as a connected or running bot. Do not delete a Bot to remove this package: that can delete its conversation and routines.
[Official Bot lifecycle](https://docs.x.ai/grok-bot/bots) and
[skills and routines](https://docs.x.ai/grok-bot/skills-routines-and-automations) describe the host;
the exact private-package import and removal contract for Conquistador remains unverified.
