# Install Conquistador

The published public alpha is **0.2.2**. Choose one route and use that route's update and removal
commands. The plugin route can provide playbook-reading hooks where the host supports and trusts
them; an installed plugin does not by itself prove that hooks or model execution work.

This checkout includes [unshipped first-use changes](PROGRESS.md). The scoped explicit-install
commands below work with published 0.2.2; the new selected-host launcher is labeled separately.

## Before you start

- Node 24 or later: `node --version`
- An existing supported coding agent and its model/usage access for the plugin route
- A product folder **or** a short supplied brief; no dummy repository is required

Drafting from supplied material needs no marketing-service account or new connection. Install
and log in to your coding agent through its own instructions if it is not available yet.

## Plugin for coding agents (recommended)

Install the CLI, preview one target, then add it. This example chooses Codex:

```sh
npm install -g @forsvn/conquistador
conquistador add codex --dry-run
conquistador add codex --yes
conquistador agents
```

Open a new Codex session, select Conquistador, and use a [first-task template](docs/USAGE.md).
For other hosts, replace `codex` with `claude-code`, `cursor`, `copilot`, or `grok`.

### Scope and undo

- The shared plugin copy is `~/.conquistador/plugin` (or `CONQUISTADOR_HOME/plugin` when set).
  Updating that shared copy also changes the files already registered hosts read from it.
- Only the named host registrations are added or repaired. Their native plugin managers own
  their registration/configuration; Cursor receives an owned local-plugin copy instead.
- The plugin includes a read-only playbook MCP server and host-specific hooks. Review their
  trust requirements below. No project dependency, lockfile, background job, or campaign is added.
- Preview with `conquistador add codex --dry-run`; it prints the proposed commands without
  creating files, changing registrations, remembering a choice, or launching an agent.
- Undo that registration with `conquistador remove codex`. An all-host removal with
  `conquistador remove` also removes the owned shared plugin after host removal succeeds.

The stable copy survives npm global-prefix changes caused by Node version managers. Your
personal playbooks and `~/.conquistador/config.json` stay outside it. Do not edit the installed
plugin as a place to save your own work.

### Selected-host start flow (unshipped)

In this source checkout, `conquistador` chooses the target **before** installation. A single
available host is shown as the scope. With several, choose one; `--in AGENT` selects it directly.
Only that host is prepared, then the task picker opens. A remembered launch choice does not
authorize adding newly detected hosts.

```sh
conquistador
conquistador "Draft one welcome email from our brief" --in codex
conquistador --in codex --no-open       # Prepare Codex without launching it
conquistador --in codex --dry-run       # Preview without writes or launch
```

The preview names the shared location, selected host changes, and undo command. A canceled
host choice makes no installation changes. If a later task choice is canceled after installation,
the installed scope is reported; it is not described as a rollback. If installation fails, use
`conquistador add AGENT --yes` for that target after addressing the reported error.

On **published 0.2.2**, bare interactive `conquistador` and `--no-open` install into all detected
agents; `--in` changes only the launch target. Use the explicit named `add` route above for a
bounded 0.2.2 install, then start work in that host. The source changes here have not been released.

Without an interactive terminal, start prints a command or prompt; it does not install or launch.
Installation and host discovery do not establish hook trust, loaded playbooks, task execution,
or useful output. Check those separately in a fresh host session.

### Supported agent installation mechanisms

| Agent | Host changes | Task launch behavior |
| --- | --- | --- |
| Claude Code | `claude plugin marketplace add` and `claude plugin install` | `claude --prefill "PROMPT"` where supported; press Enter to send |
| Codex | `codex plugin marketplace add` and `codex plugin add` | `codex "PROMPT"` starts immediately; review hook trust in `/hooks` |
| Cursor | Owned copy at `~/.cursor/plugins/local/conquistador` (or `CURSOR_HOME/plugins/local/conquistador`) | `cursor-agent "PROMPT"` starts immediately; editor-only users reload the window and paste the prompt |
| GitHub Copilot CLI | `copilot plugin marketplace add` and `copilot plugin install` | `copilot -i "PROMPT"` starts immediately |
| Grok CLI | `grok plugin install --trust` | `grok "PROMPT"` starts immediately; selecting installation grants plugin trust |

Claude Code prefill was observed from version 2.1.283. Older versions, or
`CONQUISTADOR_PREFILL=off`, send the prompt immediately instead. Host versions and trust can
change execution behavior; the table describes installer mechanisms, not a model-quality claim.

### Status, repair, update, and removal

```sh
conquistador agents                       # Found hosts and recorded registrations
conquistador add codex --dry-run           # Preview the exact target's changes
conquistador add codex --yes               # Add or repair that target
conquistador add --all --yes               # Explicitly add all detected hosts
conquistador update --dry-run              # Preview the update
conquistador update                        # Latest package; tracked hosts only
conquistador remove codex --dry-run        # Preview named removal
conquistador remove codex                  # Remove the named host registration
conquistador remove                       # Remove all tracked hosts and owned shared plugin
npm uninstall -g @forsvn/conquistador      # Remove the separately installed npm executable
```

With several detected hosts, the unshipped `add` flow requires named agents or an explicit
`--all`; a single detected host may be selected with its scope shown. `--yes` authorizes the
listed scope. It does not add unrelated detected hosts during update. Unknown agent names fail
without changing anything. A dry run neither writes nor launches.

A named removal keeps the shared plugin for other clients. Removing all tracked hosts removes
that owned plugin only after successful removal. Playbooks read in place, configuration,
exported bot packs, project artifacts, and the npm executable are preserved. Remove the global
CLI with npm only after removing its host registrations if you want both gone. A project
operator is a separate route and has separate removal commands below.

`agents` reports installer records and detection, not a universal ready state. Start a fresh
session to verify discovery, trust hooks where desired, and complete a task plus a correction.
A failed host removal remains a recovery task; do not assume that a nonzero exit cleaned up all
registrations.

### Run without a global CLI

```sh
npx @forsvn/conquistador add codex --dry-run
npx @forsvn/conquistador add codex --yes
npx @forsvn/conquistador agents
npx @forsvn/conquistador remove codex
```

This still installs the persistent plugin and host registration, but leaves no global
`conquistador` executable. Use the `npx @forsvn/conquistador` prefix for later lifecycle commands.

### Exact published version

Pin npm when you need reproducible acquisition: `npm install -g @forsvn/conquistador@0.2.2`.
For a Git tag, `--ignore-scripts` skips npm lifecycle scripts and `--install-links` copies the
checkout out of npm's temporary storage:

```sh
npm install -g --ignore-scripts --install-links git+https://github.com/forsvn-labs/conquistador.git#v0.2.2
```

### Install from inside Claude Code

```text
/plugin marketplace add forsvn-labs/conquistador
/plugin install conquistador@conquistador
```

### What the plugin contains

- 39 skills: the Conquistador parent and 38 methods.
- An MCP server named `conquistador` with the tools `conquistador_brief`, `conquistador_search`,
  and `conquistador_read`. It only reads playbooks.
- Hooks for Claude Code, Codex, and Cursor: a prompt hook that adds the must-read list to
  relevant prompts, and a stop hook that sends the agent back once if it skipped those files.
  Cursor cannot add context per prompt, so it gets the protocol at session start instead.

The playbook MCP server and hooks run bundled Node scripts and read local playbooks. Package
acquisition and host plugin-manager operations can use the network; they are separate from the
read-only playbook tools. A host may send loaded context to its model under its own data policy.

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

After an explicit `conquistador add AGENT --yes`, a stable copy exists at `~/.conquistador/plugin`. Point clients at it so
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
conquistador bot --out ./conquistador-bot --no-private
```

Review `SYSTEM-PROMPT.md` before pasting it into the app's instructions. Upload **only the
knowledge files listed in the generated README**, after reviewing their contents and destination.
Do not upload ownership metadata or unrelated files in the output folder. `--no-private` excludes
your own playbooks; without it, configured personal playbooks are included in
`knowledge/99-your-playbooks.md`. Exporting locally does not authorize uploading private content.

This checkout's unshipped exporter stages a complete pack and records owned files with hashes.
It replaces only an unchanged owned pack. A pre-fix export without an ownership manifest,
unknown files, or modified generated files is refused: preserve the old folder and choose a
fresh `--out` directory. Do not delete personal files merely to force a rebuild.

Rebuilding with `--no-private` removes the private file from an unchanged owned **local** pack.
It cannot remove anything previously uploaded to a chat app; inspect and remove those old
uploads in that app separately if needed. Published 0.2.2 does not provide these new replacement
safeguards, so use a fresh output directory when rebuilding a pack from that release.

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
| No supported agent is found | Install a supported coding agent through its official instructions, then preview `conquistador add AGENT --dry-run`. Drafting still needs no marketing-service connection. |
| `… exists and was not created by Conquistador` | Inspect and preserve that folder. Move it yourself if appropriate, then retry `conquistador add AGENT --yes`; the installer must not overwrite unowned work. |
| `The Conquistador package at … is incomplete` | Reinstall the package, then retry `conquistador add AGENT --yes`. A rejected staged copy must not replace the last good copy. |
| `Conquistador stopped: …` | Inspect the printed `Details:` file locally. Redact private paths and data before choosing to share a report. `CONQUISTADOR_DEBUG=1` prints the full error. |
| `Conquistador requires Node 24 or later` | Install Node 24 or later, open a new terminal, and run the command again. No installation success should be inferred from this error. |
| A host install fails | Read its error and preview the named scope again, then retry `conquistador add AGENT --yes`. Check `conquistador agents` for partial state. |
| The agent does not list Conquistador | Start a new session. In Cursor, reload the window. Check the host's plugin listing. Hook trust is a separate choice from discovery. |
| Hooks are off or denied | Use Conquistador explicitly and ask it to read the selected playbooks. This has no hook enforcement; verify actual reading and output separately. |
| The agent ignores the playbooks | Run `conquistador brief "TASK"` to inspect the reading list. If you want hooks, check `CONQUISTADOR_HOOKS`, `config.json`, and host trust. A citation alone does not prove correct use. |
| MCP server fails after a Node switch | Check the active Node executable and point the client at `~/.conquistador/plugin/mcp/server.mjs`. Confirm a read works in that client. |

For route-specific local diagnostics, use the original installer: plugin status is
`conquistador agents`; the optional project operator uses `conquistador operator status` and
`conquistador operator doctor --json` in its receiving project. Neither proves host/model readiness.
