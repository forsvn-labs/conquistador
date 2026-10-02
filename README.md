# Conquistador

Conquistador gives your AI agent playbooks for marketing, growth, and product work: across
channels, services, and your product experience. Ask for an outcome, such as a cold email
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

You can also ask explicitly for product flows, UI specs, web and iOS builds, system architecture,
and technical docs. **Browse all areas** lists the marketing and growth groups above. The source
launcher also offers a bounded product-flow specification as a first task.

The published public alpha is **0.2.2**. See [what shipped](CHANGELOG.md). This checkout also
contains [unshipped first-use changes](PROGRESS.md); a local change is not a new npm release.

## Install and make one useful draft

You need Node 24 or later and an existing coding agent: Claude Code, Codex, Cursor, Copilot CLI,
or Grok CLI. Your agent supplies the model, usage plan, tools, and permissions. A repository is
optional: a supplied product brief is enough to start. No analytics, CRM, or email account
connection is needed to draft from facts you provide.

Choose one agent. For example, to preview and install the plugin into Codex:

```sh
npm install -g @forsvn/conquistador
conquistador add codex --dry-run
conquistador add codex --yes
```

Replace `codex` with `claude-code`, `cursor`, `copilot`, or `grok`. The installer keeps a shared
copy at `~/.conquistador/plugin` and registers the named host. The preview shows the host
commands or owned copy before changes. Check [installation scope and removal](INSTALL.md).
For a one-time CLI invocation, use `npx @forsvn/conquistador add codex --yes` instead.

Open a fresh session in that agent, select Conquistador in its skill picker, and ask for one
bounded result. In a repository, give it relevant file paths; without one, paste your brief.
Try one of the [three first-task templates and complete synthetic examples](docs/USAGE.md):

- Marketing: one welcome email, with full copy and send eligibility, kept as a draft
- Growth: correct funnel rates and one experiment brief, with competing explanations
- Product: a signup recovery specification, including failure states and acceptance criteria

Review the result, then give one correction in the same thread. The agent should apply it while
preserving your other facts. Draft approval does not authorize publication, spending, sending,
or implementation.

### The selected-agent launcher in this checkout

The unshipped launcher chooses one host **before** installation. With one available host it shows
that scope; with several it asks which to use. `--in codex` selects Codex for that run. It then
prepares that host, asks for a task, and opens the agent. It does not add every discovered host.

```sh
conquistador
conquistador "Draft one welcome email from our product brief" --in codex
conquistador --in codex --no-open
```

Published **0.2.2** still installs into all detected agents on a bare interactive start, even when
`--in` chooses a launch target. To keep its installation scoped, use the explicit `add AGENT`
commands above and start the task inside that agent. Do not treat this checkout's new launcher
behavior as shipped until a release is recorded.

Claude Code versions supporting prefill leave the task in the input box for you to review.
Codex, Cursor Agent, Copilot CLI, Grok CLI, and older Claude Code versions start the task at once.
Host launch, hook trust, playbook loading, and a useful result are separate checks.

For skills only, MCP clients, chat bots, or a per-project operator, see
[other installation routes](INSTALL.md). Type `/conquistador` inside your agent to explore, or
preview the playbooks for a task without running it:

```sh
conquistador brief "draft one welcome email for new trial users"
```

## How Conquistador makes the agent use the playbooks

Agents can skip reference files. Conquistador uses four layers to encourage and check reading;
the host must support and permit the relevant hooks:

1. **A briefing engine** picks the method and ranks the knowledge files for the task. A named
   platform, such as TikTok, Google Ads, or the App Store, always brings its platform guide and
   leaves other platforms' guides out.
2. **The MCP tool `conquistador_brief`** returns selected files inline and labels omitted or
   unavailable files for separate reads.
3. **The prompt hook** adds the must-read list to relevant prompts only. Coding prompts get
   nothing.
4. **The stop hook** checks the session transcript. If the agent answered without reading the
   must-read files, the hook sends it back once to read them and revise.

Each method also starts with a generated "Playbooks for this method" list, so skills-only installs
still point the agent at the right files.

The unshipped hook checks in this checkout require successful, complete returned file contents or
matching digests scoped to the current task. That evidence does not prove model understanding or
correct application. Unscoped, rotated, unsupported, or over-32-MiB transcripts fail open without
a reading-coverage claim; inspect the result rather than treating silence as a pass.

In a before-and-after test with headless Claude Code (two tasks, nine valid runs), the previous
plugin read 17% of the must-read playbooks and never cited them; for the pricing task it read
none. With the new plugin, the agent read all of them and cited them in every run. The sample is
small. Run `node tools/e2e/knowledge-use.mjs` to repeat the test.

A second test checks breadth without an agent session: `node tools/e2e/routing-breadth.mjs` runs
offline checks across the marketing and growth areas, every tour example, the three first-use
tasks, coding prompts that must get nothing, and agreement between the tour and its copies.

## Add your own playbooks

Your own notes can rank ahead of the built-in guidance:

```sh
conquistador playbooks add ~/notes/growth-playbooks
```

Conquistador reads Markdown files in place and never copies them into the product. Matching
files appear in briefs, hooks, and MCP results, labeled "Your playbook".

## Manage the plugin

```sh
conquistador agents                    # Detected hosts and recorded installation state
conquistador add codex --yes            # Add or repair the named host
conquistador update                    # Update previously installed hosts
conquistador remove codex              # Remove Conquistador from Codex
conquistador remove                    # Remove all tracked host registrations and shared plugin
npm uninstall -g @forsvn/conquistador   # Separately remove the global CLI
```

Removal preserves your playbooks, configuration, exports, and project deliverables. Keep your
own work outside installed product folders. See [route-specific lifecycle guidance](INSTALL.md).

`conquistador help --all` lists the other commands.

To turn the hooks off, set `CONQUISTADOR_HOOKS=off` or put `{"hooks": false}` in
`~/.conquistador/config.json`.

## What Conquistador does not do

- It does not publish, send, spend, or change an external system. It drafts the work and asks
  you to approve the action.
- It does not invent metrics, customer quotes, or product capabilities.
- The MCP server and hooks provide playbooks to your host, whose model and data policies apply.
  An HTTP deployment exposes that knowledge to its permitted clients; see [access and privacy](INSTALL.md#bots-and-remote-apps).
- Your agent supplies the model, tools, and permissions.

## More information

- [Installation](INSTALL.md)
- [Surfaces and knowledge review, September 2026](docs/REVIEW-2026-09-SURFACES.md)
- [Connection setup for live accounts](docs/INTEGRATIONS.md)
- [Public-alpha acceptance](docs/PRIVATE-ALPHA.md), [version policy](VERSIONS.md), and
  [development](CONTRIBUTING.md)

Conquistador is open source under the MIT license. The npm package is `@forsvn/conquistador`.
