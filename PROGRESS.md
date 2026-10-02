# Product progress

## Unshipped: October 2026 overhaul (one skill, commands, plays)

The published public alpha remains **0.2.2**. This work is on `overhaul/2026-10` and waits for
Hung's merge decision. Spec: [docs/OVERHAUL-2026-10.md](docs/OVERHAUL-2026-10.md).

- **One skill, one vocabulary.** Hosts register one skill, `/conquistador`. The 38 methods are 35
  one-word commands (`position`, `outreach`, `seo`, ...), and `results` and `build` have modes. The
  21 hidden workflows are plays (`launch`, `gtm`, `outbound`, ...) with declared chains. Plays that
  ship finished assets end with `audit`. `MIGRATION.md` maps every old name; old names still route.
- **Router.** The brief scores plays and commands together and returns a play's steps with the
  playbooks to read at each step. Filler words ("cannot find", "ask me", "learn the product") no
  longer select `video` or `budget`. Meta commands run only when invoked by name.
- **First run.** `/conquistador init` writes `PRODUCT.md` (Impeccable-compatible) and `GROWTH.md`,
  and every brief lists them first. `conquistador signals` reports what the project already has;
  the no-argument menu leads with two or three commands from those signals. `pin` and `unpin`
  make standalone shortcuts in six agents.
- **Checker.** `conquistador check` runs 51 rules with no model: unsupported claims, AI-writing
  tells, vague calls to action, channel limits, email compliance, and link hygiene. JSON output
  and exit codes 0, 1, 2. A hook checks marketing files after edits in Claude Code, Codex, and
  Cursor. One marketing-file rule serves the hook and `signals`.
- **Connect.** `conquistador connect` reports 22 provider-agnostic capabilities as missing,
  connected, or verified through Executor, installs Executor after confirmation, and verifies one
  read. Recipes in `skills/conquistador/integrations/` are Markdown. Nothing in Conquistador
  starts an Executor daemon by accident.
- **Review.** `conquistador review` opens Markdown in the FORSVN Proof fork (channel previews,
  check findings as comments, Playbooks applied, a human-only approval stamp bound to the SHA-256
  of the exact text) and HTML in Lavish 0.1.80 (was 0.1.50), both on loopback. A six-template
  artifact kit ships for ad sets, social posts, email, landing sections, funnels, and calendars.
- **Install and CLI.** The installer detects 12 agents (adds Gemini CLI, OpenCode, Pi, Hermes,
  Antigravity, Kiro, Mistral Vibe), offers "keep or customize", asks global or project scope, and
  opens the agent with `/conquistador init` on a new project. `doctor --fix` repairs drift. Node
  22.18 is enough. The package is 3.61 MB packed (was 4.46 MB) with 1,306 files (was 1,704).
- **Docs.** README and INSTALL follow Impeccable's shape. The parent skill is 126 lines; the
  evidence prose moved to `docs/MASTER-AGENT.md`.

### Integration verification (3 October 2026, macOS arm64, Node 26.9.0)

- `npm run build`: pass. `npm test`: **833/833** (309 tooling, 294 runtime, 167 catalog, 63 evals).
- E2E: routing breadth **142/142**; check **44/44**; first run **13/13** (3 Executor cases not run);
  connect **4/4** (2 live cases not run); review **18/18** against the real Proof fork, headless
  Chrome, and Lavish 0.1.80; package install **51/51** from the packed tarball on Node 26.9.0 and
  22.18.0 with the real agent CLIs; agent-first **19/19** with Claude Code and Codex.
- Integration fixes: one marketing-file rule (site pages such as `index.html` now count);
  `signals` uses the connect probe and does not count integrations on a folder-scoped daemon;
  meta commands stay out of word-overlap routing; the README drift check now verifies that every
  command and play is listed.
- Not run: live Executor cases (Executor needs a restart), live hook observation outside Claude
  Code, model task quality, and human verdicts.

## Unshipped: bounded first use and release-state consistency

The published public alpha remains **0.2.2**. These source changes do not imply a new registry
release, deployment, native host/model run, or human acceptance.

- Bot exports use verified ownership and staged replacement; private exclusion removes previously
  exported private files on successful rebuilds and reports exact included contents
- Plugin health checks the complete plugin hash inventory, and hooks check current successful
  returned content rather than attempted or historical reads
- The launcher selects one host before installation; task dry-run is read-only and recovery
  commands are executable. Status distinguishes recorded registration from observed local checks
- README and INSTALL distinguish the published 0.2.2 all-host launcher from the proposed
  selected-host flow, and provide an explicit named-host install route usable with 0.2.2
- Scope, preview, repair, update, and removal guidance distinguishes shared plugin files,
  selected host registrations, personal playbooks/configuration/exports, and the npm executable
- Usage leads with three bounded supplied-context tasks: one welcome email, one growth
  experiment, and one signup recovery specification. Each has a complete author-written
  synthetic example and a fact-preserving correction expectation
- Public-alpha acceptance separates installation, discovery, hook trust, loaded knowledge,
  artifact correctness, correction quality, live operations, and human verdicts. The existing
  PRIVATE-ALPHA filename is retained for link compatibility
- Product principles and roadmap no longer present public release as a future private-alpha
  milestone. Historical shipped evidence in CHANGELOG is unchanged

## Local verification (2 October 2026)

- `npm run build` passed on Linux x64 with Node 24.19.0; maintained `runtime/lib` is unchanged
- `npm test` passed **831/831**: 307 tooling/host contracts, 294 runtime, 167 catalog, 63 Eval Lab
- Catalog validation passed for 17 operations; the local contract example remained explicitly synthetic
- `node tools/e2e/routing-breadth.mjs` passed **117/117**; `knowledge-map --check` and
  `git diff --check` passed
- New regression coverage includes bot replacement/privacy (28), plugin payload integrity (13),
  current successful hook evidence (14), and front-door scope/dry-run/lifecycle (11)
- A real Linux pseudo-terminal verified task dry-run with synthetic host executables. Installation,
  repair, update, and removal checks used isolated homes and synthetic host CLIs
- Independent read-only review cleared the requested first-use scope after checking final payload
  equality, 14 hook tests, argument/error paths, scope, and documentation
- Root-config lint has zero introduced/modified-line diagnostics across 21 changed code files.
  It still exits nonzero on existing debt: 710 diagnostics, down from 809 on the same baseline files.
  All five new code/test files lint clean; no lint configuration was weakened

The initial aggregate run found a legacy standalone dry-run routing regression and an empty
Git-marker discovery bug. Both were fixed and are covered by the passing final run. The copied
setup-entry fixture now includes its new payload-module dependency.

See [first-use review and acceptance ledger](docs/REVIEW-2026-10-FIRST-USE.md) for fixed versus
deferred audit findings. Native host/model usefulness, provider/account operation, human verdict,
and the inaccessible landing website remain unverified. No release, merge, or deployment is included.

Shipped work, by date, is in [CHANGELOG.md](CHANGELOG.md). Ordered upcoming work is in
[ROADMAP.md](ROADMAP.md). Earlier progress records are retained in Git history.
