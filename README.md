# Conquistador

Growth, marketing, sales, and product playbooks for AI coding agents. One skill, 35 commands, 21
plays that chain them, and a rule-based checker for marketing copy.

> **Quick start:** In your project folder, run `npx @forsvn/conquistador`. Then type
> `/conquistador init` in your agent.

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
- `conquistador connect`: shows which capabilities (analytics, ads, CRM, email, social, search,
  payments) are connected through [Executor](https://executor.sh/), and adds the
  ones a task needs. Any provider that Executor reaches works.
- `conquistador review FILE`: opens a deliverable for human review. Markdown opens in Proof for
  comments and suggestions. HTML opens in Lavish.

## Install

You need Node 22.18 or later and a coding agent.

```sh
npx @forsvn/conquistador
```

The installer takes about a minute. Nothing changes until you confirm the review.

1. Warns you when an older `conquistador` on your PATH would run instead, or when npm has a newer
   version.
2. Asks where you want Conquistador: **coding agents**, **MCP apps** (Claude Desktop, VS Code,
   Windsurf, Zed, Cursor), **Executor**, **chat bots**, or **Hosted MCP** for deployed agents (when
   available). What it found on this computer is chosen for you.
3. Asks the details: which agents, all projects or only this one, prompt hooks, which apps.
4. Shows every change, what stays unchanged, and how to undo it.
5. Installs, then checks each install.
6. Offers to open your agent with `/conquistador init` when the project has no `GROWTH.md`, then
   a first task, or **Finish for now**, with a summary of what is installed where.

Run `conquistador add` to open the installer again. Skip the questions in scripts:

```sh
npx @forsvn/conquistador --providers=claude,codex --scope=project -y
npx @forsvn/conquistador --surface=agents,mcp-apps -y
npx @forsvn/conquistador --dry-run          # Show the plan; change nothing
npx @forsvn/conquistador --json             # The plan as JSON
```

Without a terminal and without `-y`, the installer prints the plan and exits with code 2.

Supported agents: Claude Code, Codex, Cursor, GitHub Copilot CLI, Grok CLI, Gemini CLI, OpenCode,
Pi, Hermes Agent, Antigravity CLI, Kiro CLI, and Mistral Vibe. [INSTALL.md](INSTALL.md) lists the
folder each one uses.

To keep the `conquistador` command, install it globally:

```sh
npm install -g @forsvn/conquistador
conquistador
```

Keep it current and healthy:

```sh
conquistador update     # Update the CLI and every install
conquistador doctor     # Find drift; add --fix to repair it
conquistador remove     # Remove Conquistador from your agents
```

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

From a terminal, open your agent with a task already typed in:

```sh
conquistador "Plan our Product Hunt launch"
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

Turn the hooks off with `--no-hooks` at install, `CONQUISTADOR_HOOKS=off`, or `{"hooks": false}` in
`~/.conquistador/config.json`.

## What Conquistador does not do

- It does not publish, send, spend, or write to an external system without your explicit approval
  each time.
- It does not invent metrics, customer quotes, or product capabilities.
- It does not supply a model. Your agent supplies the model, tools, and permissions.

## More information

- [Install, update, and remove](INSTALL.md)
- [Old skill names and their commands](MIGRATION.md)
- [What shipped](CHANGELOG.md)

Conquistador is open source under the MIT license. The npm package is `@forsvn/conquistador`.
