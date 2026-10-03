# Conquistador overhaul, October 2026

Status: approved by Hung on 2026-10-03 ("go with all the best recommendations"). Integration
branch: `overhaul/2026-10`, based on `fix/first-use-integrity` (PR #29). Each slice merges into
the integration branch through its own PR. The integration branch merges into `private-alpha`
only after Hung approves. No npm publish, tag, or marketplace submission without a separate
approval.

## Goal

Impeccable is to design what Conquistador must be to growth, marketing, product, and sales work.
Copy its strongest patterns: one skill, a small vocabulary of one-word commands, one `init` that
records durable context, a context-aware menu, a rule-based checker that needs no model, an
installer that detects agents and asks only scope, and `pin` shortcuts.

## Findings that drive this work

1. Hosts see 39 skills with long names. The 21 multi-skill workflows are hidden ("load
   privately"), and the briefing engine never selects them.
2. Skill bodies carry long evidence-boundary prose. The parent SKILL.md has 260 lines; Impeccable's
   has 89. The extra prose costs tokens on every call and reads poorly.
3. No durable growth context. Each task re-learns the product from the repository.
4. No deterministic check. Impeccable's detector is its most visible CLI feature.
5. The installer supports 5 agents and needs Node 24. Impeccable supports 17 and needs Node 22.18.
   The npm package is 12.9 MB with 1,695 files; most of it is runtime, catalog, and evals that a
   skills user does not need.
6. Collaboration (Proof) exists only in the unlicensed desktop experiment. Lavish is pinned at
   0.1.50; upstream is 0.1.80.
7. Conquistador keeps its own typed catalog of 17 provider operations. That conflicts with the
   provider-agnostic position. Executor already offers `tools search`, `tools describe`, `call`,
   and `resume`, which is enough to reach any provider the user connects.

## Decisions

### D1. One host skill, one command vocabulary

- Hosts register exactly one skill: `conquistador`. Users type `/conquistador <command> [target]`
  or `/conquistador <plain request>`.
- Every command is one lowercase word: the deliverable or action a marketer would say.
- A command is either a **skill** (one method) or a **play** (a declared chain of skills). Users do
  not need to know which. The menu groups them by job.
- Directory layout:
  - `skills/conquistador/SKILL.md`: the only host skill. Short, imperative, with the Commands table.
  - `skills/conquistador/commands/<command>/COMMAND.md`: one directory per skill command, with its
    `references/`, `agents/`, and `fallbacks/`. The file is `COMMAND.md`, not `SKILL.md`, so hosts
    that scan recursively do not register 38 extra skills.
  - `skills/conquistador/plays/<command>.md`: one file per play, with a YAML `chain:` front matter.
  - Shared folders (`standards/`, `channels/`, `references/`, `specialists/`, `rubrics/`, ...) stay
    under `skills/conquistador/`.
- `/conquistador pin <command>` writes a standalone host skill (for example `/outreach`) that loads
  that command through the parent. `unpin` removes it.
- Old IDs keep working as aliases. `MIGRATION.md` records every old-to-new mapping.

### D2. Command names

Skill commands (old ID → new command):

| Group | Command | Old ID |
|---|---|---|
| Strategy | `position` | research-positioning |
| Strategy | `brand` | create-brand |
| Strategy | `pricing` | design-pricing-and-packaging |
| Strategy | `channels` | research-channel |
| Strategy | `budget` | allocate-marketing-budget |
| Strategy | `funnel` | model-growth-funnel |
| Strategy | `diagnose` | diagnose-growth |
| Strategy | `prioritize` | prioritize-opportunities |
| Strategy | `shape` | shape-initiative |
| Strategy | `decide` | decision-panel |
| Plan | `campaign` | plan-campaign |
| Plan | `event` | create-run-of-show |
| Create | `copy` | write-copy |
| Create | `social` | write-social |
| Create | `outreach` | write-outreach |
| Create | `article` | write-longform |
| Create | `video` | create-shortform |
| Create | `ads` | create-paid-campaign |
| Create | `creative` | brief-creative |
| Create | `ideas` | research-content-ideas |
| Create | `vietnamese` | polish-vietnamese |
| Grow | `seo` | optimize-search |
| Grow | `convert` | improve-conversion |
| Review | `audit` | audit-marketing |
| Review | `critique` | fresh-eyes-review |
| Review | `factcheck` | knowledge-review |
| Learn | `measure` | measure-growth |
| Learn | `results` | evaluate-paid-campaign + evaluate-outreach + evaluate-shortform (modes: `ads`, `outreach`, `video`) |
| Learn | `watch` | analyze-video |
| Product | `flow` | map-user-flow |
| Product | `ui` | brief-product-ui |
| Product | `architect` | architect-software-system |
| Product | `build` | build-web-app + build-ios-app (modes: `web`, `ios`) |
| Product | `docs` | write-technical-docs |
| Meta | `feedback` | submit-feedback |

Play commands (old workflow → new command):

| Command | Old workflow |
|---|---|
| `launch` | launch-product |
| `gtm` | position-to-campaign |
| `plan` | target-to-growth-plan |
| `landing` | create-landing-page |
| `lifecycle` | lifecycle-campaign |
| `referral` | referral-loop |
| `outbound` | outreach-sequence |
| `press` | earned-media-outreach |
| `content` | content-intelligence-loop |
| `series` | shortform-campaign |
| `paid` | paid-campaign-loop |
| `expand` | channel-to-campaign |
| `answers` | answer-visibility-monitor |
| `pseo` | build-programmatic-search |
| `report` | content-performance-review |
| `trailer` | create-app-preview |
| `appstore` | optimize-app-store-listing |
| `qa` | creative-asset-review |
| `interactive` | interactive-campaign |
| `experiment` | measured-initiative-loop |
| `spec` | specify-product-experience |

New meta commands (each slice below owns its own directory):

| Command | Does | Owner |
|---|---|---|
| `init` | Records product and growth truth in `PRODUCT.md` and `GROWTH.md` | W6 |
| `pin`, `unpin` | Standalone shortcut for one command | W6 |
| `check` | Runs the rule-based marketing checker on a file, folder, or URL | W3 |
| `connect` | Shows which capabilities are connected through Executor and adds what a task needs | W4 |
| `review` | Opens a deliverable for human review: Proof for Markdown, Lavish for HTML | W5 |
| `doctor` | Reports and repairs drift in install and project context | W2 |

### D3. Plays are declared chains, and the router selects them

Each play has front matter like this:

```yaml
---
command: launch
label: Launch a product or feature
intents: ["launch", "product hunt launch", "go to market for a release"]
chain:
  - { command: position, when: "no accepted positioning in PRODUCT.md or GROWTH.md" }
  - { command: campaign }
  - { command: social, for: "channel-native launch posts" }
  - { command: copy, for: "launch page and email" }
  - { command: audit }
  - { command: measure }
---
```

The briefing engine (`tools/brief.mjs`, the MCP tool, and the prompt hook) scores plays and skills
together. When a request matches a play, or matches two or more commands that a play chains, the
brief returns the play: its steps in order, the playbooks to read for step 1 now, and the
playbooks for later steps marked "read at that step". A narrow request still returns one skill.

### D4. Durable context: `PRODUCT.md` and `GROWTH.md`

- `PRODUCT.md` holds product truth (users, purpose, positioning, constraints, evidence on hand).
  Use headings compatible with Impeccable's `PRODUCT.md` so both tools share one file. Never
  overwrite a file that another tool wrote; add only missing facts.
- `GROWTH.md` holds growth truth: goals and metrics, channels and what has worked, proof and
  assets, voice samples, budget and compliance limits, and the connected stack.
- Every command reads both files through the brief. `init` writes them after one interview round.
- Per-project state lives in `.conquistador/`. `init` adds a marked `.gitignore` block for its
  ephemeral files.

### D5. Rule-based checker: `conquistador check`

A deterministic checker for marketing text, like Impeccable's detector. No model, no key.
Families: unsupported claims, AI-writing tells, vague CTAs, channel limits, email compliance,
link hygiene. JSON output and exit codes match Impeccable: 0 clean, 2 findings, 1 scan failure.
A plugin hook runs it after the agent edits a marketing file and returns findings to the agent.

### D6. Integrations: capabilities through Executor

- Conquistador names **capabilities**, not providers: `analytics.read`, `ads.read`, `crm.read`,
  `crm.write`, `email.send`, `social.publish`, `search.read`, `payments.read`, and so on.
- `capabilities.json` maps each command to the capabilities it can use, and each capability to
  Executor search phrases.
- `conquistador connect` (and `/conquistador connect`) shows a readiness table:
  missing, connected, verified. It installs Executor when it is absent, opens the Executor UI to
  add a source, and verifies one bounded read.
- At task time the agent finds the tool with `executor tools search`, reads its schema with
  `executor tools describe`, and calls it. Reads run freely within host policy. Sends, publishes,
  spend, and other writes need the user's explicit approval each time.
- Recipes in `integrations/<capability>.md` give search hints for common providers. Any provider
  that Executor can reach works. Adding a provider is a Markdown change, not code.
- The typed `catalog/` and the Eve runtime leave the default user path. They stay in the repository.

### D7. Review: Proof for prose, Lavish for visuals

- `conquistador review <file>` and `/conquistador review` open the current deliverable.
  Markdown goes to the FORSVN Proof fork (comments, suggestions, provenance). HTML goes to Lavish.
- Fork Proof SDK as `forsvn-labs/proof`. Add channel preview panes, `check` findings as comments,
  a "Playbooks applied" panel, and an approval stamp bound to the document hash.
- Do not fork Lavish; upstream ships often. Pin one current version in one constant, and ship a
  Conquistador artifact kit (HTML templates for ad sets, social posts, email, landing sections,
  funnels, and calendars) that Lavish renders.
- Annotations are revision requests. An approval stamp records the human decision for one exact
  document hash; the agent still asks before each send, publish, or spend.

### D8. Install and CLI

- `npx @forsvn/conquistador` (or global install) detects agents, shows the detected set with
  "keep or customize", asks project or global scope, installs, then opens the agent with
  `/conquistador init` on a project without `GROWTH.md`, or with the task picker otherwise.
- Flags: `--providers=claude,codex,...`, `--scope=project|global`, `-y`, `--no-hooks`, `--dry-run`.
- Add agents that support the Agent Skills format: Gemini CLI, OpenCode, Pi, Hermes, and others
  whose skill paths can be verified from primary documentation.
- Lower the Node floor to 22.18 unless a verified Node 24-only API blocks it.
- Slim the npm package to what users run: CLI, the one skill, hooks, MCP server, and the checker.

## Slices

Each worker runs `rift create` in `forsvn/conquistador`, checks out a new branch from
`origin/overhaul/2026-10`, works only inside the rift, commits as it goes, pushes, and opens a PR
into `overhaul/2026-10`. Do not edit `VISION.md`, `ROADMAP.md`, `PROGRESS.md`, or `CHANGELOG.md`;
put the entries in the PR body. The captain writes the horsemen at integration.

| ID | Slice | Owns | Must not touch |
|---|---|---|---|
| W1 | Commands and plays | `skills/**` moves and renames, `skills/conquistador/SKILL.md`, plays, `tools/brief.mjs`, routing contract and overlay, `tools/tour.mjs`, knowledge map, `mcp/`, `hooks/conquistador-hook.mjs`, `MIGRATION.md`, plugin manifests' skill counts | `commands/{init,pin,check,connect,review,doctor}/`, installer files |
| W2 | Install and CLI | `tools/front-door.mjs`, `tools/agents.mjs`, `tools/launch.mjs`, install, setup, onboarding, self-update, doctor files, `package.json`, `README.md`, `INSTALL.md`, `commands/doctor/` | `skills/**` except `commands/doctor/`, `tools/brief.mjs`, `tools/tour.mjs` |
| W3 | Checker | `tools/check/**`, new `hooks/check-hook.mjs` and its hook manifest entries, `commands/check/`, `docs/CHECK.md` | Other `skills/**` files |
| W4 | Connect | `capabilities.json`, `integrations/**`, `tools/connect.mjs`, `commands/connect/`, `docs/INTEGRATIONS.md`, `skills/conquistador/methods/connect-accounts.md`, `skills/conquistador/methods/stack-setup.md`, `skills/conquistador/standards/setup.md` | Other `skills/**` files |
| W5 | Review | `forsvn-labs/proof` fork, `kit/**` (artifact kit), `tools/review.mjs`, `commands/review/`, `docs/PREVIEW.md`, `skills/conquistador/standards/preview.md` | Other `skills/**` files |
| W6 | First run | `commands/init/`, `commands/pin/`, `tools/signals.mjs`, `tools/pin.mjs`, `skills/conquistador/references/menu.md`, `skills/conquistador/standards/context.md`, `docs/CONTEXT.md` | Other `skills/**` files |

Shared seams (keep each change small; the captain resolves conflicts):

- `runtime/bin/conquistador.js`: add one dispatch entry per new CLI command.
- `release/completeness.json` and `release/plugin-completeness.json`: regenerate at integration.
- Hook manifests (`hooks/claude.json` and others): W3 adds its entry; W1 keeps the prompt hook.

## Acceptance

- `npm run build` and `npm test` pass. Update or remove tests that encode old names; do not delete
  coverage for behavior that still exists.
- Each slice adds or updates one E2E check under `tools/e2e/` and ends with a repeatable report in
  `dist/e2e/`.
- No new unit tests written after the code. If a slice needs isolated tests, list the failure modes
  first in the PR body, then write the code.
