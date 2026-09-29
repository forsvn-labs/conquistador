# Review: surfaces, knowledge use, and installation (2026-09)

This is the single working document for the September 2026 overhaul. It records the review
findings, the decisions, and the verification results.

## Findings

### 1. Surfaces

- Every agent CLI on the review machine has a plugin manager: Claude Code 2.1, Codex 0.157,
  Cursor Agent, Copilot CLI 1.0, Grok 1.0, OpenCode 2.0, Goose 1.45, and Hermes 0.21.
  The repository already has plugin manifests, but they declare skills only. They ship no MCP
  server and no hooks, and the documentation steers users away from them.
- The installer has seven payload families (operator, native plugin source, compact skill,
  squad, local MCP, runtime MCP, experimental imports). Each has its own ownership receipt,
  doctor, and recovery rules. Users must choose between them before they get any value.
- The local MCP server exposes three file-reading tools. The agent must already know which
  file to read, so the server does not help the agent find the right playbook.
- Bot-type apps (Grok bot, Muse, ChatGPT, Claude Projects) have no working path. The Grok and
  Hermes routes print guidance only.

### 2. Knowledge use

The product has 1,040 knowledge files (5.8 MB) behind 39 skills. The agent skips most of them.
Root causes, in order of impact:

1. **The router marks the valuable files as optional.** For "Plan a Product Hunt launch", the
   request context requires `anti-patterns.md` and `fallbacks/sequential.md`. It marks the
   Product Hunt platform pack, the Product Hunt channel guide, the growth-play patterns, and the
   channel strategy as "deferred", with the same generic condition on every file.
2. **Too many hops.** The agent must read the parent, then the method, then find a link list at
   the bottom of the method, then open each file. Every hop is a chance to stop.
3. **Hedging drowns the instructions.** The parent contract spends most of its words on what is
   unverified or not authorized. The instruction to read the playbooks is one clause in step 4.
4. **Nothing checks.** No hook confirms that the agent read anything before it answers.
5. **Hooks are hard to turn on.** Proactive routing needs a hand-written JSON file, a per-project
   `hooks enable` command, and host trust. In practice nobody enables it.

### 3. Installation UX

- The first screen under the current Node (26) says "Conquistador requires Node 24". The code
  uses only core Node modules; the upper bound `<25` has no technical reason. Under Node 26,
  92 of 240 tool tests fail only because of that gate.
- The README is 150 lines of evidence caveats before the first useful command.
- The recommended path installs a per-project copy. Users must repeat it in every project.

## Decisions

1. **The plugin is the primary surface.** One repository is a valid plugin for Claude Code,
   Codex, Cursor, Copilot, and any Agent Plugins host. Each plugin ships the 39 skills, a local
   MCP server, and hooks. It is installed once per user, not once per project.
2. **Other surfaces use the same engine.**
   - Skills only: `npx skills add forsvn-labs/conquistador` (any SKILL.md host).
   - MCP only: `conquistador mcp` (stdio) or `conquistador mcp --http` (bots and remote apps).
   - Bot pack: `conquistador bot` writes a system prompt and upload-ready knowledge files for
     apps that take instructions and files but not MCP.
   - Terminal: `conquistador brief "TASK"` prints the same briefing.
   - The per-project operator stays available as `conquistador project`.
3. **One briefing engine decides what to read.** `tools/brief.mjs` selects methods with the
   existing router, then ranks every knowledge file for the task. It returns a short "must read"
   list with a reason for each file. The MCP tool returns the file text inline, so the agent
   gets the playbooks in one call.
4. **Hooks enforce reading.** The plugin prompt hook injects the must-read list for relevant
   prompts only. The stop hook checks the transcript. If a must-read file was not read, it
   blocks the answer once and names the files. Users can turn hooks off with
   `CONQUISTADOR_HOOKS=off`.
5. **User playbooks rank first.** Set `CONQUISTADOR_PLAYBOOKS` to a folder of Markdown files
   (for example, a private vault). The engine indexes it with the product knowledge and labels
   those results "your playbook". Nothing is copied into the product.
6. **Answers cite the playbooks.** The default deliverable ends with "Playbooks applied": each
   file and the rule taken from it.
7. **The installer detects agents and uses their own plugin managers.** Bare `conquistador`
   lists detected agents, preselects them, and installs with one confirmation.
8. **Node 24 or later.** The upper bound is removed.


## Failure modes (written before the code)

### Briefing engine

1. A marketing prompt returns no method, so the agent gets no playbooks.
2. A named platform ("Product Hunt", "TikTok") does not pull its platform pack or channel guide.
3. The must-read list contains process scaffolding (fallbacks, format rules) instead of playbooks.
4. The must-read list is so long that the agent reads none of it.
5. The inline pack exceeds the MCP response limit or the host context budget.
6. A coding prompt ("fix the flaky test") triggers a marketing brief.
7. The user playbook folder is missing, huge, contains symlinks or binary files, or sits
   inside the product folder; the engine crashes, leaks, or reads outside it.
8. A path in the brief does not exist on disk in the installed layout (plugin cache, skills copy,
   staged operator with METHOD.md names).
9. The same prompt gives a different list on each run (non-deterministic ranking).

### Hooks

1. The prompt hook blocks or slows every prompt (it must finish well under the host timeout).
2. The prompt hook injects context into unrelated coding prompts.
3. The stop hook blocks forever (loop) or blocks when no brief was issued.
4. The stop hook misses reads done through Bash (`cat`, `sed`), MCP tools, or Codex exec calls.
5. The stop hook counts the injected hook text itself as a read.
6. Malformed or empty hook input crashes the hook and shows an error to the user.
7. Hooks cannot be turned off.
8. State files from one session leak into another session.

### Installer

1. A detected agent CLI exists but its plugin command fails; the installer reports success.
2. The installer changes a host's configuration without confirmation.
3. Reinstall or update duplicates the marketplace or plugin.
4. No terminal (CI, piped): the installer waits for input forever.
5. Node older than 24 gives a stack trace instead of a clear message.

## Results

### What changed

| Area | Before | After |
| --- | --- | --- |
| First command | Node 24 gate, then a per-project guide with seven families | Finds your agents and installs the plugin with one confirmation |
| Install scope | Once per project | Once per user; every project |
| Plugin contents | Skills only | Skills, playbook MCP server, and hooks |
| MCP tools | List and read files | `conquistador_brief` returns the playbooks for the task inline |
| Bots | Guidance only | HTTP MCP server, Dockerfile, and a bot pack |
| Knowledge selection | Anti-patterns and a fallback file; the rest "deferred" | Ranked must-read list with reasons; named platforms always included |
| Enforcement | None | Prompt hook, stop hook, playbook map, and required citations |
| User playbooks | A 20-handle JSON index | Any Markdown folder, ranked first |
| Node | 24 only | 24 or later |

### Failure modes: how each is handled

| Failure mode | Handling | Checked by |
| --- | --- | --- |
| Brief 1, 2: no method, or platform pack missed | Lexical and platform fallbacks; named platform always brings pack and channel guide | Sample prompts; E2E |
| Brief 3, 4: scaffolding or too many files | Process files excluded; at most 8 must-read files and 90 KB | Sample prompts |
| Brief 5: response too large | Inline pack limited to 160 KB (about 40,000 tokens), well below the 512 KB MCP frame limit | MCP tests |
| Brief 6: coding prompt briefed | Router abstains, business-vocabulary gate, coding-vocabulary veto | Sample prompts; hook test |
| Brief 7: bad user folder | Symlinks skipped, size and count limits, folder inside the product refused | Code review only |
| Brief 8: path missing in an installed layout | Paths come from the routing contract, which rebases per layout | Installed plugin copy |
| Brief 9: non-deterministic | Rounded scores, path tie-break | Map check on Node 24 and 26 |
| Hooks 1: slow | Early exit before indexing; disk cache | Timing |
| Hooks 2: unrelated prompts | Same gate as brief 6 | Hook test |
| Hooks 3: loop | `stop_hook_active`, Cursor `loop_count`, one enforcement per brief | Synthetic transcripts |
| Hooks 4, 5: missed or false reads | Tool calls only; absolute paths, stable tails, brief tool calls | Synthetic Claude and Codex transcripts |
| Hooks 6: bad input | Every error exits 0 with no output | Garbage input |
| Hooks 7: cannot disable | `CONQUISTADOR_HOOKS=off` or config | Synthetic run |
| Hooks 8: state leak | Per-session files, 12-hour TTL | Code review only |
| Installer 1: false success | Exit status and stderr checked; failures listed with the next command | Real Codex failure during E2E |
| Installer 2: silent changes | Plan shown and confirmed; `--yes` required without a terminal | PTY run |
| Installer 3: duplicates | Idempotent steps with "already" handling | Lifecycle E2E |
| Installer 4: hangs without a terminal | Help or an explicit `--yes` error | CLI run |
| Installer 5: old Node | Preflight message for Node below 24 | Unchanged preflight path |

### Evidence

See PROGRESS.md for the exact commands and numbers. Summary: 764 of 764 checks pass on Node 24
and 26; the install lifecycle passes for five agents in an isolated home; in nine valid headless
Claude Code runs, must-read coverage rose from 17% to 100% and citations from 0% to 100%.

### Open decisions for Hung

1. Merge and tag v0.0.15, and push the branch. Nothing has been pushed.
2. Where to host the HTTP playbook server for Muse and other connector apps.
3. Whether the stop hook should stay on by default. It sends the agent back once per task when it
   skips the must-read files, which costs one extra turn.

## Part 2: general-purpose scope (2026-09-28)

Hung's question: did the hardening pass tie Conquistador to Product Hunt? The product must be a
general marketing and growth operator: any platform, any service, and growth inside the product.

### Findings

1. **The engine is general. The first touch is not.** Every example a new user sees names a
   launch: the README sample prompt, the installer "Next" box, the `tryIt` line for all five
   agents, the bot-pack test prompt, the `brief` fallback message, `FIRST_PROMPT`, and the
   knowledge-use E2E task. A user learns "this is a launch tool" in the first minute.
2. **Routing fails outside launches.** A probe of 24 non-launch tasks found 10 misroutes or
   empty briefs, although the library has content for every one of them:

   | Task | Got | Should get |
   | --- | --- | --- |
   | Win-back email flow for churned subscribers | map-user-flow, brief-product-ui | lifecycle-campaign |
   | Grow a Discord community | create-run-of-show | research-channel / write-social |
   | Paywall and trial experiment | allocate-marketing-budget | design-pricing-and-packaging / improve-conversion |
   | Press coverage in TechCrunch | nothing | earned-media-outreach |
   | Get recommended by ChatGPT and Perplexity | nothing | answer-visibility-monitor / optimize-search |
   | Threads and Bluesky content plan | content-performance-review | research-content-ideas / write-social |
   | Pinterest strategy | create-brand | research-channel |
   | Listed and reviewed on G2 and Capterra | fresh-eyes-review | research-channel |
   | Substack newsletter | create-shortform | write-longform / plan-campaign |
   | Google Ads search campaign | right method, but LinkedIn and TikTok ad guides as must-read | Google Ads guide only |

3. **The before/after test measured only two tasks** (a Product Hunt launch and pricing). It could
   not see breadth failures.
4. **The platform list has 17 entries, all launch or social.** No entry for Google Ads, Meta ads,
   Discord, Slack, G2, Substack, Pinterest, Threads, Bluesky, Google Play, Shopify, or
   ChatGPT-style answer engines.

### Failure modes (written before the code)

Routing breadth:

- R1. A clear marketing task gets no method (empty brief).
- R2. A task gets a method from the wrong domain (product UI for an email flow).
- R3. A shared word pulls a wrong method ("reviewed" → fresh-eyes-review, "flow" →
  map-user-flow, "event" → run-of-show, "newsletter" → short-form).
- R4. A named platform brings sibling platforms' guides as must-read (Google Ads → TikTok ads).
- R5. A fix for one domain breaks another (new intent steals prompts from an older, correct route).
- R6. A coding prompt starts to match after new vocabulary is added.
- R7. The eval passes because expectations are loose (any method counts as right).

Onboarding:

- O1. A first-time user sees only launch examples and does not learn the breadth.
- O2. The user does not know what to type first in their agent.
- O3. The capability map is too long to read in a terminal (38 methods at once).
- O4. The guided start needs an agent session or network to work.
- O5. The guided start blocks scripts or CI (waits for input without a TTY).
- O6. Examples drift from the router: an advertised example routes to the wrong method.
- O7. Launch examples disappear completely; launches are still a core job.

Eval design against R7: each case lists acceptable methods (any one must be selected) and
forbidden methods (none may be selected). The onboarding examples are cases in the same eval, so
O6 fails the eval.

### Results (part 2)

What changed:

- **Router aliases** (`skills/conquistador/routing-overlay.json`): 236 practitioner phrases in a new
  `aliases` field. Curated `intents` still describe each method, so the playbook maps did not move.
- **Brief engine** (`tools/brief.mjs`): ad-platform names, longest-phrase platform matching, the
  sibling-platform rule, the routed workflow's composition file, a coding guard for bare platform
  names, and an honest "no match".
- **Tour** (`tools/tour.mjs`): nine areas, short specialist names, tested examples. Feeds
  `conquistador tour`, the installer's closing screen, `welcome.md`, and the bot-pack prompt.
- **First contact** in the parent skill: `/conquistador` with no task shows the areas and asks
  one question.

How each failure mode is handled:

| Mode | Handling | Evidence |
| --- | --- | --- |
| R1 empty brief | Aliases for press, AI answers, channels | Breadth cases pass |
| R2 wrong domain | Aliases route before the lexical fallback | Win-back, paywall, Substack pass |
| R3 shared word | Exclusions (`map-user-flow` × email flow) and job phrases instead of metric names | `none` lists pass; diagnosis prompts keep only `diagnose-growth` |
| R4 sibling guides | Named platform keeps siblings out of must-read | Google Ads and Meta cases pass |
| R5 old routes break | Full suite | 764 of 764; one regression ("Research the Vietnamese market") found and fixed |
| R6 coding prompts | 20 coding guards; ambiguous words became phrases; bare platform names need non-coding text | 20 of 20 silent (11 regressions found and fixed, 2 older leaks fixed) |
| R7 loose eval | `any` plus `none` plus `platforms` plus `mustNot` per case | Baseline failed 17 of 66 |
| O1 launch-only first touch | Tour, installer screen, README table, try-it lines | Installer E2E output shows nine areas |
| O2 what to type | Four starter prompts; tour gives a paste-ready prompt | `tour.exp` transcript |
| O3 map too long | Nine one-line areas; detail per area on demand | `conquistador tour AREA` |
| O4 needs agent or network | Tour is local and deterministic (0.9 s end to end) | `tour.exp` |
| O5 blocks scripts | No TTY prints the map | `conquistador tour` piped |
| O6 examples drift | Tour examples are eval cases; welcome.md and README table are checked | 3 drift checks pass |
| O7 launches vanish | Launch is one of nine areas, with a Product Hunt example | Tour case passes |

Evidence (reports in `dist/e2e/`, not committed):

- `routing-breadth/report.md`: 107 of 107.
- `tour/transcript.txt`: the interactive tour, "Growth inside the product", first example.
- `install-lifecycle/report.json`: pass for five agents, with the new closing screen in the output.
- `knowledge-use-breadth/report.md`: live headless Claude Code 2.1.283, hooks on, one run per task,
  three non-launch tasks (win-back email, ChatGPT and Perplexity visibility, iOS paywall). Must-read
  coverage 100% (6/6, 6/6, 5/5), citations 100%, mean cost $0.59 per run. Three runs is a small
  sample.

Not verified: answer quality on the new areas; the tour on Windows and Linux terminals; hook
delivery outside Claude Code.

## Part 3: agent-first start (proposal, 2026-09-28)

Status: built as the 0.0.16 candidate (local, unshipped). Hung accepted the three recommendations; see
the results below for the one change to decision 3.

### Problem

Version 0.0.15 still ends in instructions. After install, the user reads "Next", leaves the
terminal, opens an agent, and types a prompt. The tour ends the same way: "Paste this into your
agent", with a `<what it is, who it is for>` placeholder the user must fill in. Every one of those
steps is a place to drop off. The agent can read the repository, so the user should not have to
describe the product.

### Target experience

The user runs one command. It ends inside their agent, with the task already typed.

```text
$ npx conquistador
┌  Conquistador
◇  Installed into Claude Code and Codex          first run only
◆  What should we work on?
│  ● Plan marketing and growth for this project
│  ○ Get more signups from our landing page
│  ○ Write a cold email sequence
│  ○ Something else…
└  Opening Claude Code. Press Enter to start.

❯ /conquistador Plan marketing and growth for this project. Learn the product from
  this repository first. Ask me only for what you cannot find.
  ⚠ Pre-filled prompt · review before pressing Enter
```

The user presses Enter, and Conquistador does the work.

### Commands

| Where | Command | What it does |
| --- | --- | --- |
| Terminal | `conquistador` | First run: install, then pick a task and open the agent. Later runs: pick a task and open the agent. |
| Terminal | `conquistador "TASK"` | Open the agent with this task. No questions. |
| Terminal | `conquistador update` | Update. |
| Terminal | `conquistador remove` | Uninstall. |
| Agent | `/conquistador [TASK]` | The same thing, from inside a session. |

`tour` goes away as a separate command. The task picker is the tour. `add`, `agents`, `brief`,
`playbooks`, `mcp`, and `bot` stay under `help --all`.

### Patterns taken from the best CLI setups

1. **Run without an install step.** `npx create-next-app` and `uvx` run with no global install.
   Conquistador: `npx conquistador` (private alpha: `npx github:forsvn-labs/conquistador#TAG`).
   This removes the `npm install -g --ignore-scripts --install-links` line.
2. **Detect, do not ask.** `vercel` detects the framework; `shadcn init` detects the project.
   Conquistador installs into every agent it finds and lists them in one line. `remove` undoes it.
3. **The same bare command always does the next right thing.** `vercel` and `railway up` are
   safe to run again. `conquistador` skips install when it is current and goes to the task.
4. **End in the product, not in a "Next steps" list.** Conquistador replaces its terminal
   process with the agent session (`exec`), so the user never switches windows.
5. **Offer an agent-first path.** Some users live in an IDE. The landing page gets "Open in
   Claude Code" and "Open in Cursor" buttons (deep links) and a "Copy prompt" button. The copied
   prompt tells the agent to install Conquistador and start the task.

Account sign-in (the `gh` and Stripe browser-code pattern) does not apply. Conquistador has no
account.

### How each agent opens

Verified on this machine on 2026-09-28:

| Agent | Launch | Behavior |
| --- | --- | --- |
| Claude Code 2.1.283 | `claude --prefill "PROMPT"` | Prompt is in the input box and not sent. Screen shows "Pre-filled prompt · review before pressing Enter". Tested in a pseudo-terminal. |
| Claude Code (web page) | `claude-cli://open?q=…&cwd=…` | The binary registers this handler and decodes `q` into the pre-filled prompt. Not tested from a browser. |
| Codex | `codex "PROMPT"` | Starts a session with the prompt. It runs at once. |
| Cursor Agent | `cursor-agent "PROMPT"` | Same: runs at once. |
| Copilot CLI | `copilot -i "PROMPT"` | Same: runs at once. |
| Grok CLI | `grok "PROMPT"` | Same: runs at once. |

Only Claude Code pre-fills without sending. For the others, the user already chose the task in
the picker, so the task runs at once. `--prefill` is not in `claude --help`. If a later Claude Code
version removes it, Conquistador falls back to `claude "PROMPT"`.

### Which agent opens

- One agent installed: open it.
- Several: open the one used last. On the first run, ask once ("Open in") with Claude Code first.
- `conquistador "TASK" --in codex` chooses one agent for one run.

### The prompt

The prompt names the task and tells the agent to learn the product from the working folder.
It has no placeholders. Outside a project folder (for example, the home folder), the prompt tells
the agent to ask for the product, audience, and goal first.

### Failure modes (written before the code)

| ID | Failure | Planned handling |
| --- | --- | --- |
| A1 | No agent installed | Say which agents work and how to install one. Exit 1. Do not open anything. |
| A2 | Agent not signed in | The agent handles its own sign-in. Conquistador only opens it. |
| A3 | Agent asks to trust the folder first | The pre-filled prompt must still be there after the trust screen. Verified for Claude Code. |
| A4 | `--prefill` removed in a later Claude Code | Check `claude --help` and the version; fall back to `claude "PROMPT"`. |
| A5 | Not a TTY (CI, pipe) | Print the command to run and the prompt. Never open an agent. |
| A6 | Task text breaks the shell | Pass the prompt as one argument with `spawn` and no shell. |
| A7 | Run in the home folder or an empty folder | Use the ask-first prompt. |
| A8 | Hooks not trusted yet (Codex `/hooks`) | Say so in one line before opening Codex. |
| A9 | User wanted install only | `conquistador --no-open` stops after install. Esc at the picker also stops. |
| A10 | Update pending while the agent is open | Update does not open the agent. Say to start a new session. |
| A11 | Windows | `exec` does not exist. Use `spawn` with `stdio: inherit` and exit with the child's code. |
| A12 | Deep link on a machine without Claude Code | The page shows "Copy prompt" as the fallback next to each button. |

### Verification plan

One E2E test in a pseudo-terminal, with a separate test home folder: bare `conquistador` → install
→ pick the first task → Claude Code opens with the prompt pre-filled. The test captures the screen
to `dist/e2e/agent-first/transcript.txt`, checks for the task text and the pre-fill notice, then
runs `conquistador remove`. The same test runs `conquistador "TASK" --in codex` and checks the
argument list without calling a model.

### Open decisions for Hung

1. Install into every detected agent without asking? Recommended: yes, and list them.
2. Remove `tour` as a command? Recommended: yes; the picker replaces it.
3. Move the README to `npx`? Recommended: yes. Keep the global install in INSTALL.md.

### Results (part 3)

What changed:

- `tools/launch.mjs` owns the start flow. Bare `conquistador` installs into every found agent, asks
  "What should we work on?" (four tasks, **Browse all areas**, **Something else**), asks "Open in"
  once, and spawns the agent with the prompt. The parent ignores Ctrl+C and Ctrl+\ while the agent
  runs and exits with the agent's code.
- Each agent in `tools/agents.mjs` has an `open` launch. Claude Code uses `--prefill` from 2.1.283.
- `createBrief` strips the start flow's context sentences before routing (new finding below).
- The interactive tour is gone; `conquistador tour [AREA]` prints the areas.

Decision 3 changed. The README keeps the global install for the private alpha. The private Git
`npx` line works, but it took 24 seconds cold and about 5 seconds warm, and it leaves no
`conquistador` command, so every later run needs the long line again. INSTALL.md documents it as
"Run once without a global install". The README moves to `npx conquistador` after an npm publish.

New finding: the router reacts to filler words. With "Get more signups to become active users",
adding "Ask me only for what you cannot find." selected the video method, and "Learn the product"
selected the budget method. The routing-breadth E2E caught it with the new start cases. The fix
for the start flow is in `createBrief`; the general fix is on the roadmap.

| Mode | Handling | Evidence |
| --- | --- | --- |
| A1 no agent | Note with the supported agents, exit 1 | Code path; not run (every agent is on the test machine) |
| A2 not signed in | The agent handles sign-in | Isolated Claude Code showed "Not logged in" with the prompt still pre-filled |
| A3 trust screen | Pre-fill survives it | agent-first run 1 |
| A4 `--prefill` removed | Version floor 2.1.283 and `CONQUISTADOR_PREFILL=off` | Code path |
| A5 no terminal | Prints the command, opens nothing | agent-first run 4 |
| A6 shell breakage | `spawn` without a shell on macOS and Linux | Codex process shows the prompt as one argument (run 3) |
| A7 home or empty folder | Ask-first prompt | agent-first run 5 |
| A8 Codex hooks | One warning line before Codex opens | agent-first run 3 |
| A9 install only | `--no-open`; Esc at the picker | Code path; Esc used in run 5b |
| A10 update | Unchanged: says to start a new session | install-lifecycle |
| A11 Windows | `spawn` with a shell | Not run |
| A12 deep link without Claude Code | Landing-page work, not built | Roadmap |

Evidence (in `dist/e2e/`, not committed):

- `agent-first/transcript.txt` and `report.json`: 14 of 14 checks, real Claude Code 2.1.283 and
  Codex 0.157.1, isolated home, no model call.
- `routing-breadth/report.md`: 119 of 119, including 10 start-prompt cases.
- `install-lifecycle/report.json`: pass for five agents.
- `npm test`: 764 of 764.

## Part 4: public-beta install review (2026-09-29)

### Report

A user ran the documented install on macOS with Node 24.20 and nvm:

```sh
npm install -g --ignore-scripts --install-links git+https://github.com/forsvn-labs/conquistador.git#v0.0.16
conquistador
```

The command stopped with a raw Node stack trace:
`ENOENT ... ~/.cursor/plugins/local/conquistador.tmp-94069/.conquistador-owned.json`.

### Findings

1. **P0: every npm install ships an empty plugin.** `copyPayload` skips paths that match
   `/node_modules/`. It tests the absolute path, and a global npm package lives under
   `…/lib/node_modules/@forsvn/conquistador`. So it skips every file. `~/.conquistador/plugin`
   gets only the ownership marker and three empty folders. Each agent then registers an empty
   plugin. Cursor fails first because its copy reads from that empty folder, never creates the
   staging folder, and cannot write the marker. Reproduced in an isolated home and npm prefix.
   The global npm route and the `npx` route are both broken in 0.0.16.
2. **P0: one agent can stop the whole run.** `copyPayload` throws, and nothing catches the
   error. The user sees a Node stack trace, the other agents do not install, and nothing says
   what to do next.
3. **P1: nothing checks the copy.** The installer registers the plugin copy with each agent
   without a check that the copy is complete. The state file records "installed" by version
   only, so a broken copy is never repaired while the version stays the same.
4. **P1: the release tests never ran the shipped package.** `tools/e2e/install-lifecycle.mjs`
   and `agent-first.exp` run `runtime/bin/conquistador.js` from the source checkout, which is not
   under `node_modules`. `tools/verify-private-git-install.mjs` installs from Git, but tests only
   the old per-project route. No test ran bare `conquistador` or `add` from an npm install.
5. **P1: the install line is long and private.** It needs Git access to a private repository and
   two npm flags that users do not understand. A public beta needs one short command, such as
   `npx @forsvn/conquistador`. This needs a public npm package and a decision on repository
   visibility.
6. **P1: `conquistador update` does not update.** Help says "Update to the latest version". The
   command only registers the version that is already installed again. It never gets a newer
   release.
7. **P2: a crash leaves folders behind.** A failed run leaves `conquistador.tmp-PID` next to the
   agent's plugin folder. The next run uses a new PID and does not remove it.
8. **P2: errors show internals.** Any error that escapes prints a Node stack trace, with no
   cause in plain words, no log file, and no place to report it.

### Failure modes (written before the code)

The installer must handle each case. The E2E must cover each case marked E2E.

| # | Case | Required behavior | Covered by |
| --- | --- | --- | --- |
| I1 | The package lives under `node_modules` (npm global, `npx` cache) | The plugin copy is complete | E2E |
| I2 | The plugin copy is incomplete (a required manifest is missing) | Stop before any agent registers it. Keep the last good copy. Say which file is missing | E2E |
| I3 | One agent fails or throws | Report that agent with a retry command. Install the other agents. Open a working agent | E2E |
| I4 | A crashed run left `.tmp-PID` or `.old-PID` folders | The next run removes them | E2E |
| I5 | The target folder exists and Conquistador did not create it | Leave it in place, say how to fix it, and continue with the other agents | E2E |
| I6 | The state says "installed", but the plugin copy is missing or broken | The next bare `conquistador` repairs it | E2E |
| I7 | An agent's plugin command fails (not signed in, old version) | Show the last lines of its output and the retry command | Existing |
| I8 | No supported agent is found | Say so, list the agents, and exit 1 | Existing |
| I9 | The user switches Node versions | Agents keep working from `~/.conquistador/plugin` | E2E |
| I10 | No terminal (script or pipe) | Print the command only. Install nothing | Existing |
| I11 | An unexpected error | One line with the cause, a log file path, and where to report it. No stack trace unless `CONQUISTADOR_DEBUG=1` | E2E |
| I12 | The npm cache that ran `npx` is deleted | Agents keep working from the stable copy | E2E |

### Decisions

- Test the payload filter against the path inside each payload item, not the absolute path.
- Check the staged copy for ten required files before it replaces the old copy. A bad package
  never reaches an agent, and the last good copy stays.
- `applyAgent` returns errors and never throws. One agent cannot stop the others.
- A bare `conquistador` repairs a missing or damaged `~/.conquistador/plugin` and Cursor copy,
  even when the version did not change.
- Hints name the command that runs this copy again. After `npx`, the next step is
  `/conquistador` in the agent, because `npx` leaves no `conquistador` command.
- Retire `tools/e2e/install-lifecycle.mjs`. `tools/e2e/package-install.mjs` installs the package
  as users do and covers the same lifecycle.
- Bump to 0.0.17 so that every 0.0.16 user gets a full reinstall on the next run.

### Results

Verified on macOS, 2026-09-29, with real Claude Code 2.1.284, Codex 0.158.0, Cursor Agent
2026.09.15, Copilot CLI 1.0.87, and Grok CLI 1.0.44 in isolated homes. No model was called.

- `node tools/e2e/package-install.mjs`: 28 of 28 at `20157b3`. Route A installs from the Git commit
  with the documented npm command. Route B installs through `npx` from a tarball packed from a
  clean clone (1,689 files, 4.4 MB packed, 12.8 MB unpacked, no nested `node_modules`), then
  deletes the `npx` cache. The run includes `agent-first.exp` against the installed binary, 14 of
  14. Artifacts: `dist/e2e/package-install/report.json` and `commands.log`.
- Negative control: `CONQUISTADOR_E2E_REF=v0.0.16 node tools/e2e/package-install.mjs` fails I1
  for all five agents, with all ten required files missing. This is the reported bug.
- `npm test`: 764 of 764. Routing breadth: 119 of 119.
- Without `--install-links`, a global Git install links to a temporary clone and the command does
  not exist. The Git route needs both flags. A registry package needs none.

Not verified: Windows and Linux, the Cursor editor (the E2E uses Cursor Agent and the plugin
folder), and a user's machine that already has a 0.0.16 crash. On such a machine, the leftover
`conquistador.tmp-PID` folder is removed only when no running process has that PID.

### Public beta: open decisions

A short install line is the largest remaining improvement. It needs your authorization, because
this repository must stay private and npm publication stays disabled until you decide:

1. **Publish `@forsvn/conquistador` to npm as public.** The install becomes
   `npx @forsvn/conquistador` (one run) or `npm install -g @forsvn/conquistador`, with no Git
   access and no flags. Route B of the E2E already tests this package shape. It needs: remove
   `"private": true`, choose the version (VERSIONS.md plans `0.1.0` for the first public release),
   publish from CI from a clean clone, not from a working checkout.
2. **Make the repository public, or keep it private.** A private repository blocks
   `/plugin marketplace add forsvn-labs/conquistador` in Claude Code, `npx skills add`, and the
   issue link in error messages. npm publication alone makes the CLI route work.
3. **Make `conquistador update` fetch a new version.** Today it registers the installed version
   again. After npm publication, it can run `npm install -g @forsvn/conquistador@latest` (or
   print the `npx` line) and then register the new copy.

## Part 5: `conquistador update` gets the latest version (2026-09-29)

Hung approved all three public-beta decisions. This part covers decision 3. Today
`conquistador update` registers the installed version again and never gets a newer release.

### Target behavior

`conquistador update` asks the npm registry for the `latest` version of `@forsvn/conquistador`.
When that version is newer, it installs it the same way the running copy was installed, and the
new version registers itself with every agent. When the registry has nothing newer, or cannot
answer, it registers the installed version again, as before.

| How the running copy was installed | What `update` runs |
| --- | --- |
| `npm install -g` (from the registry or from Git) | `npm install -g --prefix PREFIX @forsvn/conquistador@latest`, then the new `conquistador update` |
| `npx` | `npx --yes @forsvn/conquistador@latest update` |
| A source checkout or a project `node_modules` | Nothing. It prints the install command |

### Failure modes (written before the code)

The E2E must cover each case marked E2E.

| # | Case | Required behavior | Covered by |
| --- | --- | --- | --- |
| U1 | A newer version is on the registry (global install) | Install it into the same npm prefix. The new version registers with every agent and reports its version | E2E |
| U2 | The registry cannot be reached, or times out after 15 s | Say so in one line. Register the installed version again. Exit 0 | E2E |
| U3 | The registry does not have the package (404, before the first publication) | Same as U2 | E2E |
| U4 | The registry version is the same or older (a source checkout ahead of it) | Never downgrade. Say "already the latest". Register the installed version again | E2E |
| U5 | Versions compare as numbers: `0.0.9 < 0.0.17 < 0.1.0`. A prerelease is older than its release | Correct order | E2E (U1 uses 0.0.x to 0.0.x+1) |
| U6 | `npm install -g` fails (no write access to the prefix, network drop) | Keep the installed version and the agents unchanged. Show the npm error lines and the command to run. Exit 1 | E2E |
| U7 | The new version runs `update` again | It does not ask the registry again. No loop | E2E |
| U8 | The running copy came from `npx` | Do not create a global install the user did not choose. Run the new version through `npx` | E2E |
| U9 | The running copy is a source checkout or a project dependency | Do not change the installation. Print the command that installs the latest version. Register this copy again | E2E |
| U10 | `--dry-run` | Print the commands. Change nothing | E2E |
| U11 | The new package is incomplete | The new version's own check (I2) stops before any agent. The last good plugin copy stays | Existing (I2) |
| U12 | No agent is installed yet | Keep the current message. Do not ask the registry | Existing |
| U13 | The user set a custom registry (`npm_config_registry`, `.npmrc`) | Use it, for both the version check and the install | E2E (the E2E uses a local registry) |
