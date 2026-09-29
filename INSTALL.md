# Install Conquistador

Choose one route. The plugin is recommended because it is the only route with hooks that check
that the agent read the playbooks.

## Before you start

- Node 24 or later: `node --version`.
- Git access to the private repository. If Git asks for credentials, run `gh auth setup-git`.

## Plugin for coding agents (recommended)

Install the command, then run it with no arguments:

```sh
npm install -g --ignore-scripts --install-links git+https://github.com/forsvn-labs/conquistador.git#v0.0.17
conquistador
```

The command does these steps:

1. It finds the supported agents on your computer and installs into all of them. It does not ask.
   An agent you removed by name (`conquistador remove grok`) stays removed until you add it again.
2. It copies the plugin to `~/.conquistador/plugin` and registers that folder with each agent's
   own plugin manager.
3. It asks what to work on, then opens your agent with the task typed in. With several agents, it
   asks once which one to open and remembers the choice.

Later runs skip step 1 and 2 unless the version changed, a new agent appeared, or the plugin copy
is missing or damaged. A damaged copy is repaired.
`conquistador --no-open` installs and stops. `conquistador "TASK" --in codex` opens one agent for
one run. Without a terminal (a script or a pipe), `conquistador "TASK"` only prints the command
it would run.

The stable copy matters: with nvm or another Node version manager, the npm global folder changes
when you switch Node versions. The agents point at `~/.conquistador/plugin`, not at npm.

`--ignore-scripts` skips npm lifecycle scripts. `--install-links` makes npm copy the Git checkout
instead of linking to temporary files.

### Run once without a global install

```sh
npx -y --ignore-scripts --package=git+https://github.com/forsvn-labs/conquistador.git#v0.0.17 conquistador
```

This installs into your agents and opens one, like the global command. It leaves no `conquistador`
command behind, so you use the same long line again for the next task, `update`, or `remove`. On
the test machine the first run took 24 seconds and later runs about 5 seconds. Inside your agent,
`/conquistador` works either way.

### Supported agents

| Agent | How the installer adds the plugin | How `conquistador` opens it |
| --- | --- | --- |
| Claude Code | `claude plugin marketplace add` and `claude plugin install` | `claude --prefill "PROMPT"`: the task waits in the input box for Enter |
| Codex | `codex plugin marketplace add` and `codex plugin add` | `codex "PROMPT"`: starts at once. Trust the plugin hooks when Codex asks (`/hooks`) |
| Cursor | Copies the plugin to `~/.cursor/plugins/local/conquistador` | `cursor-agent "PROMPT"`. With the editor only, the prompt is copied for you to paste; run **Developer: Reload Window** first |
| GitHub Copilot CLI | `copilot plugin marketplace add` and `copilot plugin install` | `copilot -i "PROMPT"`: starts at once |
| Grok CLI | `grok plugin install --trust` (running `conquistador` is the consent) | `grok "PROMPT"`: starts at once |

`--prefill` is not in `claude --help`. Conquistador uses it from Claude Code 2.1.283, where it was
tested. With an older version, or with `CONQUISTADOR_PREFILL=off`, Claude Code starts the task at
once instead.

Without a terminal, or in scripts, use flags:

```sh
conquistador add claude-code codex --yes   # Install into named agents
conquistador add --dry-run                 # Print the commands only
conquistador agents                        # Show what is found and installed
conquistador update                        # Reinstall this version into every agent you installed into
conquistador remove                        # Remove from every agent and delete ~/.conquistador/plugin
```

### Install from inside Claude Code

```text
/plugin marketplace add forsvn-labs/conquistador
/plugin install conquistador@conquistador
```

Claude Code must be able to read the private repository.

### What the plugin contains

- 39 skills: the Conquistador parent and 38 methods.
- An MCP server named `conquistador` with the tools `conquistador_brief`, `conquistador_search`,
  and `conquistador_read`. It only reads playbooks.
- Hooks for Claude Code, Codex, and Cursor: a prompt hook that adds the must-read list to
  relevant prompts, and a stop hook that sends the agent back once if it skipped those files.
  Cursor cannot add context per prompt, so it gets the protocol at session start instead.

The plugin runs bundled Node scripts only. It installs no dependencies and makes no network
requests.

To turn off the hooks, set `CONQUISTADOR_HOOKS=off`, or add `{"hooks": false}` to
`~/.conquistador/config.json`.

## Skills only

For any agent that reads `SKILL.md` skills:

```sh
npx skills add https://github.com/forsvn-labs/conquistador/tree/private-alpha/skills
```

This installs all 39 skills (about 9 MB) into the agents you choose. Point it at the `skills/`
folder as shown: the repository root holds a single entry skill, and the tool stops there.

Skills-only installs have no hooks and no MCP server. Each method starts with a
"Playbooks for this method" list that tells the agent what to read.

## MCP server for any MCP client

Run the server over stdio:

```sh
conquistador mcp
```

After `conquistador add`, a stable copy exists at `~/.conquistador/plugin`. Point clients at it so
that a Node version switch does not break them:

```json
{
  "mcpServers": {
    "conquistador": { "command": "node", "args": ["/Users/YOU/.conquistador/plugin/mcp/server.mjs"] }
  }
}
```

Use this shape in Claude Desktop, Cursor, Windsurf, and most clients. VS Code uses a `servers`
key in `.vscode/mcp.json` with `"type": "stdio"`. Command-line agents have their own command, for
example `codex mcp add conquistador -- conquistador mcp`.

## Bots and remote apps

### Apps with MCP connectors (Muse, ChatGPT developer mode, Claude.ai connectors)

Host the HTTP server, then add its URL as a connector:

```sh
CONQUISTADOR_MCP_TOKEN=choose-a-secret conquistador mcp --http --host 0.0.0.0 --port 8787
```

- Endpoint: `POST /mcp` (JSON-RPC over HTTP). Health check: `GET /health`.
- Send `Authorization: Bearer <token>` when `CONQUISTADOR_MCP_TOKEN` is set.
- To deploy in a container, build `docker build -f mcp/Dockerfile -t conquistador-mcp .` from the
  repository root. The image contains the playbooks and core Node modules only.

The server is read-only. Anyone with the URL and token can read the playbooks.

### Apps with instructions and knowledge files

For ChatGPT GPTs, Claude Projects, Grok projects, and Gemini Gems:

```sh
conquistador bot --out ./conquistador-bot
```

Paste `SYSTEM-PROMPT.md` into the app's instructions, and upload the files in `knowledge/`
(12 files, fewer than the tightest common upload limit). If you configured your own playbooks,
the pack includes them in `99-your-playbooks.md`. Add `--no-private` to leave them out.

## Your own playbooks

```sh
conquistador playbooks add ~/notes/growth-playbooks
conquistador playbooks list
```

You can also set `CONQUISTADOR_PLAYBOOKS` to one or more folders, separated by `:`, or put
Markdown files in `~/.conquistador/playbooks`. Conquistador reads them in place.

## Per-project operator

`conquistador project` installs a per-project copy in `.conquistador/`, with the portable
operator contracts and the BB specialist adapter. The flags `--skills`, `--plugin`, `--mcp`,
`--bot`, and `--advanced` also still work. See the
[per-project installation guide](docs/INSTALL-PROJECT.md).

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| 0.0.16 stops with `ENOENT … conquistador.tmp-NNNN/.conquistador-owned.json` | 0.0.16 copied an empty plugin from npm installs. Install 0.0.17 with the command above and run `conquistador` again. It removes the leftover folder and repairs every agent. |
| `… exists and was not created by Conquistador` | A folder that you or another tool made is in the way. Move or delete it, then run `conquistador` again. The other agents install anyway. |
| `The Conquistador package at … is incomplete` | The npm install is damaged. Install again with the command above. Your agents keep the last good copy. |
| `Conquistador stopped: …` | Open the `Details:` file it prints, and send it with a report. `CONQUISTADOR_DEBUG=1` prints the full error. |
| `Conquistador requires Node 24 or later` | Install Node 24 or later, open a new terminal, and run the command again. |
| An agent shows `✗` after install | Run the printed command yourself to see the full error, then run `conquistador add AGENT --yes`. |
| The agent does not list Conquistador | Start a new session. In Cursor, reload the window. In Codex, trust the hooks. |
| The agent ignores the playbooks | Check that hooks are on (`CONQUISTADOR_HOOKS` unset), and run `conquistador brief "TASK"` to see what it should read. |
| MCP server fails after a Node switch | Point the client at `~/.conquistador/plugin/mcp/server.mjs`. |
