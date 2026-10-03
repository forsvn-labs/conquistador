# Acquisition and host mechanisms

Primary documentation reviewed on 2026-09-17. These mechanisms explain how to distribute and
activate packages. They do not establish that Conquistador has been activated in a native host.
Use [INSTALL.md](../INSTALL.md) for the short public-alpha path and
[PLATFORMS.md](PLATFORMS.md) for host-specific commands.

| Mechanism | Official contract | Conquistador choice |
| --- | --- | --- |
| npm CLI | npm exec/npx runs a package executable and can keep fetched packages in its cache. A global install exposes its bin command. [npm exec](https://docs.npmjs.com/cli/v11/commands/npm-exec/), [npm install](https://docs.npmjs.com/cli/v11/commands/npm-install/) | Private `0.0.x`: persistent CLI from an authorized private Git release or tarball. Public alpha: publish `@forsvn/conquistador` and use `npm i -g @forsvn/conquistador` after registry acceptance. No receiving-project dependency or postinstall mutation. |
| Claude Code | Native plugins have host-managed scopes and discover skills/agents. Enabled plugins can start bundled MCP servers; host trust and approvals still apply. [Plugin reference](https://code.claude.com/docs/en/plugins-reference) | Prefer the native manager for plugins; stage a local source when necessary. This package declares no automatic MCP server or hook. |
| Codex | Plugins use a configured marketplace and fresh session; local skills can use .agents/skills. [Plugins](https://learn.chatgpt.com/docs/plugins), [skills](https://learn.chatgpt.com/docs/build-skills), [packaging](https://learn.chatgpt.com/docs/build-plugins) | Native manager owns activated copies. The guide creates a project skill for the selected host. Portable JSON is not native agent registration. |
| BB | The [BB adapter](../hosts/coding-agent/README.md) uses an existing project, environment and parent thread. BB supplies provider/model selection, permissions and thread lifecycle. | Separate from Codex native skill discovery. Setup places the operator files and adapter; it registers no BB plugin, provider skill, or request router. |
| ChatGPT and other AI apps | OpenAI plugins can include skills and connected apps. App setup/authentication and account permissions remain separate. [OpenAI plugin help](https://help.openai.com/en/articles/20001256) | No public listing or universal private import is claimed. Use only a declared compatible private/local plugin mechanism or a client-supported connector. |
| Copilot CLI | Its plugin manager handles discovery, installation, updates and removal; marketplace compatibility includes .claude-plugin. [Plugin reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference) | Native user-level plugin is separate from the project operator or project skill. |
| Cursor | Skills use project .cursor/skills or .agents/skills. Cursor also accepts Agent Plugins, with host-specific behavior for MCP path variables. [Skills](https://cursor.com/docs/skills), [plugin reference](https://prod.cursor.com/docs/reference/plugins) | Project skill is available; compatible plugin import uses host controls. Do not invent a universal CLI command or claim a Cursor-native agent package. |
| Agent Skills | SKILL.md frontmatter/instructions and contained resources define a portable skill format. [Specification](https://agentskills.io/specification) | Keep methods contained. A format match does not guarantee discovery, tool access, or execution. |
| Agent Plugins 1.0 | Root plugin.json, skills/ and optional mcp.json define fixed discovery for supported components. [Specification](https://agent-plugins.org/specification) | Portable plugin boundary only where the consuming client declares support; native metadata remains separate. |
| Skills CLI | The upstream CLI supports installing selected skills from repositories or local paths into host skill locations. [Upstream documentation](https://github.com/vercel-labs/skills#install-a-skill) | Use a staged parent-first input for the pinned 1.5.26 copier. It owns update/removal and writes skills-lock.json; managed setup is the no-lockfile default. |
| Local MCP | The client registers command/args and owns a stdio subprocess. [Local-server guide](https://modelcontextprotocol.io/docs/develop/connect-local-servers) | Prepare a durable local connector and library; never imply full operator execution or automatic client registration. |
| MCP Registry | The public registry requires a publicly available install/server and remains preview. [Registry documentation](https://modelcontextprotocol.io/registry/about) | Unsuitable for this private alpha; no publication or listing step. |
| Portable agent/squad | Conquistador's [agent contracts](../agents/agent-package-v2.schema.json) and [BB adapter](../hosts/coding-agent/README.md) define its own execution interface. | A consuming host adapter must execute them. No universal agent-import standard or verified Eve/Grok activation is assumed. |

Native discovery, enabled state, trust approval, account authentication, and useful task execution
are separate observations. A wizard can explain the next step without bypassing any of them.
Public marketplaces, public package registries, or hosted MCP services require a later distribution
and authorization decision. None is required to use the complete operator on supplied facts.

## Discovery budget and contained methods

Codex initially lists skill names, descriptions and paths, with a budget of 2% of model context or
8,000 characters when that size is unknown. It shortens descriptions before potentially omitting
skills; full instructions load after selection. Keep the trigger first and concise.
[OpenAI skill guidance](https://learn.chatgpt.com/docs/build-skills).

Conquistador's managed native skill and staged plugin therefore expose one parent. Its selected
methods live inside that entry as METHOD.md resources. This is an installer choice, not a claim that
hiding filenames makes content inaccessible or that a host always routes correctly. The methods
remain available after parent selection, with public capability labels shown during the job.

Agent Plugins discovers only immediate children of skills/ with SKILL.md. It forbids recursive
skill discovery and does not let plugin.json override the location. The staged one-entry layout
also avoids recursion in native skill folders. [Agent Plugins 1.0](https://agent-plugins.org/specification).
A Codex overlay cannot replace the portable plugin's fixed skills discovery with an arbitrary path.
[OpenAI plugin packaging](https://developers.openai.com/plugins/build/plugins).
Claude's native agent remains a separate component and reads the staged parent.
[Claude path rules](https://code.claude.com/docs/en/plugins-reference#path-behavior-rules).

Canonical source registration still exposes the authoring methods. Native managers cannot perform
Conquistador's local transformation implicitly. Stage first, then register that self-contained
folder. Standalone specialist installs are explicit additions. No Copilot or Cursor native-agent
parity is claimed merely because each can discover the plugin skill.

## Terminal interface choice

The next installer uses [Clack prompts](https://www.clack.cc/) `1.8.1`. Its multi-select, select, confirm, text,
spinner and cancellation primitives fit a short setup flow. The committed bundle is about 28 KB
and loads only for interactive setup. Its lockfile and licenses are under `tools/tui/` and
`tools/vendor/`; no dependency install is required in the receiving project or source/ZIP guide.
[Upstream source and API](https://github.com/bombshell-dev/clack/tree/main/packages/prompts).

[Inquirer](https://github.com/SBoudrias/Inquirer.js) also supplies maintained prompts. Clack gives
this installer the desired consistent layout without maintaining custom prompt themes.
[Ink](https://github.com/vadimdemedes/ink) uses React to build terminal applications and adds more
rendering machinery than this short guide needs. This is a bounded installer decision, not a
claim that Clack is best for a future full-screen product.

Cold Git-based npm acquisition runs before the CLI can show progress. A polished guide cannot
remove that delay. The recommended persistent CLI downloads once, then `conquistador` starts
locally. A one-time npx launcher remains available for users who prefer it.
