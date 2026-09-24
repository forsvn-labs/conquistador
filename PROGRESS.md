# Product progress

The 0.0.11 hardening work has shipped. The growth-diagnosis and first-run changes below are a
local candidate. An independent review identified routing, handoff, profile-reading, and help
defects; local follow-up repairs are under verification. They have not been pushed or released. See
[CHANGELOG.md](CHANGELOG.md) for verified delivery and [ROADMAP.md](ROADMAP.md) for remaining
native-host and human acceptance work.

Current private delivery:
[`v0.0.11`](https://github.com/forsvn-labs/conquistador/releases/tag/v0.0.11) from
`3e9f07be8e825b0057225f1172745a2c21bd535e` through
[PR #6](https://github.com/forsvn-labs/conquistador/pull/6).

## Local growth-diagnosis and first-run candidate

The installed 0.0.11 route selected `shape-initiative` for a synthetic growth-stall prompt with
flat visits, falling trials and upgrades, and a broad "what should we do next" question. Adding
"Diagnose growth" selected the intended method. A fresh Codex CLI 0.155.1 session with GPT-6
Astra read the full installed `diagnose-growth` method and required resources and produced a
bounded analysis. This supports a routing repair; the original captain prompt and host trace
remain unavailable, so the historical answer cannot be attributed to one cause.

This candidate routes adverse growth-metric changes to `diagnose-growth` and drops incidental
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
The local candidate restores the pinned plugin, adds a source configuration, and records the
bundled source digest in `tools/oxlint/anti-slop/UPSTREAM.md`. The plugin runs; its readable-spacing
rule reports a large pre-existing baseline in touched files, so this candidate does not claim a
clean anti-slop lint gate. Build and full product-test results are recorded after verification.

### Independent review repairs, still local

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

### Wider product and onboarding repairs, still local

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

### Final review repairs, still local

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
