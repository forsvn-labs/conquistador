# Product progress

## 0.0.17 candidate: npm installs fixed, not tagged

A user reported that the documented 0.0.16 install stopped with a Node stack trace. Every
`npm install -g` and `npx` install copied an empty plugin, so no agent got Conquistador. The
release tests ran from the source checkout and could not see it. See Part 4 of
[docs/REVIEW-2026-09-SURFACES.md](docs/REVIEW-2026-09-SURFACES.md).

Verified on macOS, 2026-09-29, at `20157b3`:

- `node tools/e2e/package-install.mjs`: 28 of 28 with real Claude Code 2.1.284, Codex 0.158.0,
  Cursor Agent, Copilot CLI 1.0.87, and Grok CLI 1.0.44 in isolated homes, no model call. It
  installs from Git with npm and from a packed tarball with `npx`, and runs `agent-first.exp`
  (14 of 14) against the installed binary. Artifact: `dist/e2e/package-install/report.json`.
- The same E2E on `v0.0.16` fails I1 for all five agents.
- `npm test` 764 of 764. Routing breadth 119 of 119.

Not done: the tag, the release assets, the push, and the merge. Those wait for your approval.
Public beta needs a decision on npm publication and repository visibility (Part 4, "Public
beta: open decisions").

## Shipped 0.0.16: agent-first start, host acceptance pending

The [v0.0.16 private prerelease](https://github.com/forsvn-labs/conquistador/releases/tag/v0.0.16)
shipped from merged source `a833d92041a94497fce20c73466fd476bd1dcab5` (#16) with six published assets. The downloaded
assets match `SHA256SUMS`, and installs from the tarball and the Git tag report `0.0.16`.

Bare `conquistador` now installs into every found agent without asking, asks for a task, and
opens the agent with the task typed in. Claude Code gets `--prefill` (the task waits for Enter);
Codex, Cursor Agent, Copilot CLI, and Grok CLI start the task at once. See Part 3 of
[docs/REVIEW-2026-09-SURFACES.md](docs/REVIEW-2026-09-SURFACES.md).

Verified on macOS, 2026-09-28:

- `expect tools/e2e/agent-first.exp`: 14 of 14 checks with real Claude Code 2.1.283 and Codex
  0.157.1 in an isolated home, no model call. Artifacts: `dist/e2e/agent-first/transcript.txt`
  and `report.json`.
- `npm test` 764 of 764. Routing breadth 119 of 119 (adds 10 start-prompt cases). Install
  lifecycle passes for five agents.

Not verified: Copilot CLI, Grok CLI, and Cursor Agent launches (same argument pattern, not run);
the Cursor editor clipboard fallback; Windows (`spawn` with a shell) and Linux terminals; any
answer quality. `tour.exp` and `installer.exp` were retired; `agent-first.exp` covers both flows.

## Shipped 0.0.15

The [v0.0.15 private prerelease](https://github.com/forsvn-labs/conquistador/releases/tag/v0.0.15)
shipped from merged source `07112aeb0e18b0b3995fce2a4680b5c2fa52f4a9` (#14) with six published
assets. See [CHANGELOG.md](CHANGELOG.md) for the shipped scope and
[docs/REVIEW-2026-09-SURFACES.md](docs/REVIEW-2026-09-SURFACES.md) for findings and evidence.

Still unverified after the ship:

- Hook delivery in real Codex (after hook trust), Cursor, Copilot CLI, and Grok CLI sessions. Only
  Claude Code sessions were observed.
- Answer quality. The E2E measures playbook reads and citations, not whether the work is better.
- The Docker image build, remote hosting of the HTTP server, and any bot app screen.
- Native Windows and Linux, including the start flow in those terminals.
- `tools/node-onboarding.e2e.py` was not rerun: it tests the old Node-version gate, which 0.0.15
  removed. Retire or rewrite it for the per-project flow.

## Shipped 0.0.14 recovery, host acceptance pending

The [v0.0.14 private prerelease](https://github.com/forsvn-labs/conquistador/releases/tag/v0.0.14)
shipped from merged source `cd34526e790e73042ed974dee27096dcb4e08538` with six published
assets. Native host discovery, method reads, task quality, and a user verdict remain unverified.
The following local evidence records the recovery work before publication.

The installed 0.0.13 CLI reproduced the reported failure in a disposable project. With an
edited `.conquistador/SKILL.md`, the bare command selected the project, printed "Your
Conquistador files have local edits," and exited 1. The edit remained on disk. A fresh project
completed the existing Node 24 handoff, setup, doctor, and first-task path. The trigger is a
receipt mismatch in the operator or a recorded native skill. Node version selection and project
selection are preceding steps, not the cause of this exit.

The release adds interactive choices to use edited files, inspect affected paths, choose another
project, cancel, or explicitly back up and set up again. Re-setup preserves the operator and all
recorded native skill folders in a named project backup before installing with the same hosts.
The backup includes local additions inside those folders and a path manifest. Other project files
stay in place. A failed manifest write restores the original paths. Noninteractive install and
update still refuse modified copies. Unowned folders, conflicting operator copies, incomplete
transactions, and domain-restricted copies do not get an automatic replacement path.

A packed and installed CLI passed 26 PTY terminal scenarios, including edited-file cancellation,
two consecutive re-setups with distinct backups, four-host preservation, manifest-write rollback,
fresh install, optional-route behavior, and Node 24 continuation. Repeat with
`CONQUISTADOR_E2E_WRONG_NODE=/path/to/node26 CONQUISTADOR_E2E_NODE24=/path/to/node24
python3 tools/node-onboarding.e2e.py INSTALLED_CLI OUTPUT_DIR`. The uncommitted evidence is
`dist/setup-recovery-evidence/e2e-reviewed/node-onboarding-e2e.json` with terminal transcripts.
These checks establish local file recovery and CLI behavior, not host discovery or task quality.
Node 24.21.0 `npm run build` and `npm test` passed: 240 host/tooling, 294 runtime,
167 catalog, and 63 evaluation checks. The vendored anti-slop plugin reported only the
existing readable-spacing rule in the touched JavaScript. With that inherited rule disabled
for the focused pass, the touched files had no errors and one existing control-regex warning.

## Shipped 0.0.13 and installed-copy acceptance

The [v0.0.13 private prerelease](https://github.com/forsvn-labs/conquistador/releases/tag/v0.0.13)
resolves to merged `private-alpha` commit `653058ac2b9c5f0cefe926bb238879191caf8a9b`.
Node 24.21.0 build and 764 local checks passed (240 host/tooling, 294 runtime, 167 catalog,
63 evaluation). Six assets were downloaded fresh; four archives passed downloaded `SHA256SUMS`,
and downloaded checksums and `assembly.json` matched local assembly bytes. The authenticated
private-Git lifecycle passed after cache deletion, including version, 38-method doctor, install,
start, update, uninstall, and receiving-project preservation. Local assembly remains `UNBOUND`.

Both npm-owned CLI copies (`/opt/homebrew` and `~/.local`) and the home operator plus four native
skills report 0.0.13. A real login-shell bare command under Node 26 reached a verified Node 24,
completed setup and local doctor, and printed a first-task handoff in a disposable project.
The installed-package suite passed 21 scenarios with each CLI. Codex and Cursor retain their
private three-line insertion and correctly report modified receipts; the home operator doctor
exits 1 for receipt integrity while showing 38 methods and matching completeness. Clean Claude
Code and Copilot native doctors pass. No PATH or shell startup changes were made.

This proves local setup and ownership only. Fresh host discovery, model method reads, useful task
output, provider access, and the user's verdict remain unverified. See the release entry
in [CHANGELOG.md](CHANGELOG.md) and remaining gates in [ROADMAP.md](ROADMAP.md).

## 0.0.13 candidate development (historical, shipped after verification)

Follow-up installed-package E2E failure matrix (independent review of PR head `87d7a03`):

| Scenario | Required outcome | Observed before repair |
| --- | --- | --- |
| Files-only operator → add Claude Code | Confirm and record native host, preserving existing ownership | Invalid `none,claude-code` host set; exit 1 |
| Native operator → explicit `--host none` | Preserve existing native host; do not convert ownership | Invalid host union or misleading host-add attempt |
| Returning or fresh operator → optional route fails or interrupts | Preserve route exit 1/130 and completed copies | First-task chooser resumes; command exits 0 |
| Unsupported Node launcher → verified Node 24 child → outer SIGTERM | Forward termination and reap setup child | Launcher exits; child remains orphaned |
| Unsupported Node launcher → SIGTERM during apply | Stop the setup process tree before exit; do not claim rollback | Installer re-parents and writes an operator after launcher exit |
| Fresh operator → Ctrl-C in optional route | Exit 130; identify the completed owned operator | `No files changed` despite installed operator |

E2E failure matrix (installed 0.0.12 CLI, neutral `/tmp`, before implementation):

| Node / terminal / invocation | Expected safe outcome | Observed baseline |
| --- | --- | --- |
| 26 / TTY / bare | Ask before writing; identify verified Node 24 or give selection steps | Exit 1 with `Switch Node versions`, before project prompt |
| 24 / TTY / bare | Project, host, plan, apply, doctor, first task | Reached `Project: /private/tmp` and guide; stopped before apply |
| 26 / no TTY / bare | Actionable Node 24 instructions, nonzero | Help, exit 0 (entry masks preflight) |
| 24 / no TTY / bare | Help, no write | Help, exit 0 |
| 26 / TTY / decline or no Node 24 | No project write; cancellation or manager-specific recovery | No choice exists |
| 24 / TTY / repeated bare in installed project | Doctor and first-task handoff; optional choices visible | Returning path bypasses project/host/plan selection |
| 26 / no TTY / explicit `--host codex --yes` | Guidance, nonzero; no project write | Generic Node error, exit 1 |

The installed bin is `runtime/bin/conquistador.js` with `#!/usr/bin/env node`; interactive bare imports `tools/onboarding.mjs` and `assertNode24` runs after parsing but before the TUI. The environment mask is the shebang's PATH-selected Node 26, despite an independently installed nvm Node 24.21.0; non-TTY bare passes `--help` at the bin and never checks Node. A small counterfactual with the same installed bin, cwd and arguments but PATH headed by nvm Node 24 reaches the project guide. `--version` and `--help` on 26 work, disconfirming a broken bin/package hypothesis. History `084593d` introduced this path and `f540d25` added returning-user first-task handling. Neither preflight nor help provides a version manager command. These are local command observations, not host acceptance or a new release.

The unreleased 0.0.13 candidate advances the product version in package, plugin, host,
portable-agent, and matching schema metadata; provider API versions and internal schema versions
remain independent. It uses a bounded Node 24 preflight only for bare and top-level onboarding flags;
help/version and unrelated minimal command bundles do not import the new module on supported Node.
A candidate is offered only from a known nvm account-home or Homebrew installation after checking
its executable, ownership, permissions and reported version. The user must select it; the child
repeats the same cwd and arguments without changing the parent shell. No-TTY exits nonzero with
selection instructions. The bare terminal guide now chooses a project (including an existing
project outside the cwd), one host, an installation plan, apply, local doctor and first-task handoff.
Optional routes can be selected and run with their own checks and confirmations; manual host
activation remains distinct. Existing modified copies are not updated on bare invocation. Independent review found that
adding a host to an unchanged BB operator could adopt an independently managed native skill
without naming that ownership transfer at confirmation. The returning-host plan now names the
exact folder and warns that operator uninstall will remove it. Declining preserves the original
skill and host record; accepting marks it adopted. The installed-package E2E covers both outcomes
and the subsequent uninstall. The next review found three additional P2 defects in the new
paths: `none` combined with a native host, lost optional-route statuses, and an orphaned Node 24
child after launcher SIGTERM. The returning-host union now removes the files-only sentinel,
`--host none` explicitly preserves existing native owners, optional routes stop and return their
nonzero or 130 status. A later real-process review found that forwarding SIGTERM to only the
Node 24 child still left its setup descendant running during apply. The launcher now isolates
the continuation in a process group, signals the whole group and waits for the child before
returning. It does not claim rollback of partial setup; preserve any transaction recovery files.
Fresh optional-prompt cancellation now names the already installed, owned operator instead of
saying no files changed.

Node 24.21.0 `npm run build` and `npm test` passed (240 host/tooling checks plus runtime,
catalog and evaluation suites). A locally packed and installed tarball passed 21 TTY/non-TTY
scenarios: wrong-Node continuation, cancel, no-candidate guidance, repeat setup, right-Node
repeat, optional MCP selection, returning-host adoption decline and acceptance, files-only host
addition and native-owner preservation, optional-route failure/interrupt (fresh and returning),
launcher SIGTERM child and during-apply setup-tree cleanup, fresh optional-prompt cancellation
wording, noninteractive and help/version paths. Repeat with
`CONQUISTADOR_E2E_WRONG_NODE=/path/to/node26 CONQUISTADOR_E2E_NODE24=/path/to/node24
python3 tools/node-onboarding.e2e.py INSTALLED_CLI OUTPUT_DIR` after `npm pack` and an isolated
`npm install --prefix` of the resulting tarball. The uncommitted evidence is in
`dist/node-onboarding-e2e/node-onboarding-e2e.json` and matching terminal transcripts. The
exact committed HEAD was also archived into a clean tracked-source copy, packed without
`node_modules` (1,663 files, approximately 4.26 MB), installed in an isolated prefix and passed all 21
scenarios again in `dist/node-onboarding-e2e/clean-evidence-013/node-onboarding-e2e.json`.
The clean installed CLI and sampled package, plugin, host, and agent manifests all report
0.0.13. The versioned operator resources were rehashed in `release/completeness.json`.
The touched-JS anti-slop run reports only the inherited readable-spacing rule (no other rules).
At the candidate stage, these tests established local setup behavior, not host registration,
model task quality, or a private release. The later release verification is recorded above.

The growth-diagnosis and first-run work below shipped in the
[v0.0.12 private release](https://github.com/forsvn-labs/conquistador/releases/tag/v0.0.12)
from `738d24268bee03e0bc8880d22b21b665951881c9` on 2026-09-24. See
[CHANGELOG.md](CHANGELOG.md) for the release record and
[ROADMAP.md](ROADMAP.md) for remaining acceptance work. The independently reviewed product
commit `855acdf618e6fd85548dbcc94496cdf53374a951` passed four review checks.
Node 24.21.0 build and 764 local tests passed (240 host/tooling, 294 runtime, 167 catalog,
63 evaluation). The installed-project checks cover local route, hook, MCP, and ownership
behavior, not native host output. The anti-slop readable-spacing rule still reports a
pre-existing baseline; it is not a clean repository-wide lint gate.

At the v0.0.12 release check, the observed `/opt/homebrew` CLI, operator and four native skills
reported 0.0.12 and 38 methods. Codex and Cursor receipts intentionally report modified
because their copies retain a three-line private FORSVN instruction; preserve it during later updates. Claude
Code and Copilot copies are clean. Fresh Codex native execution could not be checked: even
`codex --version` hung and exited without output. No human usefulness verdict exists.
Native-host execution and human acceptance remained separate work, not implied by the
v0.0.12 tag, downloaded assets or local checks.

## Low-signal unit-test prune audit (2026-09-25, unshipped check)

Audited all 92 test files against the installed-project E2E
(`tools/growth-diagnosis.e2e.test.mjs`), which covers Codex install, 38-method routing plus
adversarial cases, first task, hook context, doctor, uninstall, and local MCP. Removed 0,
retained 92: every file asserts at least one fail-closed, security-boundary, contract, or
regression behavior the E2E does not exercise (served runtime/API/HTTP, durable runner and
review gates, provider wire mapping and credential redaction, OIDC/human auth, lifecycle
backup/restore/erase, corpus/registry/judgment sealing, catalog gateway and receipts, eval-lab
release-claim and calibration, host orchestration, and installer edge cases such as symlinks,
traversal, malformed input, and cross-platform paths). No package-script, CI, or doc changes
were needed: every test file runs under `npm test`, a module `test:source` run, or the hosts
integration workflow, and no file was dead or fully subsumed. Deliberately kept borderline
cases: `runtime/tests/publication.test.ts` (protocol schema shape and no-live-claim README
guards), `runtime/tests/routing-manifest.test.ts` (exact parent-job/outcome arrays as a
cross-module contract), and the `test:source`-only private-authority suites (`candidate`,
`self-hosted-conformance`, `inventory-preflight`, `promptfoo-live`, `historical-readiness`),
which are maintainer interfaces per AGENTS.md, not public checkout prerequisites.

Verification on this checkout under Node 24.21.0: `npm run bootstrap`, `npm run build`
(clean, `runtime/lib` in sync), full `npm test` passed, and the growth-diagnosis E2E passed
with a repeatable artifact (`CONQUISTADOR_E2E_ARTIFACT=dist/growth-diagnosis-e2e.json
node --test tools/growth-diagnosis.e2e.test.mjs`, schema
`conquistador.growth-diagnosis-e2e/v1`, 38 methods).

## Shipped growth-diagnosis and first-run hardening (historical verification)

The installed 0.0.11 route selected `shape-initiative` for a synthetic growth-stall prompt with
flat visits, falling trials and upgrades, and a broad "what should we do next" question. Adding
"Diagnose growth" selected the intended method. A fresh Codex CLI 0.155.1 session with GPT-6
Astra read the full installed `diagnose-growth` method and required resources and produced a
bounded analysis. This supports a routing repair; the original captain prompt and host trace
remain unavailable, so the historical answer cannot be attributed to one cause.

The reviewed routing change sends adverse growth-metric changes to `diagnose-growth` and drops incidental
`shape-initiative` matches unless the user asks to shape an initiative. An incidental growth
reference in a code-refactor request abstains; explicit initiative shaping remains selectable.
The default guide now
offers four first tasks. `--task diagnose-growth` works in noninteractive setup and `start`; the
handoff prints saved activation, local hook registration, method-read verification, and recovery
steps. The operator, native skill, plugin, MCP, and BB paths retain separate host ownership.

An installed-project end-to-end check stages a source copy in `dist/e2e-tmp`, installs the Codex
operator, checks 38 methods, routes the representative prompt and three paraphrases, checks
unrelated-request abstention, invokes the installed prompt hook, verifies its method/resource
paths, removes the hook and operator, and preserves a project file. It can write a JSON evidence
artifact with `CONQUISTADOR_E2E_ARTIFACT=dist/growth-diagnosis-e2e.json`.

On macOS ARM64 with Node 24.21.0, `npm run build` passed. `npm test` passed 764 checks:
240 host/tooling, 294 runtime, 167 catalog, and 63 evaluation. A live terminal guide chose
the diagnosis task and installed the Codex operator with manual activation and no hook. Codex CLI
0.155.1 with GPT-6 Astra then read that installed native parent, the complete diagnosis method,
all three required resources, and relevant optional files. Its answer computed the observed
rates, separated accounting from causal claims, marked cohort and denominator limits, and proposed
one read-only reconciliation. It reported same-context review and no independent agent. The
trace is a local observation, not acceptance for other prompts, models, or hosts.

The repository's catalog already registered anti-slop rules but lacked their vendored plugin.
This change restores the pinned plugin, adds a source configuration, and records the
bundled source digest in `tools/oxlint/anti-slop/UPSTREAM.md`. The plugin runs; its readable-spacing
rule reports a large pre-existing baseline in touched files, so this work does not claim a
clean anti-slop lint gate. Build and full product-test results are recorded after verification.

### Independent review repairs

The first independent review of `ae4fc37` found that the selector dropped an explicitly named
`shape-initiative` method beside `plan-campaign`, treated a slowing CI pipeline as a growth
problem, and failed to route the guide's "Review growth results" prompt. The corrected selector
preserves named methods, requires a business pipeline phrase for growth inference, and selects
`measure-growth` for a growth-results review. The installed CLI and prompt hook check all three.

The wider review found that splitting requests at "and" made
`design-pricing-and-packaging` unreachable by its exact name and its natural "pricing and
packaging" intent. It also found that local MCP listed the parent's 193,854-byte routing
contract but refused to read it under a 131,072-byte file limit. Compound declared intents now
stay intact during clause segmentation, while ordinary clauses retain their separate routing.
MCP accepts up to 262,144 bytes per file, still enforces its 524,288-byte encoded response limit,
and reads the contract from a managed connector.

A separate cross-project check found a handoff problem. Doctor and status targeted the requested
project, but setup and `start` showed relative skill paths from the current working directory
when `--project` selected another project. Handoffs now use absolute paths in that case. An
installed two-project end-to-end check confirms doctor and status target the selected project,
both handoffs name its absolute skill path, and uninstall removes only that project.

The end-to-end artifact now includes one-route checks for all 38 declared first intents, the
growth request and paraphrases, explicit multi-method selection, unrelated and CI coding
abstention, first-task hook context, cross-project ownership, and managed MCP listing and read.
These checks cover the installed CLI and local protocol. They do not establish live delivery by
another native host, independent specialist contexts, provider access, or a human verdict.

### Wider product and onboarding repairs

The independent review confirmed that a cross-project handoff could still print bare management
commands. Every printed doctor, update, and uninstall command now carries the selected absolute
operator path. An installed two-project check executes the printed doctor from project A and
confirms it inspected project B. A malformed profile presented as a FIFO no longer blocks
`start`; onboarding uses the same bounded, non-symlink profile loader as request admission. The
runtime playbook help now names `conquistador runtime route --intent`, which is the public
dispatcher path. The tool tests retain minimal-source CLI coverage for this shared loader.

The selector now keeps the source of each match: normalized method name, declared intent, channel
lock, or inference. It demotes only the broad `what should we do` shaping intent when another
method is present. It preserves explicit shaping, compound method names, compound declared
intents, and negated or quoted scope. Technical pipeline failures abstain. A source audit of all
191 declared intents found each owning method; the Vietnamese landing-page rewrite also selected
`write-copy`, which is a documented composition rather than a missing owner. Installed adversarial
routes cover CI and data pipelines, explicit method sequences, negation, quotations, pricing,
knowledge freshness, technical documentation, and campaign-related growth diagnosis.

A returning user now gets a first-task chooser in the interactive terminal. New and returning
users can describe another task beyond the four starter prompts; the handoff prints its prompt,
a local route preview, host ownership, manual or configured activation, trace-read check, and target-qualified recovery
commands. A real terminal run chose a custom pricing-and-packaging task after an installed Codex
operator was detected. The corresponding installed CLI route selected
`design-pricing-and-packaging`. A first-run terminal task about knowledge freshness also completed
installation; its natural phrase is now a declared `knowledge-review` intent. Setup did not launch
a model or confirm native discovery.

### Final review repairs

The final independent review found three remaining defects. A compound method name or declared
intent beside a negated task could disappear because one pass split at "and" and a second pass
dropped the combined clause. The selector now protects declared compound phrases during one
clause parse. Installed CLI and hook checks retain the requested pricing, knowledge-review, and
technical-docs methods while excluding `write-copy`; a wholly negated compound request abstains.

A technical request containing "why" or "explain" could enable growth inference from nearby
signup or stall words. The selector now requires an explicit business diagnosis in a nontechnical
clause before inferring growth inside a coding task, and it keeps technical clauses out of that
inference. Three technical explanations abstain through the installed CLI and hook; a mixed
explicit business diagnosis still selects `diagnose-growth`.

The returning-user stale-installation notice printed an unqualified update command. It now
prints a shell-quoted `--path` for the selected operator. The two-project installed check executes
that printed command from project A, updates project B, and confirms A's receipt is unchanged.
These are local CLI and hook observations, not proof of native host event delivery or useful model
output across the library.
The changed-line lint pass also removed an unused host import. The remaining control-character
regex warning is intentional: the TUI rejects nonprintable text before generating a first-task
handoff.

A later installed adversarial review found that a literal parser marker could restore a negated
pricing method, an inspection phrase could hide an explicitly named creative or conversion
method, and plural "signup tests" could infer a growth problem. Clause parsing now protects
compound phrases by their positions in the original request, with no text marker to collide
with user input. An explicit method name survives an inspection phrase, while inferred creation
still yields to inspection. Singular and plural technical nouns use one shared guard. The
installed end-to-end check covers all three failures and positive business-diagnosis controls.

A second live Codex CLI task used a freshly installed native skill to plan a one-week beta
campaign, draft one launch email, and specify growth measurement from supplied facts. The trace
recorded successful full reads of the parent method, `plan-campaign`, `write-copy`,
`measure-growth`, all declared required resources for those three methods, and the
`launch-product` composition workflow. Twelve successful `cat` outputs matched replays byte for
byte; the initial false path flags came from a trace parser that did not expand shell braces.
The model returned drafts with no invented conversion figures and disclosed same-context review;
no independent specialists, send, spend, or tracking mutation occurred. This is one capable-host
observation, not semantic acceptance of every method or another host.

The bounded root anti-slop command still reports inherited violations. Its diagnostics on authored
new lines are zero after cleanup; the remaining 253 diagnostics are outside the changed lines.
The root does not yet have a clean repository-wide lint gate. A final-source Node 24 build and
full suite passed: 240 host/tooling, 294 runtime, 167 catalog, and 63 evaluation checks (764
total). The installed end-to-end artifact includes the adversarial routes and copied doctor
execution. Host acceptance and private acquisition remain later gates.

## Private-alpha 0.0.9 shipped

Conquistador can now route an ordinary submitted prompt against the methods that are actually
installed. The deterministic selector reads existing method metadata, capability labels, domain
restrictions, workflows, specialist roles, and contained resources. It injects a bounded context
with at most three methods, one matching composition workflow, one role, short purpose excerpts,
the installed package root, and exact contained paths. The parent is told to read the complete
selected files and use relevant host tools, connections, and isolated specialist contexts. It
abstains on unrelated coding, vague prompts, exclusions, routing-metadata requests, invalid input,
an operator profile set to `off`, and omitted domain capabilities. It does not echo the submitted
prompt, scan project artifacts, call a model or network, execute work, or grant external authority.

The existing optional mode now connects `UserPromptSubmit` as `prompt-submitted` for both Codex and
Claude Code. It owns only its handlers in `.codex/hooks.json` or
`.claude/settings.local.json`, preserves unrelated settings, and supports status, disable, removal,
bounded input, and Stop recursion protection. Installation remains inactive until the operator
enables the selected events. Codex additionally requires the user to review the project and exact
hook definition in its trust flow. Compact skill, plugin, and operator packages include the selector
and its loader dependencies. The parent and compact entry contracts now tell the agent how to use
injected context without claiming a specialist ran.

An Astra design review recommended the bounded metadata selector, short excerpts plus exact paths,
domain-aware abstention, and direct `UserPromptSubmit` integration. A live read-only smoke test with
Codex CLI 0.154.0 and GPT-6 Astra then staged a complete operator in a temporary trusted project.
After Codex's project and hook review, a normal copy request caused the agent to read the staged
parent, selected `write-copy` method, and method resources. Its final response reproduced a synthetic
marker available only in the hook-injected excerpt. Temporary trust records and the test project
were removed afterward. This observes one Codex path; it does not prove Claude activation, broad
routing quality, or human acceptance.

Validation passed on macOS ARM64 with Node 24.21.0:

- `npm run build` completed after the worktree's locked dependencies were bootstrapped.
- `npm test` passed all 711 checks: 187 host/tooling, 294 runtime, 167 catalog, and 63 evaluation
  tests.
- The focused selector, proactive helper, host-mode, and staged-install run passed all 33 checks.

The user authorized this private-alpha shipment. Version 0.0.9 shipped through
[PR #4](https://github.com/forsvn-labs/conquistador/pull/4) as a private prerelease from exact
source `60d487476fa504f3473ba3a1429228ca569219d8`; the immutable v0.0.8 release remains unchanged.
The Node 24 build and all 711 product checks passed locally. Exact source passed Linux CI in
[run 35305874820](https://github.com/forsvn-labs/conquistador/actions/runs/35305874820). Both
optional integration legs passed after the existing Eve fixture was corrected to use a portable
real temp directory; its 13 tests, native build, and high-severity dependency audit passed.

The clean source commit produced ZIP
`f699c43734c40c4039a92bbc217fc50c87f64535f2928b0f88c038febf37868c` and npm tarball
`0e51a4f654bbeb3acfe861d074b2f0c89b14720c0d50865c2fbdc8593a96a299`. Fresh release downloads
matched both files, `SHA256SUMS`, and `assembly.json` byte for byte. The authenticated private-Git
`v0.0.9` path installed a durable CLI, survived acquisition-cache removal, reported version 0.0.9,
passed the 38-method doctor, and completed install, start, update, and uninstall while preserving
the receiving project's sentinel.

Claude Code activation, native Windows activation, broad routing quality, and human acceptance
remain separate from these file, host, and lifecycle checks.

## Private-alpha 0.0.8 shipped

The guide now accepts several compatible integrations and host choices. Space toggles choices;
Enter continues. Complete operator and native skill installation remain the default. Codex and
BB have separate entries. Codex receives its native project skill; BB records explicit operator
use and prints project/environment and team-adapter instructions without registering a BB plugin,
provider skill or request router.

Implemented in this checkout:

- Multiple native skills share the operator's transaction and update/removal owner. `--hosts`
  permits explicit additive changes; `--host`, default Codex behavior and legacy v1 records remain
  supported. Standalone commands cannot separately change an operator-owned native copy.
- Operator plus harness reuses one contract. Several plugin managers share one staged source and
  receive separate activation/update instructions. Each manager still owns its activated copy.
- Local MCP, runtime MCP, squads and explicit specialists keep separate receipts and lifecycle
  commands. Experimental selections remain guidance only. A local choice cannot silently update
  an existing runtime connector. Domain-restricted operators cannot add full-library local MCP in
  the guide.
- Read-only preflight checks all destinations before confirmation. Overlapping paths, duplicate
  native skill/plugin choices, invalid methods, unsafe runtime sources and unowned/modified files
  fail before applying the plan. Later filesystem failures can leave earlier independent copies
  installed; the guide lists completed copies and their recovery commands. Operator/native
  replacements still roll back together, including newly added hosts.
- The bundled Clack interface now includes multi-select. README, installation architecture,
  mechanism guide and host instructions describe the distinct owners and next steps.

Validation passed on macOS ARM64 with Node 24.21.0 and npm 11.19.0:

- `npm run build` and `npm test`: 703 tests, comprising 179 host/tooling, 294 runtime, 167 catalog
  and 63 evaluation tests. An earlier run caught a stale assertion about MCP explanatory text;
  the final full run passed after it was aligned with the separate local/runtime instructions.
- A real mixed guide plan created `.conquistador`, Codex and Cursor skill copies, one staged
  plugin source for Claude and Copilot, and separate local/runtime MCP connector folders. The
  harness reused the operator contract. Removing the operator left the independent integrations
  intact; each then removed through its own lifecycle. The receiving-project sentinel survived.
- Native macOS PTY checks passed for Space-to-toggle, Codex plus BB, skill-only Codex plus Cursor,
  confirmation, install/check completion and cancellation. Skill-only setup created no operator.
  These checks exercised terminal input and real local files, not native host activation.
- Domain-restricted legacy migration and added hosts preserve the same allowed subset. Failed
  native replacement restores prior bytes. Linked, modified and independently owned files remain
  protected, including dangling native links. Old v1 records without `hosts` still load.

The user authorized the next private-alpha shipment. Version 0.0.8 shipped as a private prerelease
from exact source `5e31b7c0f87a22018db50b8f52a1df454534bd06`; the immutable v0.0.7 release remains unchanged.
The Node 24 build and all 703 tests passed locally. Exact source passed Linux CI in
[run 35210717495](https://github.com/forsvn-labs/conquistador/actions/runs/35210717495).

The clean source commit produced ZIP
`b265144852bea4d30910316a3f21e683c919c07ba6724164e28c67758eb64087` and npm tarball
`4939bf42ed9341470182c9c7771dc6dde75f3e9abe4e4918a14b342d96c76240`. Fresh release downloads
matched both files, `SHA256SUMS`, and `assembly.json` byte for byte. ZIP and tarball multi-host
lifecycles produced the same operator digest, survived npm acquisition-cache removal, and preserved
receiving-project files after uninstall. The authenticated private-Git `v0.0.8` path also passed
version, 38-method doctor, install, start, update and uninstall after cache removal.

Native host activation and task quality remain separate from these file and lifecycle checks.
Cursor scans other compatible skill directories as well as `.cursor/skills`; duplicate-name
precedence across selected native directories still needs fresh Cursor acceptance.

## Private-alpha 0.0.7 shipped

Private alpha 0.0.6 shipped from `40a9b7b3f635d17e9c0e79ec8b83884afcb10650` after its exact
Linux CI run passed. The release assets reproduced from committed source and their downloaded
checksums matched. A post-release test then exercised the README's advertised global private-Git
command rather than the previously tested tarball-backed persistent CLI.

npm 11.19.0 reported success for the original command but linked the installed package to its
temporary Git checkout. The resulting `conquistador` executable was dangling. Both GitHub shorthand
and `git+https` reproduced the failure from neutral projects and isolated prefixes. The missing
`--install-links` flag was a release-path defect; the `.conquistador` implementation and release
artifacts were intact.

The 0.0.7 release:

- makes `npm install -g --ignore-scripts --install-links git+https://...#v0.0.7` the primary command;
- explains why private-Git global installs need a durable copy and keeps `--ignore-scripts`;
- documents uninstall-then-reinstall recovery because npm could not replace an existing dangling
  v0.0.6 link in place;
- adds `verify:private-git`, an authenticated release check that installs from the actual Git tag in
  a neutral project and isolated prefix/cache, verifies the executable resolves inside the prefix,
  deletes acquisition cache, then runs version, install, doctor, start, update and uninstall;
- keeps the npx fallback explicit and leaves tarball acquisition as a separate verified path.

Observed verification on macOS ARM64, Node 24.21.0 and npm 11.19.0:

- The Node 24 build and all 693 tests passed after the version, completeness manifest, documentation,
  migration, and authenticated release-check changes.
- A fresh corrected v0.0.6 global Git install stayed executable after its acquisition cache was
  removed. It exposed `.conquistador/SKILL.md` and the Codex native skill, passed doctor with all 38
  methods, ran start/update/uninstall, and preserved the receiving project's sentinel file.
- Reinstalling directly over a dangling v0.0.6 link failed with npm `ENOTDIR`. Global uninstall then
  corrected reinstall repaired it; the same cache-deletion and lifecycle checks passed.
- `tools/verify-private-git-install.mjs` independently passed against both immutable v0.0.6 and
  v0.0.7 tags with cache removal before the lifecycle. Exact v0.0.7 source
  `e1bb066eaaab05022c12129ab2f06ba679b55ce8` passed Linux CI
  [run 35196396669](https://github.com/forsvn-labs/conquistador/actions/runs/35196396669).
- Freshly downloaded v0.0.7 assets matched their release checksums: ZIP
  `cb4fc7ebb334503d22c81f5c808c4d13ee30bd1524888ab1f7b8a717f59471f8` and npm tarball
  `383d5b2869ad84a681d7909a5ff568d1e6726c52daef957a456ef48d87250fc7`.
- The explicit npx fallback also launched version 0.0.6 from an empty cache. The durable global
  install remains recommended because repeated private-Git acquisition took about 16–27 seconds.

Astra's focused review recommended this bounded patch. It rejects postinstall or CLI self-repair as
the primary fix because a dangling executable cannot run its own diagnostic. Native-host expansion
and the optional GBrain learning backend remain separate work.

The final handoff audit found no executable change waiting to ship. It began from the release
shipping record `ebdd951`; the v0.0.7 tag remains `e1bb066e`, both release CI runs are green, and the
four downloaded assets match their recorded hashes. A fresh Node 24 build and all 693 tests passed.
Current branch changes after the tag are shipping, audit, and cleanup records only.

After an all-ref recovery bundle and separate archives for ignored Eve and operator artifacts, BB
destroyed nine stale linked worktree environments. Twelve stale local branch refs were removed.
The canonical checkout, `private-alpha`, historical `dogfood/0.1.0`, all tags, remote branches,
release assets, and thread evidence remain preserved.

## Private-alpha 0.0.6 implementation and release evidence

The 0.0.5 artifacts were shipped, but its default setup left users with an adapter folder,
no native skill entry, a long package command and unclear next steps. Its file-integrity checks
did not establish a usable first-task experience. The installation regression is recorded for
tracking; its live issue creation is pending confirmation.

Shipped privately in v0.0.6:

- The complete operator uses `.conquistador/SKILL.md` and `library/`. BB adapter, profile,
  contracts, schemas, all 38 methods and their resources remain available.
- Guided setup uses bundled Clack prompts with route/host choices, confirmation, progress and
  a concrete first task. The configured native skill is included in the owned project lifecycle.
- Bare `conquistador` opens setup. `start` repeats the first task; `skills` lists capabilities.
  The recommended persistent CLI acquires once, avoiding repeated Git resolution on launch.
- Paired operator/skill updates stage before replacement. Modified, unowned or linked content
  is refused. Existing unchanged managed skills can be explicitly adopted. Updates preserve
  domains; legacy `.conquistador-operator` migrates through the project update command.
- Existing runtime state is preserved. New run data uses `.conquistador-runs`; existing unmanaged
  `.conquistador/runs` stays the runtime default until deliberately moved.

Validation for final implementation `5d6d921` passed on macOS ARM64 with Node 24.21.0 and npm 11.19.0:

- Build and all 692 tests. Fourteen focused ownership/migration/guide checks and thirteen
  install/guide checks passed. A later lifecycle review added a low-level paired-install guard;
  its 19 focused tests and the repeated build plus complete 692-test suite passed.
- Five complete transports passed 45 startup/lifecycle commands with identical operator and
  native-skill digests. Source archive, ZIP, npm tarball, Bun tarball and a persistent npm CLI
  preserved the receiving project and removed both owned copies.
- Actual v0.0.5 plain and domain-restricted installations migrated. Modified legacy files were
  refused. Domain migration preserved the same restriction and omitted disallowed methods.
- Fresh native Codex CLI 0.154.0 discovered the installed skill in its available-skills list,
  invoked it by name without a supplied path, selected Write product or campaign copy, and
  returned a factual synthetic draft with a same-context review receipt. This passed on both
  `9392be7` and `5d6d921`; the final source's task took 95.19 seconds, including model work.
  After the first installation's removal, a separate fresh session reported the skill absent.
  Final-source removal also restored the receiving project. These are two observed Codex tasks,
  not general method quality, another host's acceptance, or a human verdict.
- Exact-commit macOS terminal cancellation and installation passed. The first prompt appeared
  in 0.047–0.056 seconds; the automated route/host/confirmation install/check flow took 1.827 seconds.
- Cold v0.0.5 private Git npx acquisition plus help took 27.097 seconds. A cold local 0.0.6 tarball
  npx invocation took 2.991 seconds; these are different acquisition paths. The persistent CLI
  setup-help median was 0.039 seconds across seven local launches. The recommendation avoids
  repeated acquisition, not the initial network cost.

All five final-source transports produced operator digest
`e6a80c81a6e5d68c7275c1c589441957af5de3a438d4c2c77747b308743b4ab0` and native-skill digest
`d3e418186861f58f5c54668a10826f66c7c9054534e96e67ffda7962475c6880`.
The exact ZIP and npm tarball contain the bundled TUI and no node_modules or esbuild binary.
The guide needs no npm bootstrap in source/ZIP installs. Packages remain local, UNBOUND and
unpublished. Build and suite commands were `npm run build` and `npm test` under Node 24;
exact packaging used `node tools/package.mjs` with an external evidence destination.

Final implementation `5d6d921` archive checksums:

- `conquistador-0.0.6.zip`: `d5959778f6ed77597d6dee29f4b861a6b8fa27b3ee3b269ed110ecda093401d6`.
- `forsvn-conquistador-0.0.6.tgz`: `6ac85688f7eee24eba29cd8ac39f0491a3c4807bf9b21e908d19b23f4670b690`.

The following evidence-only commit updated this progress and the roadmap. Its separately packaged
archives have their own checksums; execution evidence above remains bound to `5d6d921`.
Native Claude/Cursor/Copilot and native Windows/Linux remain unverified. The source shipped
privately within those stated limits.

The 0.0.6 release did not close human acceptance of the previous BB team run.
