# Control center review, 2026-10-13

The home screen previously showed installed copies and hid most supported agents. An `npx` run
left no permanent CLI command. Plugin manager calls blocked terminal progress, and an MCP-only
install opened the first-run installer again. The new controls address those failure modes.

## Main implementation

`tools/installer-tui.mjs` is the main screen controller. It lists all 16 supported agents with
search, selects MCP apps, manages project skills and hooks, shows each install's scope and path,
and displays maintenance results inside the TUI. Enter on Done opens the manager; `q` exits.
Removal requires `y` after a review, including every agent affected by a shared skill folder.

The visual follow-up preserves the orange/yellow wordmark and uses orange rows for keyboard
focus. Wide terminals put the focused choice's explanation and selection summary beside the
list. Compact terminals use one column and keep the controls visible at 60×24. Checkboxes
distinguish selected agents and MCP apps from the keyboard cursor. Multiple selections survive
search, Back, resize, and installation. Space toggles one choice; `A` selects every agent, `a`
toggles detected agents, and `n` clears the list. Toggling detected agents keeps manual choices.
The TUI selects installation targets. Each coding agent owns its AI model settings.

`tools/onboard.mjs` owns the shared plan and verification flow. `tools/cli-install.mjs` installs
the permanent command with npm or Bun, checks its version and PATH, and reports a usable retry.
`tools/installer-operation.mjs` runs existing host adapters in child processes. This keeps their
ownership rules and lets the terminal animate while they run. It does not run an AI agent.

The install-and-launch commands are:

```sh
npm install -g @forsvn/conquistador && conquistador
bun add --global @forsvn/conquistador && conquistador
```

An `npx` run opens the TUI and offers permanent installation in the review. Plain package
installation runs no interactive lifecycle script. Scripts stay disabled for CLI self-installation.
The installer reports PATH problems and does not modify shell startup files.

## Social quality changes

The social method reads the shared AI-pattern reference and human writing stylebook before
drafting. A supplied draft defaults to edit mode. The critic must fail a banned pattern even
when the numeric score is high. Shared core references remain bounded to the owned library.

The exact original tweet and rewrites A/B are in `tools/e2e/fixtures/social-style.json`. The
original passes unchanged. The rewrites fail on colon labels, rhetorical negative parallelism,
and false ranges. The third pattern case is synthetic. Literal times, prices, URLs, file-format
conversions, and factual alternatives remain valid. These checks identify predictable patterns;
they do not prove authorship or usefulness. A clean check also does not validate a shell command.
The documented install command is `npx @forsvn/conquistador`.

## Repeat the verification

Run from the full source checkout:

```sh
bun install --ignore-scripts
node tools/dev.mjs build
node tools/dev.mjs test
node tools/e2e/installer.mjs --out dist/e2e/installer
node tools/e2e/check.mjs
node tools/e2e/social-style.mjs
node tools/e2e/package-install.mjs dist/e2e/package-install
```

The module dependency trees must be installed before build and product tests. The terminal
checks need Python 3 and a Unix pseudo-terminal. Each E2E run saves a report. Terminal runs also
save screen transcripts and a gallery. The report records source hashes. Iris captures the
before/after terminal cells, with synthetic host fixtures; screenshots are attached to the PR
and kept in the project's Drive evidence folder, outside Git.

Local results: 940 product tests, 59 terminal scenarios, 44 copy-check scenarios, and 11 social
style checks pass. Build and type checks pass. The new installer modules pass configured lint.
The existing broader tooling lint baseline is outside this change's validation claim.
The two modified TUI/E2E files have no configured lint findings on changed lines. Their existing
baseline decreases from 344 findings to 340; this pass does not claim those files are lint-clean.

The visual follow-up first recorded three failing E2E cases, then passes the full 59-scenario
terminal suite. After shortening a clipped help sentence and fixing spacing, the final five
affected cases pass again. Existing host/launch checks pass 19/19. The Impeccable detector
reports no findings, but it has limited coverage of an Ink TUI. Iris before/after captures use
the same three-agent fixture. The MCP capture selects Claude Desktop and Zed together. These
figures show real terminal cells; host adapters in these cases are explicitly synthetic.

Exact-package checks at `2c89d3e` pass 50/50 applicable cases, including 21 native terminal
checks. The Node 22.18 run is explicitly not run. A real Bun global install of the same tarball
passes 7/7 checks, including startup of the complete catalog. Tarball SHA-256 is
`9c588c602da21b0be21e79bb8a24e46e7f4a6c2a093d730cdc5c7be12190a760`.
Node 24/26 product CI, Linux/Windows package CI, and optional integration checks pass for that
head. [PR #75](https://github.com/forsvn-labs/conquistador/pull/75) contains the review and captures.

## Limits and release

The source is under review. npm `latest` remains 0.5.1. Native Windows interactive installation,
ARM platform coverage, native MCP app loading, live Executor cases, real writing quality, and
human acceptance remain separate checks. Package verification tests installation bytes and
local host registration; it does not establish an agent's output quality. Merge and release
require Hung's approval. No npm release or hosted server deployment occurred in this task.
