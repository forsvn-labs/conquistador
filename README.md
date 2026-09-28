# Conquistador

Conquistador gives your AI agent field-tested playbooks for marketing and growth: on any
platform, in any service, and inside your product. Ask for an outcome, such as a cold email
sequence, a paywall experiment, an SEO plan, or a TikTok series. The agent reads the playbooks for
that exact task, does the work, and shows which playbooks it applied.

## What it covers

| Area | Covers |
| --- | --- |
| Strategy and research | Positioning, ICP, competitors, pricing, channel choice, budget, growth targets |
| Launches and campaigns | Product Hunt, Hacker News, App Store, feature launches, seasonal campaigns, webinars, live events |
| Social, community, and video | X, LinkedIn, Reddit, Instagram, Facebook, TikTok, YouTube, Threads, Bluesky, Discord, communities |
| Search and AI answers | Google SEO, programmatic SEO, ChatGPT and Perplexity answers, App Store and Google Play listings |
| Paid ads | Google, Meta, LinkedIn, TikTok, Reddit, and YouTube ads, UGC creators, creative briefs, results reviews |
| Email, outreach, and PR | Cold email, sales follow-ups, LinkedIn DMs, welcome and win-back emails, newsletters, press, podcasts, partners |
| Growth inside the product | Onboarding, activation, paywalls, trials, upgrade prompts, referral loops, checkout and page conversion |
| Copy, content, and brand | Landing and product pages, blog posts, case studies, brand voice and identity, Vietnamese copy |
| Measure and learn | Growth drops, results reviews, campaign and video evaluations, marketing audits, fact checks |

It also covers product flows, UI specs, web and iOS builds, system architecture, and technical
docs. Run `conquistador` and choose **Browse all areas** to see each one.

Version 0.0.16 is a private-alpha candidate. See [what changed](CHANGELOG.md).

## Install and start

You need Node 24 or later and an AI coding agent: Claude Code, Codex, Cursor, Copilot CLI, or
Grok CLI. Open a terminal in your product's folder and run:

```sh
npm install -g --ignore-scripts --install-links git+https://github.com/forsvn-labs/conquistador.git#v0.0.16
conquistador
```

`conquistador` installs into every agent it finds, asks what to work on, and opens your agent
with the task already typed:

```text
◇  Installed into Claude Code, Codex
◆  What should we work on?
│  ● Plan marketing and growth for this project
│  ○ Get more signups to become active users
│  ○ Write a cold email sequence for our best customers
│  ○ Get our product recommended by ChatGPT and Perplexity
│  ○ Browse all areas…
│  ○ Something else…
└  Opening Claude Code. Press Enter to start.

❯ /conquistador Plan marketing and growth for this project. Learn the product from this folder
  first. Ask me only for what you cannot find.
```

Press Enter. The agent reads your repository to learn the product, then does the work. You do not
have to describe the product first. Outside a project folder, the agent asks you for the product,
audience, and goal.

Claude Code shows the task in its input box so you can edit it before you press Enter. Codex,
Cursor Agent, Copilot CLI, and Grok CLI start the task at once. With several agents, Conquistador
asks once which one to open and remembers your choice.

Run `conquistador` again for the next task. To skip the questions, name the task:

```sh
conquistador "Write a win-back email flow for churned subscribers"
```

For skills only, MCP clients, chat bots, or a per-project copy, see
[other ways to install](INSTALL.md).

Type `/conquistador` with no task to see what it covers inside your agent. The answer ends with
**Playbooks applied**, which lists each file the agent used and the rule it took from it. To see
which playbooks a task needs before you ask, run:

```sh
conquistador brief "build a win-back email flow for churned subscribers"
```

## How Conquistador makes the agent use the playbooks

Agents often skip reference files. Conquistador uses four layers so that it does not happen:

1. **A briefing engine** picks the method and ranks the knowledge files for the task. A named
   platform, such as TikTok, Google Ads, or the App Store, always brings its platform guide and
   leaves other platforms' guides out.
2. **The MCP tool `conquistador_brief`** returns those playbooks in full, in one call.
3. **The prompt hook** adds the must-read list to relevant prompts only. Coding prompts get
   nothing.
4. **The stop hook** checks the session transcript. If the agent answered without reading the
   must-read files, the hook sends it back once to read them and revise.

Each method also starts with a generated "Playbooks for this method" list, so skills-only installs
still point the agent at the right files.

In a before-and-after test with headless Claude Code (two tasks, nine valid runs), the previous
plugin read 17% of the must-read playbooks and never cited them; for the pricing task it read
none. With the new plugin, the agent read all of them and cited them in every run. The sample is
small. Run `node tools/e2e/knowledge-use.mjs` to repeat the test.

A second test checks breadth without an agent session: `node tools/e2e/routing-breadth.mjs` runs
105 checks: 82 marketing tasks across nine areas (including every tour example), 20 coding
prompts that must get nothing, and checks that the tour and its copies agree.

## Add your own playbooks

Your own notes can rank ahead of the built-in guidance:

```sh
conquistador playbooks add ~/notes/growth-playbooks
```

Conquistador reads Markdown files in place and never copies them into the product. Matching
files appear in briefs, hooks, and MCP results, labeled "Your playbook".

## Commands

```sh
conquistador           # Pick a task and open your agent with it (installs on first run)
conquistador "TASK"    # Open your agent with this task
conquistador update    # Update to the latest version
conquistador remove    # Uninstall
```

Inside your agent, `/conquistador [TASK]` does the same.

`conquistador help --all` lists the other commands.

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
