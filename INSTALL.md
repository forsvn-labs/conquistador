# Install Conquistador

The docs site has this guide with more detail: <https://conquistador.forsvn.com/docs/install/overview>.
This file is the full install reference that ships in the npm package.

## Before you start

- Node 22.18 or later: `node --version`
- A coding agent from the table below, logged in through its own instructions

You do not need a marketing-service account to draft from facts you supply.

## Install

Run the installer in your project folder, with the package manager you use:

```sh
npx @forsvn/conquistador
bunx @forsvn/conquistador
pnpm dlx @forsvn/conquistador
```

The terminal only installs Conquistador into your coding agents. The work happens inside the agent:
you type `/conquistador` there. The CLI never opens an agent and never runs a task.

Or install the CLI globally, then run it:

```sh
npm install -g @forsvn/conquistador
conquistador
```

`conquistador` runs the installer the first time: a full-screen terminal UI with five steps. It
takes about a minute, and nothing changes until you confirm the review.

1. **Agents.** The coding agents it found are chosen; Space changes a choice. Problems found before
   the start show here: another `conquistador` earlier on your PATH (or with another version), or a
   newer version on npm, each with the exact fix.
2. **Options.** All projects or only this project, prompt hooks on or off, and more places for
   Conquistador: MCP apps, Executor, chat bot files, and Hosted MCP. The arrow keys change a value.
3. **Review.** Every change with its path or command, what stays unchanged, and how to undo it.
4. **Install**, one line per step. A step that fails does not stop the others. Then a verify pass
   runs the `conquistador doctor` checks for each surface and one MCP handshake.
5. **Done.** What to type in each agent: `/conquistador init` in a project without `GROWTH.md`,
   otherwise `/conquistador`. When you exit, the summary stays in your terminal.

Escape, `q`, or Ctrl-C before the install changes nothing. Ctrl-C during the install does not stop a
step half way. Run `conquistador` again to see what is installed, with actions to add agents,
update, check and repair, or remove. `conquistador add` opens the installer again. `--plain` (or
`TERM=dumb`) gives line prompts instead of the full screen.

### Surfaces

| Surface | `--surface` | What it installs | Found by |
|---|---|---|---|
| Coding agents (recommended) | `agents` | The plugin (skill, hooks, local MCP server) for Claude Code, Codex, Cursor, Copilot CLI, and Grok CLI. A skill copy for the other agents in the table below | The agent's command on PATH or its home folder |
| MCP apps | `mcp-apps` | An entry named `conquistador` in the app's MCP config: Claude Desktop, VS Code, Windsurf, Zed, Cursor. It runs `~/.conquistador/plugin/mcp/server.mjs` with the Node that ran the installer | The app's config folder |
| Hosted MCP | `hosted` | Sign in with GitHub, then print the client config for deployed agents and remote apps | Shown only when this version can sign in, and only online |
| Executor | `executor` | A source in [Executor](https://executor.sh), so every agent connected to Executor gets the playbook tools | `executor` on PATH |
| Chat bots | `bot` | A system prompt and knowledge files for GPTs, Claude Projects, Grok projects, and Gems (`conquistador bot`) | Never chosen for you |

An app is never set up twice. An agent with the plugin already has the MCP server, so the MCP apps
step leaves out Cursor when Cursor gets the plugin.

MCP apps: before Conquistador changes a config file, it saves a copy next to it
(`FILE.conquistador-backup`) and keeps every other server and setting. It never rewrites a file that
is not plain JSON, for example a Zed `settings.json` with comments. It shows the entry to add by
hand instead.

Executor: the installer runs `executor call executor mcp addServer`. Executor asks to approve the
change, and the installer says yes for that one change, because you approved it in the review. When
Executor is installed but not running, the review says so and the step starts it
(`executor daemon run`). An Executor version without `mcp.addServer` gets the steps to add the
source by hand. Executor 1.5.40 can add a source but cannot remove or replace one from the command
line: `conquistador remove` then tells you to remove it in the Executor app (`executor web`).

### Options

| Option | Does |
|---|---|
| `--surface=NAME[,NAME]` | Install these surfaces: `agents`, `mcp-apps`, `hosted`, `executor`, `bot`. Skips the surfaces question |
| `--providers=NAME[,NAME]` | Install for these agents. Names: `claude` (or `claude-code`), `codex`, `cursor`, `copilot`, `grok`, `gemini`, `opencode`, `pi`, `hermes`, `antigravity`, `kiro`, `vibe` |
| `--scope=global` | Install for all projects. Agents with a plugin manager get the plugin: the skill, hooks, and the MCP server |
| `--scope=project` | Copy the one skill into this project's skill folder. Commit it to share it with your team. No hooks or MCP server |
| `--apps=NAME[,NAME]` | MCP apps: `claude-desktop`, `vscode`, `windsurf`, `zed`, `cursor` |
| `--executor-name=NAME` | The source name in Executor. Default: `conquistador` |
| `--bot-out=DIR` | The folder for the chat bot files. Default: `./conquistador-bot` |
| `-y`, `--yes` | Accept the defaults: the detected agents and the default scope (global, or project when this project already has a copy). Without `--surface`, only coding agents. In a terminal, the installer goes straight to the install and closes by itself |
| `--no-hooks` | Install without prompt hooks. Writes `{"hooks": false}` to `~/.conquistador/config.json` |
| `--dry-run` | Show the plan. Change nothing |
| `--json` | Print the plan as JSON (schema `conquistador.onboarding-plan/v1`). Change nothing |
| `--plain` | Line prompts with no color and no cursor moves. `TERM=dumb` does the same. `NO_COLOR` turns off color only |
| `--in AGENT` | Install for this agent (the same as `--providers=AGENT`) |

Without a terminal and without `--yes`, the installer prints the plan, changes nothing, and exits
with code 2. With `--yes`, it installs, runs the verify pass, prints the summary, and exits with
code 1 when a step or a check failed.

```sh
npx @forsvn/conquistador --providers=claude,codex --scope=project -y
npx @forsvn/conquistador --surface=agents,mcp-apps --apps=claude-desktop -y
npx @forsvn/conquistador --providers=pi,hermes --scope=global --dry-run
npx @forsvn/conquistador --surface=agents,executor --json
```

The old flags still work. `--mcp`, `--plugin`, `--skills`, `--bot`, and `--advanced` open the
installer with that surface chosen and print the new flag. With a route option (`--host`, `--path`,
`--url`, a bot name such as `--bot hermes`, or `--help`), they keep the older per-project route
([docs/INSTALL-PROJECT.md](docs/INSTALL-PROJECT.md)).

### Agents and folders

Folders come from each agent's documentation (checked 2026-10-03). Agents that share a project
folder share one copy. "Start with" is what you type in the agent; the installer's last screen
shows the same.

| Agent | `--providers` | Global install | Project folder | Start with |
|---|---|---|---|---|
| Claude Code | `claude` | Plugin: `claude plugin install` | `.claude/skills/conquistador` | `/conquistador` |
| Codex | `codex` | Plugin: `codex plugin add` | `.agents/skills/conquistador` | "Use Conquistador: …" |
| Cursor | `cursor` | Plugin copy in `~/.cursor/plugins/local/conquistador` | `.agents/skills/conquistador` | "Use Conquistador: …" |
| GitHub Copilot CLI | `copilot` | Plugin: `copilot plugin install` | `.agents/skills/conquistador` | "Use Conquistador: …" |
| Grok CLI | `grok` | Plugin: `grok plugin install --trust` | `.grok/skills/conquistador` | "Use Conquistador: …" |
| Gemini CLI | `gemini` | `~/.gemini/skills/conquistador` | `.agents/skills/conquistador` | "Use Conquistador: …" |
| OpenCode | `opencode` | `~/.config/opencode/skills/conquistador` | `.agents/skills/conquistador` | "Use Conquistador: …" |
| Pi | `pi` | `~/.agents/skills/conquistador` | `.agents/skills/conquistador` | `/skill:conquistador` |
| Hermes Agent | `hermes` | `~/.hermes/skills/conquistador` (`$HERMES_HOME` inside your home folder) | `.hermes/skills/conquistador` | `/conquistador` |
| Antigravity CLI | `antigravity` | `~/.gemini/antigravity-cli/skills/conquistador` | `.agents/skills/conquistador` | `/conquistador` |
| Kiro CLI | `kiro` | `~/.kiro/skills/conquistador` | `.kiro/skills/conquistador` | "Use Conquistador: …" |
| Mistral Vibe | `vibe` | `~/.vibe/skills/conquistador` | `.agents/skills/conquistador` | "Use Conquistador: …" |

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
- The global plugin copy is `~/.conquistador/plugin` (`CONQUISTADOR_HOME/plugin` when set). Agents
  with a plugin manager read it. Do not save your own work in it.

### Install from inside Claude Code

```text
/plugin marketplace add forsvn-labs/conquistador
/plugin install conquistador@conquistador
```

### Exact version

```sh
npm install -g @forsvn/conquistador@0.4.0
npm install -g --ignore-scripts --install-links git+https://github.com/forsvn-labs/conquistador.git#v0.4.0
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
conquistador remove               # Remove every install: agents, MCP app entries, the Executor source
conquistador remove codex         # Remove one agent
conquistador remove --scope=project
npm uninstall -g @forsvn/conquistador
```

Without a global CLI, put `npx @forsvn/conquistador` in front of each command.

`remove` keeps your playbooks, `~/.conquistador/config.json`, bot exports, project deliverables,
`PRODUCT.md`, and `GROWTH.md`. It deletes only folders that hold `.conquistador-owned.json`.

`doctor` checks:

- **Install**: the plugin copy, each global install, each project skill copy, each MCP app entry,
  and the Executor source match this version. It warns when one agent loads both the global plugin
  and a project copy.
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

The installer configures Claude Desktop, VS Code, Windsurf, Zed, and Cursor for you
(`--surface=mcp-apps`). For another client, run the server:

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

## Hosted server

The hosted server at `https://mcp.forsvn.com/mcp` serves the bundled playbooks, the brief, and the
check over Streamable HTTP. Each request needs a personal token. Sign in with GitHub to get one. You
do not need anyone's approval.

In a browser, open <https://mcp.forsvn.com/signup> and sign in with GitHub. The next page shows your
token once, with the configuration for Claude Code, Claude Desktop, Cursor, and other MCP clients.
Copy the token before you leave the page.

In a terminal (Conquistador 0.4.0 and later):

```sh
conquistador login     # sign in with GitHub and save a token
conquistador whoami    # show who the saved token belongs to
conquistador logout    # revoke the token and delete your record
```

`login` shows a code and a GitHub address. Enter the code there. The command saves the token to
`~/.conquistador/mcp-token`, which only you can read, and prints the client configuration. If that
file held another token, for example a server admin token, `login` moves it to `mcp-token.previous`.
To use another deployment, set `CONQUISTADOR_MCP_URL` or pass `--server URL`.

- Each GitHub account has one active token. When you sign in again, you get a new token and the
  old one stops working.
- Each token can send 60 requests per minute. Over the limit, the server answers 429 and says how
  many seconds to wait (`retry-after`).
- A token that is not used for a year stops working. Sign in again to get a new one.
- After a new sign-in or a logout, the old token can still work for up to 60 seconds in other
  Cloudflare locations.

### Privacy

The server stores this for each person who signs in:

- the GitHub user id and login;
- a SHA-256 hash of the token, not the token itself;
- when the token was made, when it was last used, and its status (active or blocked).

The server does not store your GitHub access token, email address, or repositories. It asks GitHub
only for your public profile, and it revokes the GitHub access token as soon as it reads your user
id. The Worker does not log the text of your requests.

To delete your record, run `conquistador logout`, or send:

```sh
curl -X POST https://mcp.forsvn.com/api/logout -H "Authorization: Bearer YOUR_TOKEN"
```

Both revoke the token and delete your record at once. If you lost the token, sign in again, then
log out. To remove the app from your GitHub account too, open GitHub, Settings, Applications,
Authorized OAuth Apps.

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

To host it on Cloudflare Workers, sign in once, set the secrets, create the token store, then
deploy from the repository root:

```sh
npx wrangler@4.148.0 login
openssl rand -hex 32 | npx wrangler@4.148.0 secret put CONQUISTADOR_MCP_TOKEN
openssl rand -hex 32 | npx wrangler@4.148.0 secret put CONQUISTADOR_RECEIPT_KEY
npx wrangler@4.148.0 kv namespace create conquistador-tokens
```

Copy the `id` that the last command prints into `wrangler.toml`, under `[[kv_namespaces]]` with
`binding = "TOKENS"`. Then deploy:

```sh
npx wrangler@4.148.0 deploy
```

`CONQUISTADOR_MCP_TOKEN` is the admin token. Keep it for yourself and for tests. To let other
people sign up and get their own tokens (see [Hosted server](#hosted-server)), connect a GitHub
OAuth App once:

1. Open <https://github.com/organizations/YOUR_ORG/settings/applications/new> (or
   <https://github.com/settings/applications/new> for a personal account).
2. Set **Application name** to `Conquistador MCP`, **Homepage URL** to your site, and
   **Authorization callback URL** to `https://YOUR_HOST/signup/callback`.
3. Select **Enable Device Flow**, then **Register application**.
4. Select **Generate a new client secret**. Set both values on the Worker, then deploy again:

```sh
npx wrangler@4.148.0 secret put GITHUB_CLIENT_ID       # paste the Client ID
npx wrangler@4.148.0 secret put GITHUB_CLIENT_SECRET   # paste the client secret
npx wrangler@4.148.0 deploy
```

The browser sign-in works only on the host in the callback URL. `conquistador login` works on any
host. Without the two GitHub secrets, `/signup` answers 503 and only the admin token works.

The token limit is in `wrangler.toml`: change `limit` under `MCP_LIMITER` and
`RATE_LIMIT_PER_MINUTE` together. `SIGNUP_LIMITER` limits sign-in attempts from one IP address.
To block a GitHub account, set `"status": "blocked"` in its record:
`npx wrangler@4.148.0 kv key get user:GITHUB_ID --binding TOKENS --remote`, edit the JSON, and write
it back with `npx wrangler@4.148.0 kv key put user:GITHUB_ID 'JSON' --binding TOKENS --remote`.

`wrangler.toml` uploads `worker.mjs`, the server modules, `package.json`, and `skills/` unbundled,
so the server reads the library from the Worker bundle with `node:fs`. It never uploads your own
playbooks. The Worker refuses every MCP request with 503 until the admin token or the token store
is set. Run it locally with `npx wrangler@4.148.0 dev --var CONQUISTADOR_MCP_TOKEN:local-test`.

To test sign-up, run `node tools/e2e/signup.mjs`. It starts `wrangler dev` with a local token store
and a local stand-in for GitHub, and writes `dist/e2e/signup/report.md`. With the real OAuth App:

```sh
# Local Worker, real GitHub. You approve a device code in the browser.
GITHUB_CLIENT_ID=... GITHUB_CLIENT_SECRET=... node tools/e2e/signup.mjs --live
# The deployed Worker.
node tools/e2e/signup.mjs --live --url https://mcp.forsvn.com
```

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
calls `conquistador_verify` with the final text, that receipt, and the `context` and `channel` the
check had to use. Hand the draft over only when the result is `valid`, `clean`, and `signed`. The
server signs receipts with `CONQUISTADOR_RECEIPT_KEY`, a secret that callers never receive, so an
agent that holds the access token cannot forge or flip one, and a check run without the expected
context does not count. Without that key, receipts are unsigned: an agent can compute the hash
itself, so an unsigned receipt does not prove that a check ran.
[`examples/verify-gate`](examples/verify-gate/README.md) has a gate that any host can use, an MCP
client for it, and a Claude Agent SDK host that accepts drafts only through a `deliver` tool and
keeps the agent working until the gate accepts them.

Choose the model with this in mind. A Sonnet-class or stronger model completed the brief, check,
and revise loop unsupervised in our tests. A Haiku-class model (Haiku 4.5, 2026-10-07) produced a
usable draft from a compact brief but delivered text that failed the check while reporting it clean.
Use smaller models only where the host enforces the loop with signed `conquistador_verify` results.
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
`conquistador project` and the older `--skills`, `--plugin`, `--mcp`, and `--bot` routes (with
`--host`, `--path`, `--url`, or a bot name) still work; see the
[per-project installation guide](https://github.com/forsvn-labs/conquistador/blob/main/docs/INSTALL-PROJECT.md).

## Troubleshooting

| Symptom | Fix |
|---|---|
| No agent is found | Install a supported agent, or name one: `--providers=claude`. You can still install MCP apps, Executor, or chat bots |
| `The conquistador command on your PATH is version …` | An older copy runs instead of the one you installed. Run `npm i -g @forsvn/conquistador@latest`, or remove the old copy with the command the warning prints |
| `npm i @forsvn/conquistador` (without `-g`) gives no `conquistador` command | That puts the package in `./node_modules`. Use `npm i -g @forsvn/conquistador`, or run `npx @forsvn/conquistador` |
| An MCP app config `is not plain JSON` | The installer left it unchanged. Add the entry it printed by hand, or remove the comments and run `conquistador add` |
| Executor `cannot add a source from the command line` | Update Executor (`npm i -g executor`), or add the source by hand with the printed steps |
| `Not found on PATH` for a global install | Install that agent's CLI, or use `--scope=project` |
| `… exists and was not created by Conquistador` | Move that folder yourself, then retry. The installer never overwrites a folder it did not create |
| `The Conquistador package at … is incomplete` | Reinstall the package, then retry |
| `Conquistador needs Node 22.18 or later` | Install Node 22.18 or later, open a new terminal, and retry |
| The agent does not list Conquistador | Start a new session. In Cursor, reload the window. Run `conquistador doctor` |
| The agent ignores the playbooks | Run `conquistador brief "TASK"` to see the reading list. Check that hooks are on |
| `Conquistador stopped: …` | Read the `Details:` file. `CONQUISTADOR_DEBUG=1` prints the full error |
