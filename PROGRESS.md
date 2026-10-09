# Product progress

## In review: installer reach (branch `cli/installer-reach`)

From the 2026-10-10 comparison with Impeccable 4.5.2 (`forsvn-brain/conquistador/_show-me/installer`).

- Hooks for GitHub Copilot CLI: `com.github.copilot/hooks/hooks.json` (our Agent Plugins manifest
  makes Copilot read hooks only there). Playbook list on prompts and at session start, copy check
  after edits. No read check: Copilot's transcript format is not verified.
- Hooks and MCP for Grok CLI: Grok reads only `hooks/hooks.json` and `.mcp.json` (checked with
  `grok plugin validate`), and Claude Code also loads `hooks/hooks.json`, so Grok gets its own copy
  in `~/.conquistador/grok-plugin`. The install removes the old registration first (a second source
  registers a second plugin). Copy check only: Grok drops prompt-hook output.
- `conquistador hooks on|off|status`, also `/conquistador hooks …` in the agent.
- Qoder, Rovo Dev (shares Pi's `~/.agents/skills` copy), Trae, and Trae CN as skill agents: 16 agents.
- The agents screen lists found agents, then one "Add an agent not found" row.
- Gemini CLI hooks are deferred: Gemini is not installed here to test, and Google replaced it with
  Antigravity CLI for unpaid and Google One users.
- Verified 2026-10-10 (macOS, Node 26.9.0): `node tools/dev.mjs test` 939 (415 tooling, 294
  runtime, 167 catalog, 63 evals); `CI=true node tools/e2e/installer.mjs` 45/45 (new T20); build
  and `runtime/lib` diff clean. Not run locally: package-install E2E (CI runs it). Not verified in a
  live Copilot or Grok session: the hook formats follow their docs, the Copilot changelog, and
  `grok plugin validate`.

## Merged, awaiting npm release

### Full-screen installer; the terminal never opens an agent

Merged through [#67](https://github.com/forsvn-labs/conquistador/pull/67) on 2026-10-08 at
`84b06b4`, from reviewed head `bf8de82`. The merge tree matches the reviewed tree. No npm release
was published; `0.4.0` remains the released package. Hung asked for a terminal that installs with
a full-screen UI and for CLI commands that give the agent context for its work.

- `tools/installer-tui.mjs`: the installer is an Ink app in the terminal's alternate screen. Five
  steps (Agents, Options, Review, Install, Done) with the brand colors and a gradient wordmark. The
  Done screen says what to type in each agent (`/conquistador init` in a project without
  `GROWTH.md`). A later `conquistador` run opens a home screen: add or change agents, update,
  check and repair, remove. Ink 8 and React 19 are bundled into `tools/vendor/ink.mjs` (406 KB);
  the npm package still depends only on `jose`.
- The terminal never opens an agent and never asks for a task. `conquistador "TASK"` prints the
  task's reading list and the command to type in the agent. `--in AGENT` now names the agent to
  install; `--no-open` is accepted and does nothing. The agents' launch commands and the Claude
  `--prefill` probe are removed. `--plain` and `TERM=dumb` keep the line flow without the task step.
- Help leads with install, then the commands an agent runs for context.
- Docs: README, INSTALL, VISION, the docs-site install, quickstart, and CLI pages. The docs site
  labels the change "From 0.5.0"; the version number is an assumption until Hung picks it.
- Final verification on 2026-10-08 at clean head `bf8de82` (macOS, Node 26.9.0):
  `CI=true node tools/e2e/installer.mjs` passes 44/44, including no-input fallbacks, long-card
  scrolling, hosted sign-in recovery, completed-install preservation and terminal restoration.
  Agent commands and normal hosted success use fixtures; recovery runs the real login code
  against loopback HTTP. `node tools/dev.mjs test` passes 920 tests (396 tooling, 294 runtime,
  167 catalog, 63 evals). [Product CI](https://github.com/forsvn-labs/conquistador/actions/runs/37806890733)
  passes on Node 24 and 26; both [integration checks](https://github.com/forsvn-labs/conquistador/actions/runs/37806890869)
  pass. [Package CI](https://github.com/forsvn-labs/conquistador/actions/runs/37806890912) passes
  Linux 50/50 and Windows 47/47, on merge ref `d4f80579` whose parents include `bf8de82`. Linux
  skips Node 22.18; Windows skips Node 22.18, two pseudo-terminal checks and Expect. Earlier
  macOS real-agent checks passed 21/21 without model calls. Live sign-in was not rerun for this correction.
- Review fixes: thrown install-effect errors reach Done with a failure summary and repair
  command; every bundled package has complete license text, including yoga-layout's upstream MIT
  license; `--yes` skips all installer questions; package I6 removes ANSI codes before matching
  the summary while retaining exit-code and payload-completeness assertions. Both inline
  CodeRabbit findings are resolved. Its latest review covers `bf8de82` with no actionable findings.
  Independent security, performance and correctness re-reviews pass on that exact head.
- Independent review follow-up: `--yes` also skips every question in `--plain` and `TERM=dumb`,
  including an omitted scope. Short Review and Done cards can scroll to their final line without
  exceeding the body height. Ctrl-C cancels asynchronous hosted sign-in, including fetch and body
  reads, while preserving completed installs and the existing token. It records Hosted MCP as
  skipped, verifies completed installs, and reaches Done with a retry command. File/package
  mutations keep their Ctrl-C guard. Login requests are bounded at 15 seconds and polling cannot
  outlast the device code's expiry.
- The regression checks were written before the correction (`c2693cd`). Baseline checks at
  `0bed602` reproduce all three findings. All nine hosted recovery checks pass within the final
  44-case run. Exact-head reports retain source hashes, raw terminal output and screen galleries.
  Before/after PNG capture and GitHub attachment uploads await explicit permission after browser
  security review denied those actions.

Open: a frozen spinner while a plugin manager runs (installs call `spawnSync`); no resize test in
the E2E harness; interactive Windows installation and Linux/Windows ARM remain untested.

Merge and release history is in [CHANGELOG.md](CHANGELOG.md). Ordered upcoming work is in
[ROADMAP.md](ROADMAP.md). Earlier progress records are retained in Git history.
