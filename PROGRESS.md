# Progress

## 2026-10-02: Mac first-use continuation (local, unshipped)

- Recovered the reviewed implementation at c8a131d from its checksum-verified bundle on macOS.
- Adapted the PTY dry-run test to macOS Expect; corrected the native harness to accept the remembered host in its non-terminal preview.
- Focused first-use/export/hook checks: 53/53. Offline routing: 117/117. Build/typechecks, plugin contracts and knowledge-map check pass.
- Native isolated-home agent-first harness: 14/14 with Claude Code 2.1.286 and Codex 0.159.3. This covers installation, prefill, remembered target, no-terminal preview, cancellation and removal, not completed model tasks or answer quality.
- Separate landing worktree aligns current claims with public 0.2.2; desktop/mobile browser checks: 90/90. Not deployed.
- Remote writes remain paused pending GitHub integration permission repair; no draft PR has been created. Exact additional evidence remains in the local task workspace.

# Product progress

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
