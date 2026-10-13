# Control center review, 2026-10-13

The home screen previously showed installed copies and hid most supported agents. An `npx` run
left no permanent CLI command. Plugin manager calls blocked terminal progress, and an MCP-only
install opened the first-run installer again. The new controls address those failure modes.

## Main implementation

`tools/installer-tui.mjs` is the main screen controller. It lists all 16 supported agents with
search, selects MCP clients, manages project skills and hooks, shows each install's scope and path,
and displays maintenance results inside the TUI. Enter on Done opens the manager; `q` exits.
Removal requires `y` after a review, including every agent affected by a shared skill folder.

The visual follow-up preserves the orange/yellow wordmark and uses orange rows for keyboard
focus. Wide terminals put the focused choice's explanation and selection summary beside the
list. Compact terminals use one column and keep the controls visible at 60×24. Checkboxes
distinguish selected agents and MCP clients from the keyboard cursor. Multiple selections survive
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

Local results: 940 product tests, 60 terminal scenarios, 44 copy-check scenarios, and 11 social
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

Exact-package checks at `6661cea` pass 50/50 applicable cases, including 21 native terminal
checks. The Node 22.18 run is explicitly not run. A real Bun global install of the same tarball
passes 7/7 checks, including startup of the complete catalog. Tarball SHA-256 is
`0d0a7f881f5f43acb660139aeb61303e1ef639d8ca5d7e00f36adf09094cca5c`.
Node 24/26 product CI, Linux/Windows package CI, and optional integration checks passed for the
earlier `2c89d3e` code. [PR #75](https://github.com/forsvn-labs/conquistador/pull/75) contains the
current CI results, review, and captures. The following documentation commit records this
acceptance and does not change the candidate's package files.

## MCP flow review

Reviewed Executor's official docs on 2026-10-13. Our old "MCP apps" label meant desktop/editor
clients. It is now "MCP clients"; the manager says "MCP connections". The official
[MCP Apps extension](https://modelcontextprotocol.io/extensions/apps/overview) means an interactive
interface inside an AI conversation. Public flags, config keys, and documentation URLs stay compatible.

Executor's [getting-started flow](https://executor.sh/docs) adds apps, connects reusable accounts,
then connects the agent. Its [client setup](https://executor.sh/docs/mcp-clients) uses one HTTP
endpoint and browser sign-in for hosted use. Scoped connections choose accessible profiles and
tools. Provider credentials stay in Executor. Use an approval mode where the person can answer
the exact request. Reconnect the client before checking discovery.

The [MCP guide](https://executor.sh/docs/mcp) keeps the exposed tool set small. Read app skills,
search for the needed operation, inspect its signature, then call it. Use code mode for dependent
calls or to reduce large results. Resume a paused request after the user's answer; do not replay it.
The [approval contract](https://executor.sh/docs/concepts/tools-and-approvals) belongs to each
operation. A skill or a read-like name does not grant permission.

Our adapter used Executor 1's source CLI. The current
[CLI migration guide](https://executor.sh/docs/run/cli) replaces those commands in v2. Detection,
registration, verification, and removal now guard v2 before invoking them. An unsupported
registration gets a manual handoff, stages no unused plugin, and records no connection.
Unsupported removal keeps the previous source record. This is a compatibility guard, not native
Executor 2 integration. Local stdio remains a standard
[MCP transport](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).

Next: follow [native app authoring](https://executor.sh/docs/author-an-app) or the documented
MCP import flow, pin the host's framework version, and verify scoped authentication, discovery,
approvals, updates, and removal against an actual v2 host. Keep the existing Conquistador
library as the source of the playbooks. No remote app was created or deployed in this review.

The MCP follow-up passes all 60 terminal scenarios and 940 product checks. The initial three
affected scenarios failed before the change. A separate failing status-message check was added
before fixing it; the final six affected scenarios pass. Configured lint has no findings on
changed JavaScript lines. The v2 fixture rejects removed commands and makes no successful host
connection. These checks prove the local handoff and record preservation, not live v2 support.
The repeatable E2E report includes source hashes for the source adapter and contract fixture.
Iris captures the renamed client picker with Claude Desktop and Zed both selected.

The exact package at `d5b04bd` passes 50/50 applicable acceptance checks, including 21 native
terminal checks. A real Bun global installation of the same package passes 7/7. Package
integrity hashes match across the acceptance run and saved Bun candidate. Its SHA-256 is
`1c02d494354f15c44e1a0e16665357597d523fa49a9d07220e71ac44836a210b`.
Node 22.18 acceptance remains explicitly not run. The following documentation commit records
these results without changing the package files.

## Context alignment

The branch is rebased on PR #76's merged record migration. ROADMAP owns the full live handoff,
STRUCTURE maps the source and working commands, and DRIVE uses the approved neutral project key.
The retired root files are absent. Active readers point to current records; historical changelog
links point to a dated Git source without changing shipped facts. Six context checks pass. Task
evidence is in the current registered project verification folder. Production code is unchanged
by this rebase; the inherited E2E fixture uses ROADMAP as its project context.

The exact package at `ba7cd9e` passes 50/50 applicable checks, including 21 native terminal
checks. A real Bun global installation of the same bytes passes 7/7. Its SHA-256 is
`cb7ff9732826a74d899976ada37d39f6aaa253088eaea7deb95647e15da49525`.
The Node 22.18 case is explicitly not run. The next documentation commit records this acceptance
without changing the package files.

## Review fixes before merge

Five verified review findings are corrected. Each candidate range gets its own exception and
bounded prefix scan. An unverified CLI install records no new installation and preserves the
previous CLI record. Copying the dry-run install command preserves npm or Bun. Failed or unreadable
Executor version detection permits no legacy source operation; successful detection reads both
output streams. The MCP client usage text now says that clients connect to the local server.

The new regression run first passed 2/9 installer cases and 12/15 social cases. The initial
first-use assertion used a non-terminal call, which prints help; it now exercises a real
pseudo-terminal. The full 64-scenario terminal suite, 940 product checks, 44 copy checks, and
15 social checks pass. Configured lint has no findings on changed JavaScript lines. Reports and
terminal transcripts are kept in the project's approved verification folder. Negative Executor
fixtures prove the guard, not live v2 connectivity. npm release and native v2 migration remain open.

## Accepted source integration

Hung approved integration on 2026-10-13. The five review findings are fixed and all four inline
threads are resolved. The reviewed commit `c4175ff` passes Node 24/26 product CI, Linux/Windows
package CI, optional integration checks, CodeRabbit, and the docs deployment check.
[PR #75](https://github.com/forsvn-labs/conquistador/pull/75) merged at
`0cefef32ae734bc6199efd1d08fe8b4310d73e59` on 2026-10-13.

The exact reviewed package passes 50/50 applicable installation checks, including 21 native
terminal checks. A real Bun global installation of identical bytes passes 7/7. Its SHA-256 is
`a4ed2cf644762d8469e54011671876eb7c727bca30020e74dc7a562485e4f430`.
The full terminal suite passes 64/64; product checks pass 940, copy checks 44, and social checks 15.

## Limits and release

The source is merged. The package version remains 0.5.1; a new npm release is pending. Native Windows interactive installation,
ARM platform coverage, native MCP client loading, live Executor cases, real writing quality, and
human acceptance remain separate checks. Package verification tests installation bytes and
local host registration; it does not establish an agent's output quality. Merge and release
require their recorded acceptance. No new npm release or hosted server deployment occurred in this task.
