# Conquistador

A free, open source marketing toolstack for coding and deployed agents. One skill, 35 commands,
21 plays, and a rule-based copy checker. Use it in your agent or add it as an app dependency.
Your agent supplies the model and runs the work.

[Documentation](https://conquistador.app/docs) · [npm](https://www.npmjs.com/package/@forsvn/conquistador) · [Releases](https://github.com/forsvn-labs/conquistador/releases)

Works with **Claude Code, Codex, Cursor, GitHub Copilot CLI, Grok CLI, Gemini CLI, OpenCode, Pi,
Hermes Agent, Antigravity CLI, Kiro CLI, Mistral Vibe, Qoder, Rovo Dev, Trae, and Trae CN**.
[Check what each agent installs](https://conquistador.app/docs/install/coding-agents).

## Install

You need Node 22.18 or later. To set up coding agents, run this in your project folder:

```sh
# npm
npm i -g conquistador@latest && conquistador

# Bun
bun add --global conquistador@latest && conquistador
```

This installs the permanent `conquistador` command and opens the TUI after installation succeeds.
Run `conquistador` later to manage agents, skills, MCP connections, hooks, and updates.
Use `-g` with npm. Without it, npm installs into the current project.

To run the installer once without a permanent CLI install:

```sh
npx conquistador@latest
bunx conquistador@latest
pnpm dlx conquistador@latest
```

These commands open the TUI directly. Choose **Keep the CLI installed** there to keep the command
with npm or Bun. You can also run `conquistador install-cli --package-manager=bun`.
Package installation runs no interactive lifecycle script, so CI and dependency installs finish normally.

### Choose an installation method

[Choose Skills, CLI, MCP, or Plugins](https://conquistador.app/install). Each path uses the same
playbooks. Client names and package managers are options inside those four paths.

| Method | Start here | What it adds |
|---|---|---|
| Skills | `npx skills add https://github.com/forsvn-labs/conquistador/tree/main/skills/conquistador --skill conquistador` | One skill folder. No hooks or MCP server |
| CLI | `npx conquistador@latest install` | Reviewed coding-agent setup. Apps use the dependency below |
| MCP | `npx conquistador@latest mcp` | Local stdio server. [Hosted MCP](https://conquistador.app/docs/install/hosted-mcp) accepts OAuth or API keys when the matching Worker is deployed |
| Plugins | `npx conquistador@latest plugins` | Native installation for Claude Code, Codex, Grok, Cursor, and Copilot CLI |

`conquistador skills` installs a project skill with the same review and ownership checks.
`conquistador mcp install` configures chosen desktop clients. Compatible plugin clients can load
[the prepared plugin bundle](https://github.com/forsvn-labs/conquistador/releases) with their own
installer. Features depend on the client; a shared format does not establish universal support.

From 0.8.0, the short-name `conquistador` CLI package pins the exact matching
`@forsvn/conquistador` release. App imports use the scoped package. Delivery and Worker
rollout are tracked in [ROADMAP.md](https://github.com/forsvn-labs/conquistador/blob/main/ROADMAP.md).

### Use inside your app

From 0.7.0, install the server dependency in your app folder:

```sh
npm i @forsvn/conquistador@^0.8.0
# Or: bun add @forsvn/conquistador@^0.8.0
```

```js
import { createConquistador } from '@forsvn/conquistador';
import { createMcpRequestHandler } from '@forsvn/conquistador/mcp';
const cq = createConquistador({ receiptKey: process.env.CONQUISTADOR_RECEIPT_KEY });
const brief = cq.callTool('conquistador_brief', { task: 'Write a cold email.', context: productFacts });
```

Your existing agent gets the tool definitions and executes them in the app server. Mount MCP
on the app's port or run it as a separate service. Imports use only bundled playbooks and caller
context. See [the app guide](docs/APP-INTEGRATION.md) and
[runnable example](examples/app-integration/README.md). Run `conquistador app`, or choose
**Use in an app** in the TUI manager, for the setup commands.

### Use the TUI

The terminal only installs Conquistador. The work happens inside your coding agent. The
full-screen installer takes about a minute. Agent configuration changes only after you confirm
the review.

1. **Agents.** All 16 supported agents are visible. Select several with checkboxes; detected
   agents start selected. Search with `/`, toggle with Space, select all with `A`, or clear with
   `n`. It also reports an older CLI on your PATH or a newer npm release.
2. **Options.** All projects or only this project. Global installs use a plugin with hooks and
   MCP for agents that support the plugin; other agents get a skill folder. Project installs copy
   one skill folder you can commit. Turn on more places if you want them: **MCP clients** (Claude
   Desktop, VS Code, Windsurf, Zed, Cursor), **Executor**, **chat bot files**, or **Hosted MCP**
   for deployed agents. Choose npm or Bun to keep the permanent `conquistador` command.
3. **Review.** Every change, what stays unchanged, and how to undo it.
4. **Install.** Installs the plugin or skill for each selected agent, then checks each install.
5. **Done.** The exact start command for each selected agent. Initialize the project with
   Conquistador there. Enter opens the manager. `q` exits with a saved terminal summary.

Run `conquistador` again to manage agents, project skills, MCP clients, hooks, and the CLI. Installed
items show each scope and path, with controls to update or remove one item. Updates and repairs
stay inside the TUI. Use `--plain` or `TERM=dumb` for line prompts. `conquistador add` opens the
installer again. Skip the questions in scripts:

```sh
npx conquistador@latest --providers=claude,codex --scope=project -y
npx conquistador@latest --surface=agents,mcp-apps -y
npx conquistador@latest --dry-run          # Show the plan; change nothing
npx conquistador@latest --json             # The plan as JSON
```

Without a terminal and without `-y`, the installer prints the plan and exits with code 2.

MCP clients connect to the local Conquistador server. Executor 2 uses its own app/account setup
and **Connect an agent** flow. Automatic Conquistador setup on Executor 2 is pending; the TUI
shows the manual steps. See [MCP setup](https://conquistador.app/docs/install/mcp-apps).

Keep it current and healthy:

```sh
conquistador update     # Update the CLI and every install
conquistador doctor     # Find drift; add --fix to repair it
conquistador remove     # Remove Conquistador from your agents
```

![Conquistador installer with all 16 agents visible and independent checkboxes](https://github.com/user-attachments/assets/488400c3-d2da-4211-b2c2-f30e9cdc8812)

## Why Conquistador

Ask an agent for a launch plan or a cold email and you get generic advice. Conquistador gives the
agent the playbook for that exact task, makes it read the playbook before it drafts, and makes it
show which rules it applied.

- **One setup step.** `/conquistador init` records your product and growth context in `PRODUCT.md`
  and `GROWTH.md`. Every later command reads them, so the agent does not learn your product again.
- **A short vocabulary.** One-word commands such as `position`, `outreach`, `launch`, and `audit`.
- **Plays.** A play chains commands in order. `launch` runs positioning, the campaign plan,
  launch posts, launch copy, an audit, and a measurement plan.
- **A checker that needs no model.** `conquistador check` finds unsupported claims, AI-writing
  tells, vague calls to action, channel limits, email compliance gaps, and bad links.

## What is included

### One skill: conquistador

```text
/conquistador <command> [target]
/conquistador <plain request>
```

Start each project with:

```text
/conquistador init
```

`init` reads the project, asks only about gaps (at most three questions per round), and writes
`PRODUCT.md` and `GROWTH.md`.
It adds only missing facts to a `PRODUCT.md` that another tool wrote.

### Commands

| Group | Commands |
|---|---|
| Strategy | `position`, `brand`, `pricing`, `channels`, `budget`, `funnel`, `diagnose`, `prioritize`, `shape`, `decide` |
| Plan | `campaign`, `event` |
| Create | `copy`, `social`, `outreach`, `article`, `video`, `ads`, `creative`, `ideas`, `vietnamese` |
| Grow | `seo`, `convert` |
| Review | `audit`, `critique`, `factcheck` |
| Learn | `measure`, `results` (`ads`, `outreach`, `video`), `watch` |
| Product | `flow`, `ui`, `architect`, `build` (`web`, `ios`), `docs` |
| Setup | `init`, `connect`, `check`, `review`, `doctor`, `pin`, `unpin`, `feedback` |

### Plays

| Play | Does |
|---|---|
| `launch` | Launch a product or feature |
| `gtm` | Go from positioning to a campaign |
| `plan` | Build a growth plan from a target |
| `landing` | Create a landing page |
| `lifecycle` | Run a lifecycle email campaign |
| `referral` | Design a referral loop |
| `outbound` | Write and run an outreach sequence |
| `press` | Earn media coverage |
| `content` | Run a content research and publishing loop |
| `series` | Plan and script a short-form video series |
| `paid` | Run a paid campaign from brief to results |
| `expand` | Turn a channel choice into a campaign |
| `answers` | Track and improve visibility in AI answers |
| `pseo` | Build programmatic search pages |
| `report` | Review content performance |
| `trailer` | Create an app preview video |
| `appstore` | Improve an App Store or Google Play listing |
| `qa` | Review creative assets before launch |
| `interactive` | Build an interactive campaign |
| `experiment` | Run a measured growth experiment |
| `spec` | Specify a product experience |

You do not need to know which commands are plays. Type the command or describe the task; the
router picks the skill or the play.

Make a shortcut for a command you use often: `/conquistador pin outreach` creates `/outreach`.
`/conquistador unpin outreach` removes it.

### Check, connect, and review

- `conquistador check FILE|FOLDER|URL`: rule-based checks for marketing text. JSON output with
  `--json`. Exit code 0 is clean, 2 is findings, 1 is a scan failure. A hook runs it after the agent
  edits a marketing file.
- `conquistador connect`: checks capabilities through the legacy Executor 1 adapter. For
  Executor 2, use its [Connect an agent flow](https://executor.sh/docs/mcp-clients). Native v2
  capability discovery is pending.
- `conquistador review FILE`: opens a deliverable for human review. Markdown opens in Proof for
  comments and suggestions. HTML opens in Lavish.

## Usage examples

```text
/conquistador init
/conquistador outreach churned customers
/conquistador launch
/conquistador position against the two biggest competitors
/conquistador ads results from last month's Meta campaign
/conquistador check landing/index.html
/conquistador write a win-back email flow for trial users who never activated
```

The CLI also gives your agent context. These commands print and change nothing:

```sh
conquistador "Plan our Product Hunt launch"   # The playbooks this task needs
conquistador tour                             # What Conquistador covers, by area
conquistador check landing/index.html         # Check copy against fixed rules
```

## How Conquistador makes the agent read the playbooks

1. **A briefing engine** picks the command or play and ranks the playbooks for the task. A named
   platform, such as TikTok or Google Ads, brings its platform guide and leaves the others out.
2. **The MCP tool `conquistador_brief`** returns the selected playbooks inline.
3. **The prompt hook** adds the must-read list to marketing prompts. Coding prompts get nothing.
4. **The stop hook** checks the transcript. If the agent answered without reading the must-read
   files, the hook sends it back once to read them and revise.

Each command also lists its playbooks, so an install without hooks still points the agent at the
right files. Add your own playbooks; they rank first:

```sh
conquistador playbooks add ~/notes/growth-playbooks
```

Turn the hooks off with `conquistador hooks off` (in your agent: `/conquistador hooks off`), and
back on with `conquistador hooks on`. `--no-hooks` at install and `CONQUISTADOR_HOOKS=off` also turn
them off. Hooks run in Claude Code, Codex, Cursor, GitHub Copilot CLI, and Grok CLI; INSTALL.md lists
what each agent gets.

## What Conquistador does not do

- It does not publish, send, spend, or write to an external system without your explicit approval
  each time.
- It does not invent metrics, customer quotes, or product capabilities.
- It does not supply a model. Your agent supplies the model, tools, and permissions.

## More information

- [Documentation](https://conquistador.app/docs): install options, use, copy check,
  deployed agents, troubleshooting, and reference. Source: [docs source](https://github.com/forsvn-labs/conquistador/tree/main/docs-site)
- [Install, update, and remove](https://conquistador.app/docs/install/overview)
- [Old skill names and their commands](https://github.com/forsvn-labs/conquistador/blob/main/MIGRATION.md)
- [What shipped](https://github.com/forsvn-labs/conquistador/blob/main/CHANGELOG.md)

Conquistador is open source under the MIT license. The npm package is `@forsvn/conquistador`.
