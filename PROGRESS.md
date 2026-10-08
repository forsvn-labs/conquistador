# Product progress

## Unshipped

### Full-screen installer; the terminal never opens an agent (branch `cli/tui-installer`)

Implemented and tested, not merged or released. Hung asked on 2026-10-08 for a terminal that only
installs, with a well-designed full-screen UI, and for CLI commands that give the agent context
instead of doing the work.

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
- Verification on 2026-10-08 (macOS, Node 26.9.0): `node tools/dev.mjs test` passes (396 tool
  tests; runtime 294, catalog 167, evals 63). `CI=true node tools/e2e/installer.mjs` passes 29/29
  at `94b9df2`, including `--yes` without `--scope` (failure modes
  T1-T19 and F1-F30, fake agents). `expect tools/e2e/real-agents.exp` 21/21 with real Claude Code
  2.1.292 and Codex 0.160.1 (no model calls). `node tools/e2e/package-install.mjs` passes 50/50
  locally at `73d2413`; the optional Node 22.18 check was not run. CI run
  [37799155850](https://github.com/forsvn-labs/conquistador/actions/runs/37799155850) tests the
  GitHub merge ref for head `94b9df2`: Linux 50/50 and Windows 47/47. Linux skips Node 22.18;
  Windows skips Node 22.18, two pseudo-terminal checks and the Expect real-agent check. Product
  checks pass on Node 24 and 26, and both optional integration checks pass.
- Review fixes: thrown install-effect errors reach Done with a failure summary and repair
  command; every bundled package has complete license text, including yoga-layout's upstream MIT
  license; `--yes` skips all installer questions; package I6 removes ANSI codes before matching
  the summary while retaining exit-code and payload-completeness assertions. Both inline
  CodeRabbit findings are resolved. Work remains unmerged and unreleased.
- Independent review follow-up: `--yes` also skips every question in `--plain` and `TERM=dumb`,
  including an omitted scope. Short Review and Done cards can scroll to their final line without
  exceeding the body height. Ctrl-C cancels asynchronous hosted sign-in, including fetch and body
  reads, while preserving completed installs and the existing token. It records Hosted MCP as
  skipped, verifies completed installs, and reaches Done with a retry command. File/package
  mutations keep their Ctrl-C guard. Login requests are bounded at 15 seconds and polling cannot
  outlast the device code's expiry.
- The regression checks were written before the correction (`c2693cd`). Baseline checks at
  `0bed602` reproduce all three findings. Nine hosted recovery checks now pass against loopback
  HTTP fixtures, and the repository suite passes all 920 tests. Installer coverage is expanded
  to 44 scenarios; the final committed-source run and CI remain to be recorded before merge.

Open: a frozen spinner while a plugin manager runs (installs call `spawnSync`); no resize test in
the E2E harness; interactive Windows installation and Linux/Windows ARM remain untested.

Shipped work, by date, is in [CHANGELOG.md](CHANGELOG.md). Ordered upcoming work is in
[ROADMAP.md](ROADMAP.md). Earlier progress records are retained in Git history.
