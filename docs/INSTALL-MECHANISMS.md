# Acquisition and host mechanisms

Primary documentation reviewed on 2026-09-17. These mechanisms explain how to distribute and
activate packages. They do not establish that Conquistador has been activated in a native host.
Use [INSTALL.md](../INSTALL.md) for the short private-alpha path and
[PLATFORMS.md](PLATFORMS.md) for host-specific commands.

| Mechanism | Official contract | Conquistador choice |
| --- | --- | --- |
| npm CLI | npm exec/npx runs a package executable and can keep fetched packages in its cache. A global install exposes its bin command. [npm exec](https://docs.npmjs.com/cli/v11/commands/npm-exec/), [npm install](https://docs.npmjs.com/cli/v11/commands/npm-install/) | Verified private tarball plus setup; optional persistent CLI. No receiving-project dependency or postinstall mutation. |
| Claude Code | Native plugins have host-managed scopes and discover skills/agents. Enabled plugins can start bundled MCP servers; host trust and approvals still apply. [Plugin reference](https://code.claude.com/docs/en/plugins-reference) | Prefer the native manager for plugins; stage a local source when necessary. This package declares no automatic MCP server or hook. |
| Codex | Plugins use a configured marketplace and fresh session; local skills can use .agents/skills. [Plugins](https://learn.chatgpt.com/docs/plugins), [skills](https://learn.chatgpt.com/docs/build-skills), [packaging](https://learn.chatgpt.com/docs/build-plugins) | Native manager owns activated copies. Project skill is a separate option. Portable JSON is not native agent registration. |
| ChatGPT and other AI apps | OpenAI plugins can include skills and connected apps. App setup/authentication and account permissions remain separate. [OpenAI plugin help](https://help.openai.com/en/articles/20001256) | No public listing or universal private import is claimed. Use only a declared compatible private/local plugin mechanism or a client-supported connector. |
| Copilot CLI | Its plugin manager handles discovery, installation, updates and removal; marketplace compatibility includes .claude-plugin. [Plugin reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-plugin-reference) | Native user-level plugin is separate from the project operator or project skill. |
| Cursor | Skills use project .cursor/skills or .agents/skills. Cursor also accepts Agent Plugins, with host-specific behavior for MCP path variables. [Skills](https://cursor.com/docs/skills), [plugin reference](https://prod.cursor.com/docs/reference/plugins) | Project skill is available; compatible plugin import uses host controls. Do not invent a universal CLI command or claim a Cursor-native agent package. |
| Agent Skills | SKILL.md frontmatter/instructions and contained resources define a portable skill format. [Specification](https://agentskills.io/specification) | Keep methods contained. A format match does not guarantee discovery, tool access, or execution. |
| Agent Plugins 1.0 | Root plugin.json, skills/ and optional mcp.json define fixed discovery for supported components. [Specification](https://agent-plugins.org/specification) | Portable plugin boundary only where the consuming client declares support; native metadata remains separate. |
| Skills CLI | The upstream CLI supports installing selected skills from repositories or local paths into host skill locations. [Upstream documentation](https://github.com/vercel-labs/skills#install-a-skill) | Keep the tested 1.5.26 root-copy procedure as a secondary route, with its own update/removal owner. |
| Local MCP | The client registers command/args and owns a stdio subprocess. [Local-server guide](https://modelcontextprotocol.io/docs/develop/connect-local-servers) | Prepare a durable local connector and library; never imply full operator execution or automatic client registration. |
| MCP Registry | The public registry requires a publicly available install/server and remains preview. [Registry documentation](https://modelcontextprotocol.io/registry/about) | Unsuitable for this private alpha; no publication or listing step. |
| Portable agent/squad | Conquistador's [agent contracts](../agents/agent-package-v2.schema.json) and [BB adapter](../hosts/coding-agent/README.md) define its own execution interface. | A consuming host adapter must execute them. No universal agent-import standard or verified Eve/Grok activation is assumed. |

Native discovery, enabled state, trust approval, account authentication, and useful task execution
are separate observations. A wizard can explain the next step without bypassing any of them.
Public marketplaces, public package registries, or hosted MCP services require a later distribution
and authorization decision. None is required to use the complete operator on supplied facts.
