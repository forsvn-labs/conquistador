# Install Conquistador

## Before you start

- Node 22.18 or later: `node --version`
- A coding agent from the table below, logged in through its own instructions

You do not need a marketing-service account to draft from facts you supply.

## Install

Run the installer in your project folder:

```sh
npx @forsvn/conquistador
```

Or install the CLI globally, then run it:

```sh
npm install -g @forsvn/conquistador
conquistador
```

The installer shows the agents it found and asks you to keep that set or customize it. Then it
asks for the scope, installs, and opens one agent. In a project without `GROWTH.md`, the agent
opens with `/conquistador init`. Otherwise you pick a task.

### Options

| Option | Does |
|---|---|
| `--providers=NAME[,NAME]` | Install for these agents. Names: `claude` (or `claude-code`), `codex`, `cursor`, `copilot`, `grok`, `gemini`, `opencode`, `pi`, `hermes`, `antigravity`, `kiro`, `vibe` |
| `--scope=global` | Install for all projects. Agents with a plugin manager get the plugin: the skill, hooks, and the MCP server |
| `--scope=project` | Copy the one skill into this project's skill folder. Commit it to share it with your team. No hooks or MCP server |
| `-y`, `--yes` | Accept the detected agents and the default scope (global, or project when this project already has a copy) |
| `--no-hooks` | Install without prompt hooks. Writes `{"hooks": false}` to `~/.conquistador/config.json` |
| `--dry-run` | Show the plan and the launch command. Change nothing |
| `--in AGENT` | Open this agent |
| `--no-open` | Install only |

Without a terminal, the installer prints the plan and changes nothing, unless you add `-y`.

```sh
npx @forsvn/conquistador --providers=claude,codex --scope=project -y
npx @forsvn/conquistador --providers=pi,hermes --scope=global --dry-run
```

### Agents and folders

Folders and launch flags come from each agent's documentation (checked 2026-10-03). Agents that
share a project folder share one copy.

| Agent | `--providers` | Global install | Project folder | Opens with |
|---|---|---|---|---|
| Claude Code | `claude` | Plugin: `claude plugin install` | `.claude/skills/conquistador` | `claude --prefill "PROMPT"` (press Enter to send) |
| Codex | `codex` | Plugin: `codex plugin add` | `.agents/skills/conquistador` | `codex "PROMPT"` |
| Cursor | `cursor` | Plugin copy in `~/.cursor/plugins/local/conquistador` | `.agents/skills/conquistador` | `cursor-agent "PROMPT"` |
| GitHub Copilot CLI | `copilot` | Plugin: `copilot plugin install` | `.agents/skills/conquistador` | `copilot -i "PROMPT"` |
| Grok CLI | `grok` | Plugin: `grok plugin install --trust` | `.grok/skills/conquistador` | `grok "PROMPT"` |
| Gemini CLI | `gemini` | `~/.gemini/skills/conquistador` | `.agents/skills/conquistador` | `gemini -i "PROMPT"` |
| OpenCode | `opencode` | `~/.config/opencode/skills/conquistador` | `.agents/skills/conquistador` | `opencode --prompt "PROMPT"` |
| Pi | `pi` | `~/.agents/skills/conquistador` | `.agents/skills/conquistador` | `pi "/skill:conquistador ..."` |
| Hermes Agent | `hermes` | `~/.hermes/skills/conquistador` (`$HERMES_HOME` inside your home folder) | `.hermes/skills/conquistador` | Paste the prompt (copied for you) |
| Antigravity CLI | `antigravity` | `~/.gemini/antigravity-cli/skills/conquistador` | `.agents/skills/conquistador` | `agy -i "PROMPT"` |
| Kiro CLI | `kiro` | `~/.kiro/skills/conquistador` | `.kiro/skills/conquistador` | Paste the prompt (copied for you) |
| Mistral Vibe | `vibe` | `~/.vibe/skills/conquistador` | `.agents/skills/conquistador` | Paste the prompt (copied for you) |

Sources: [Claude Code](https://code.claude.com/docs/en/skills),
[Codex](https://learn.chatgpt.com/docs/build-skills), [Cursor](https://cursor.com/docs/context/skills),
[GitHub Copilot](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/create-skills),
[Grok](https://docs.x.ai/build/features/skills-plugins-marketplaces),
[Gemini CLI](https://geminicli.com/docs/cli/skills/), [OpenCode](https://opencode.ai/docs/skills/),
[Pi](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/skills.md),
[Hermes Agent](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills),
[Antigravity](https://antigravity.google/docs/skills), [Kiro](https://kiro.dev/docs/skills/),
[Mistral Vibe](https://docs.mistral.ai/vibe/code/cli/skills).

Notes:

- Codex asks once to trust the hooks. Type `/hooks` to trust them.
- Pi, Hermes, and Mistral Vibe load project skills only after you trust the project folder.
- Claude Code fills the prompt from version 2.1.283. Older versions, or
  `CONQUISTADOR_PREFILL=off`, send the prompt at once.
- The global plugin copy is `~/.conquistador/plugin` (`CONQUISTADOR_HOME/plugin` when set). Agents
  with a plugin manager read it. Do not save your own work in it.

### Install from inside Claude Code

```text
/plugin marketplace add forsvn-labs/conquistador
/plugin install conquistador@conquistador
```

### Exact version

```sh
npm install -g @forsvn/conquistador@0.3.0
npm install -g --ignore-scripts --install-links git+https://github.com/forsvn-labs/conquistador.git#v0.3.0
```

`--ignore-scripts` skips npm lifecycle scripts. `--install-links` copies the checkout out of npm's
temporary storage.

## Update, check, and remove

```sh
conquistador update               # Update the CLI, plugin installs, and skill copies
conquistador update --dry-run     # Show the update; change nothing
conquistador doctor               # Report drift in installs, hooks, and project context
conquistador doctor --fix         # Repair what a copy can repair
conquistador agents               # Show agents and install state
conquistador remove               # Remove every install, global and in this project
conquistador remove codex         # Remove one agent
conquistador remove --scope=project
npm uninstall -g @forsvn/conquistador
```

Without a global CLI, put `npx @forsvn/conquistador` in front of each command.

`remove` keeps your playbooks, `~/.conquistador/config.json`, bot exports, project deliverables,
`PRODUCT.md`, and `GROWTH.md`. It deletes only folders that hold `.conquistador-owned.json`.

`doctor` checks:

- **Install**: the plugin copy, each global install, and each project skill copy match this version.
- **Hooks**: each plugin manifest names a hook file that exists, and each script that file runs
  exists. It also reports when hooks are off.
- **Project**: `PRODUCT.md` and `GROWTH.md` exist, `GROWTH.md` covers its sections, and
  `.gitignore` has an entry for `.conquistador/`. Run `/conquistador init` to fix these.

## What the plugin contains

- The `conquistador` skill with its commands and plays.
- An MCP server named `conquistador` with the tools `conquistador_brief`, `conquistador_search`,
  and `conquistador_read`. It only reads playbooks.
- Hooks for Claude Code, Codex, and Cursor: a prompt hook that adds the must-read list to
  marketing prompts, and a stop hook that sends the agent back once if it skipped those files.

Turn off the hooks with `CONQUISTADOR_HOOKS=off` or `{"hooks": false}` in
`~/.conquistador/config.json`.

## MCP server for any MCP client

```sh
conquistador mcp
```

After a global install, point clients at the stable copy so that a Node version switch does not
break them:

```json
{
  "mcpServers": {
    "conquistador": { "command": "node", "args": ["/Users/YOU/.conquistador/plugin/mcp/server.mjs"] }
  }
}
```

VS Code uses a `servers` key in `.vscode/mcp.json` with `"type": "stdio"`.

## Bots and remote apps

For apps with MCP connectors, host the HTTP server and add its URL:

```sh
CONQUISTADOR_MCP_TOKEN=choose-a-secret conquistador mcp --http --host 0.0.0.0 --port 8787
```

- Endpoint: `POST /mcp`. Health check: `GET /health`.
- Send `Authorization: Bearer <token>` when `CONQUISTADOR_MCP_TOKEN` is set.
- Anyone with the URL and token can read the playbooks.
- The server also serves the playbooks you added on that machine. To serve only the bundled
  library, set `CONQUISTADOR_HOME` to an empty folder.

To host it on Cloudflare Workers, sign in once, set the token, then deploy from the repository root:

```sh
npx wrangler@4.148.0 login
openssl rand -hex 32 | npx wrangler@4.148.0 secret put CONQUISTADOR_MCP_TOKEN
openssl rand -hex 32 | npx wrangler@4.148.0 secret put CONQUISTADOR_RECEIPT_KEY
npx wrangler@4.148.0 deploy
```

`wrangler.toml` uploads `worker.mjs`, the server modules, `package.json`, and `skills/` unbundled,
so the server reads the library from the Worker bundle with `node:fs`. It never uploads your own
playbooks. The Worker refuses every MCP request with 503 until the token is set. Run it locally
with `npx wrangler@4.148.0 dev --var CONQUISTADOR_MCP_TOKEN:local-test`.

`wrangler.toml` serves the Worker at `mcp.forsvn.com`; replace the route with your own hostname.
On that host a zone configuration rule turns off Cloudflare's browser integrity check, so any HTTP
client works. The `workers.dev` address stays on, but Cloudflare refuses the default
`Python-urllib` User-Agent there with error 1010.

A deployed agent uses two tools in a loop: `conquistador_brief` with the task (and, when the agent
has no `PRODUCT.md`, the product facts in `context`), then `conquistador_check` on each draft with
its channel and the same `context`, which flags numbers and customer names the context lacks. Over
HTTP the brief returns structured lists (`inlined`, `readNow`, `readAtStep`, `situational`), and
`conquistador_read` resolves a relative link when you pass the linking file as `from`. Models with a
small context can ask for `size: "compact"`: the brief then inlines only the command and lists its
core files as required reads. When a rubric declares a gate, `conquistador_score` checks the agent's
self-score against the rubric's floors, totals, and hard fails before the agent reports a verdict.

Do not trust an agent's own report that its draft passed. Each `conquistador_check` result carries a
`receipt` for the exact text it checked. Before the host shows a draft to a person or sends it, it
calls `conquistador_verify` with the final text and that receipt: the result is valid only if the
text is unchanged and the receipt came from this server. The server signs receipts with
`CONQUISTADOR_RECEIPT_KEY`, a secret that callers never receive, so an agent that holds the access
token still cannot forge one. Without that key, receipts are unsigned and prove only the text match.

Choose the model with this in mind. A Sonnet-class or stronger model completed the brief, check,
and revise loop unsupervised in our tests. A Haiku-class model (Haiku 4.5, 2026-10-07) produced a
usable draft from a compact brief but delivered text that failed the check while reporting it clean.
Use smaller models only where the host enforces the loop with `conquistador_verify`.
`node tools/e2e/agent-loop.mjs --url https://HOST/mcp` checks that loop against a deployed server;
set `CONQUISTADOR_MCP_TOKEN` first.

For ChatGPT GPTs, Claude Projects, Grok projects, and Gemini Gems:

```sh
conquistador bot --out ./conquistador-bot --no-private
```

Read `SYSTEM-PROMPT.md` before you paste it. Upload only the knowledge files that the generated
README lists. `--no-private` leaves your own playbooks out.

## Your own playbooks

```sh
conquistador playbooks add ~/notes/growth-playbooks
conquistador playbooks list
```

You can also set `CONQUISTADOR_PLAYBOOKS` to folders separated by `:`, or put Markdown files in
`~/.conquistador/playbooks`. Conquistador reads them in place.

## Repository-only features

The npm package contains what users run: the CLI, the skill, hooks, the MCP server, the checker,
and the connect and review tools. The Eve runtime (`conquistador jobs`), evals, the typed catalog,
and the Docker images stay in the [repository](https://github.com/forsvn-labs/conquistador).
`conquistador project`, `--skills`, `--plugin`, `--mcp`, `--bot`, and `--advanced` still work;
see the [per-project installation guide](https://github.com/forsvn-labs/conquistador/blob/main/docs/INSTALL-PROJECT.md).

## Troubleshooting

| Symptom | Fix |
|---|---|
| No agent is found | Install a supported agent, or name one: `--providers=claude` |
| `Not found on PATH` for a global install | Install that agent's CLI, or use `--scope=project` |
| `… exists and was not created by Conquistador` | Move that folder yourself, then retry. The installer never overwrites a folder it did not create |
| `The Conquistador package at … is incomplete` | Reinstall the package, then retry |
| `Conquistador needs Node 22.18 or later` | Install Node 22.18 or later, open a new terminal, and retry |
| The agent does not list Conquistador | Start a new session. In Cursor, reload the window. Run `conquistador doctor` |
| The agent ignores the playbooks | Run `conquistador brief "TASK"` to see the reading list. Check that hooks are on |
| `Conquistador stopped: …` | Read the `Details:` file. `CONQUISTADOR_DEBUG=1` prints the full error |
