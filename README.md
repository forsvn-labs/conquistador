# Conquistador

Growth, marketing, sales, and product playbooks for AI coding agents. One skill, 35 commands, 21
plays that chain them, and a rule-based checker for marketing copy.

> **Quick start:** In your project folder, run `npx @forsvn/conquistador`. Then type
> `/conquistador init` in your agent.
>
> **Documentation:** [INSTALL.md](INSTALL.md) and [docs-site/](docs-site/). The site at
> <https://conquistador.forsvn.com/docs> is not live yet.

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

You need Node 22.18 or later and a coding agent. Run the installer with your package manager:

```sh
npx @forsvn/conquistador        # or: bunx @forsvn/conquistador, pnpm dlx @forsvn/conquistador
```

The terminal only installs Conquistador. The work happens inside your coding agent. The
full-screen installer takes about a minute, and nothing changes until you confirm the review.

1. **Agents.** The agents it found are chosen for you. It warns you when an older `conquistador`
   on your PATH would run instead, or when npm has a newer version.
2. **Options.** All projects (plugin with prompt hooks and the MCP server) or only this project
   (one skill folder you can commit). Turn on more places if you want them: **MCP apps** (Claude
   Desktop, VS Code, Windsurf, Zed, Cursor), **Executor**, **chat bot files**, or **Hosted MCP**
   for deployed agents.
3. **Review.** Every change, what stays unchanged, and how to undo it.
4. **Install.** Each agent installs with its own plugin manager, then each install is checked.
5. **Done.** The exact command to type in each agent: `/conquistador init` in a project without
   `GROWTH.md`, otherwise `/conquistador`. The installer never opens an agent.

Run `conquistador` again to see what is installed and to add, update, repair, or remove. Use
`--plain` (or `TERM=dumb`) for line prompts without the full screen. Skip the questions in scripts:

Run `conquistador add` to open the installer again. Skip the questions in scripts:

```sh
npx @forsvn/conquistador --providers=claude,codex --scope=project -y
npx @forsvn/conquistador --surface=agents,mcp-apps -y
npx @forsvn/conquistador --dry-run          # Show the plan; change nothing
npx @forsvn/conquistador --json             # The plan as JSON
```

Without a terminal and without `-y`, the installer prints the plan and exits with code 2.

Supported agents: Claude Code, Codex, Cursor, GitHub Copilot CLI, Grok CLI, Gemini CLI, OpenCode,
Pi, Hermes Agent, Antigravity CLI, Kiro CLI, and Mistral Vibe.
[Coding agents](https://conquistador.forsvn.com/docs/install/coding-agents) lists the folder each
one uses.

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

Turn the hooks off with `--no-hooks` at install, `CONQUISTADOR_HOOKS=off`, or `{"hooks": false}` in
`~/.conquistador/config.json`.

## What Conquistador does not do

- It does not publish, send, spend, or write to an external system without your explicit approval
  each time.
- It does not invent metrics, customer quotes, or product capabilities.
- It does not supply a model. Your agent supplies the model, tools, and permissions.

## More information

- [Documentation](https://conquistador.forsvn.com/docs): install options, use, copy check,
  deployed agents, troubleshooting, and reference. Source: [`docs-site/`](docs-site/)
- [Install, update, and remove](https://conquistador.forsvn.com/docs/install/overview)
- [Old skill names and their commands](MIGRATION.md)
- [What shipped](CHANGELOG.md)

Conquistador is open source under the MIT license. The npm package is `@forsvn/conquistador`.
