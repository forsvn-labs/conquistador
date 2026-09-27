# Conquistador

Conquistador gives your AI agent field-tested playbooks for growth, GTM, launches, marketing,
and sales. Ask for an outcome, such as a launch plan, pricing tiers, or landing page copy. The
agent reads the playbooks for that exact task, does the work, and shows which playbooks it
applied.

Version 0.0.15 is a private-alpha candidate. See [what changed](CHANGELOG.md).

## Install

You need Node 24 or later, and at least one supported agent.

```sh
npm install -g --ignore-scripts --install-links git+https://github.com/forsvn-labs/conquistador.git#v0.0.15
conquistador
```

The `conquistador` command finds the agents on your computer, asks which ones to use, and
installs the Conquistador plugin with each agent's own plugin manager. Install once; it works in
every project.

Until the v0.0.15 tag is published, the latest verified private release is v0.0.14, which has
the older per-project installer:
`npm install -g --ignore-scripts --install-links git+https://github.com/forsvn-labs/conquistador.git#v0.0.14`.

### Choose how to use it

| You use | Install | You get |
| --- | --- | --- |
| Claude Code, Codex, Cursor, Copilot CLI, or Grok CLI | `conquistador` | Plugin: 39 skills, the playbook MCP server, and hooks |
| Claude Code, from inside the app | `/plugin marketplace add forsvn-labs/conquistador`, then `/plugin install conquistador@conquistador` | Same plugin |
| Any agent that reads `SKILL.md` skills | `npx skills add https://github.com/forsvn-labs/conquistador/tree/private-alpha/skills` | Skills only |
| Any MCP client (Windsurf, Zed, VS Code, Claude Desktop) | Add a server that runs `conquistador mcp` | Playbook tools |
| Muse, ChatGPT, or another app with MCP connectors | Host `conquistador mcp --http`, then add its URL | Playbook tools over HTTP |
| ChatGPT GPTs, Claude Projects, Grok projects, Gemini Gems | `conquistador bot` | A system prompt and upload-ready knowledge files |
| One project only, with the full operator contracts | `conquistador project` | Per-project copy in `.conquistador/` |

The plugin is the recommended route. Only the plugin route includes the hooks that check that the
agent read the playbooks. See [installation](INSTALL.md) for each route in detail.

## Start your first task

Open a new session in your agent and ask:

```text
Plan a Product Hunt launch for <product>. We launch in <date> and have <facts>.
```

The answer ends with **Playbooks applied**, which lists each file the agent used and the rule it
took from it. To see which playbooks a task needs before you ask, run:

```sh
conquistador brief "plan a Product Hunt launch for a developer tool"
```

## How Conquistador makes the agent use the playbooks

Agents often skip reference files. Conquistador uses four layers so that it does not happen:

1. **A briefing engine** picks the method and ranks the knowledge files for the task. A named
   platform, such as Product Hunt or TikTok, always brings its platform pack and channel guide.
2. **The MCP tool `conquistador_brief`** returns those playbooks in full, in one call.
3. **The prompt hook** adds the must-read list to relevant prompts only. Coding prompts get
   nothing.
4. **The stop hook** checks the session transcript. If the agent answered without reading the
   must-read files, the hook sends it back once to read them and revise.

Each method also starts with a generated "Playbooks for this method" list, so skills-only installs
still point the agent at the right files.

In a before-and-after test, the previous plugin read 2 knowledge files for a launch plan and
skipped the Product Hunt pack. The new plugin read the method and 6 playbooks, including the
Product Hunt pack, and cited them. Run `node tools/e2e/knowledge-use.mjs` to repeat the test.

## Add your own playbooks

Your own notes can rank ahead of the built-in guidance:

```sh
conquistador playbooks add ~/notes/growth-playbooks
```

Conquistador reads Markdown files in place and never copies them into the product. Matching
files appear in briefs, hooks, and MCP results, labeled "Your playbook".

## Commands

```sh
conquistador                   # Find your agents and install
conquistador agents            # Show detected agents and what is installed
conquistador update            # Update every agent you installed into
conquistador remove [AGENT]    # Remove from one agent, or from all of them
conquistador brief "TASK"      # Show the playbooks for a task (--full prints them)
conquistador playbooks add DIR # Add your own playbook folder
conquistador mcp [--http]      # Run the playbook MCP server
conquistador bot [--out DIR]   # Write a bot pack for chat apps
```

To turn the hooks off, set `CONQUISTADOR_HOOKS=off` or put `{"hooks": false}` in
`~/.conquistador/config.json`.

## What Conquistador does not do

- It does not publish, send, spend, or change an external system. It drafts the work and asks
  you to approve the action.
- It does not invent metrics, customer quotes, or product capabilities.
- The MCP server and hooks only read playbooks. They do not send your data anywhere.
- Your agent supplies the model, tools, and permissions.

## More information

- [Installation](INSTALL.md)
- [Surfaces and knowledge review, September 2026](docs/REVIEW-2026-09-SURFACES.md)
- [Connection setup for live accounts](docs/INTEGRATIONS.md)
- [Private-alpha acceptance](docs/PRIVATE-ALPHA.md), [version policy](VERSIONS.md), and
  [development](CONTRIBUTING.md)

The repository is private. npm publication stays disabled until the public alpha (0.1.0).
