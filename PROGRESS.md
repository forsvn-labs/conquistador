# Implementation status

Conquistador is in private dogfood. The shipped prerelease is
[`v0.1.0-dogfood.4`](https://github.com/forsvn-labs/conquistador/releases/tag/v0.1.0-dogfood.4),
from `45a3d276874b30e884fb5e603b289e0c58a286f8` on `dogfood/0.1.0`. Product version is 0.1.0;
the parent method is 2.9.0 on current source. The root npm package remains `private: true`. CI builds and tests with
read-only repository permissions; public distribution is deferred. ZIP, npm tarball, checksums, and
`assembly.json` bind that exact source (`authority: UNBOUND`). Installing a new package does not
update existing copies. Earlier dogfood prereleases retain their original source identity.

## Installation and first use

The pinned repository-root skills.sh command is the one default. It already copies the complete
library. README and INSTALL put prerequisites and traps beside the command, followed by a first
task, checks, recovery, and alternatives. The usage, dogfood, integration, mode, and capability
guides follow the same sequence: use supplied context, reuse permitted connections, and set up
Executor when missing live access blocks the task. Plugins, MCP, CLI repair, Eve, and the runtime
remain optional. This rewrite changes guidance, not host execution behavior.

`conquistador setup doctor --path ABS [--json]` checks full root, compact, plugin, and harness
copies against `release/completeness.json`. The manifest names all 38 outcomes, parent version
2.9.0, and all supporting resources, including specialist, operator-profile, and setup contracts, with content hashes.
The report separates library completeness, managed receipt integrity and version, available Git
identity and cleanliness, and BB adapter presence. Compact copies use `library/` and omit the
adapter; plugin and harness copies include it.

Managed MCP diagnostics check the saved Node executable and package script separately from the
receipt digest, then inspect the library at the resolved script path. A moved source, pruned npm
cache, or removed Node executable fails even if the connector digest is intact. The doctor changes
no files, executes no saved paths, and contacts no service.

Success reports "38 methods available; local files verified; host activation and task execution
unverified." It does not claim all methods are loaded into model context. A copy without Git has
an unknown source commit. Domain-restricted and standalone packages do not pass the full-library
check. Copies without a manifest use the doctor's release baseline with an explicit notice;
older releases need a newer complete distribution to supply the doctor.

The implementation passed the Node 24 build and all 620 default tests: 99 tooling, 291 runtime,
167 catalog, and 63 Eval Lab. Fourteen doctor/manifest tests cover missing methods and resources,
compact/plugin/harness copies, changed receipts, stale MCP paths, cross-bundle executable symlinks,
and Git index preservation. Catalog validation and the explicitly synthetic local example passed.
A source doctor run found all 38 methods and reported pending source edits. No native host,
model task, or provider connection was exercised for this installation work.

The documentation rewrite passed 41 focused install/doctor tests and the full 620-test product
suite on Node 24. Catalog validation and the synthetic example also passed. Checks covered 107
local links and anchors, links inside staged packages, the pinned default commands, adjacent
prerequisites and traps, and first-task ordering. A direct source doctor run again reported all
38 methods available and the pending documentation edits. No live host or provider check was run.

## Operator experience on dogfood/0.1.0

Current source on `bb/implement-conquistador-operator-experience-with-thr_dx5zj6re7b` starts from
`d2fc898d6736e5ad8517296007bb6f866e2d62d2`. It adds `conquistador.operator-profile/v1`, optional
specialist presentation, `conquistador.execution-receipt/v1`, BB brief/receipt integration, and
one targeted correction after an exact-artifact `revise` verdict. Installed activation stays
`manual`. `backgroundWatch` stays false. Draft-only runs keep `externalActions: []` and
`humanAccepted: false`.

Node 24.21.0 passed `npm run bootstrap`, `npm run build`, and `npm test`: 118 tooling, 292 runtime,
167 catalog, and 63 Eval Lab tests (640 total). Catalog check reported 17 valid operations. The
synthetic local example reported `proofClass: synthetic-local-contract-example`,
`executionAuthorized: false`, `liveExecutions: 0`, `humanVerdicts: 0`. Completeness hashes matched
parent 2.9.0 (`sha256:ee2613ace4beea2aa94fd0ebaf2b35a4b628842d7a98c9da5a05f9926cfa8ec1`) and 1096
required resources, including `conquistador/operator-profile.json`.

A fresh temporary harness install/status/update/remove cycle reported 38 methods available, operator
profile present (`activation manual`), BB adapter present, and `hostActivationVerified: false`.
A compact skill cycle reported the operator profile present and the BB adapter absent. Doctor does
not prove routing or task execution. `plugin-contracts` reported `hostActivationVerified: false`.
A checkout package-boundary scan checked 1580 files with 0 private fingerprints
(`semanticReviewRequired: true` for this private package). A changed-file secret and private-path
scan found no matches.

Follow-up commit `c318bf09f17b1e2a66f85a93a3923ffa82f3277f` records observed integration, review,
and correction children on receipts and reports overall blocked state instead of a sibling draft.
That change passed Node 24.21.0 `npm run build` and `npm test`: 119 tooling, 292 runtime, 167
catalog, and 63 Eval Lab tests (641 total).

Two live BB acceptance attempts ran from parent `thr_dx5zj6re7b` in `env_e7raxthku8`. They do not
complete FOR-247 or FOR-248 host acceptance.

Attempt 1, from `999087e79af24f9d612abbd9e81efdcc8cd86073`: Copy child `thr_fgygkuh6k5`
(`Conquistador: Copy`) finished a draft JSON result. Integration child `thr_kx2g4ms545`
(`Conquistador: Integration`) received `system/thread/interrupted` with `reason: "manual-stop"`
and produced no output. No review child and no execution receipt were observed.

Attempt 2, after `c318bf0`: Copy child `thr_ir5866swws` (`Conquistador: Copy`) finished a draft
JSON result. Campaign data child `thr_jw4jrhu9ar` (`Conquistador: Campaign data`) received
`system/thread/interrupted` with `reason: "manual-stop"` and produced no final output. No
integration child, review child, integrated digest, or execution receipt were observed.

Public child titles and one specialist output per attempt were observed. Those children were later
idle. That is not claimed as coordinator cleanup, digest-bound review, a targeted correction, or
human acceptance. Protocol tests cover briefs, receipts, redaction, digest mismatch, cancellation,
and the one-pass correction limit; they are not a host, provider, or human result. No push, merge,
publish, Linear mutation, or FORSVN planning edit is included.



## Available product behavior

| Area | Available behavior and limit |
| --- | --- |
| Task entry | One parent selects from 38 outcome methods for growth, GTM, sales, marketing, and product knowledge work; the host supplies the model and tools. Operator activation defaults to manual; project routing is an explicit host setting |
| Installations | Root skills, compact managed skills, plugins, and host packages; local file preparation does not establish host activation |
| Local MCP | Lists and reads bundled methods over stdio without runtime dependencies, a model account, or an HTTP service |
| Specialists | Seven role contracts, public roster labels, a callable BB adapter, engagement brief, execution receipt, exact-artifact review with one correction pass, and a same-context fallback; v2 master metadata retains v1 compatibility |
| Existing stack | Host-owned route selection and bounded reads; the catalog requires exact audited operations |
| Executor help | `connections setup` and `status` detect a CLI and print official next steps; configuration, UI handoff, discovery, and provider execution are separate |
| Optional Eve | A canonical app with explicit owner/session commands and separate worker/operator authority; preparation does not submit a model job |
| Optional runtime | Four declared playbooks with saved state, draft artifacts, failure/resume behavior, and separate review/action authority |
| Preview | Host procedures for Lavish AXI previews and annotations; no automatic annotation consumer |
| Proactive advice | Opt-in helper and Claude hook lifecycle; native delivery remains unverified |
| Memory and feedback | Explicit host-file memory and redacted feedback drafts; no automatic learning promotion, cross-run retrieval, or global learning |

Use [INSTALL.md](INSTALL.md), [usage](docs/USAGE.md), [capabilities](docs/SERVICES.md),
[execution modes](docs/MASTER-AGENT.md), and [integrations](docs/INTEGRATIONS.md) for commands and
limits. Build and package commands belong to a complete distribution under
[CONTRIBUTING.md](CONTRIBUTING.md). Outputs, private notes, and runtime state stay outside the
installed product. Run artifacts and audit state can still persist when automatic learning is off.

## Earlier recorded verification

These observations retain their original build and task scope. They were not repeated for the
documentation rewrite and do not establish native activation of the current installation.

### Executor and Eve adoption

Node 24.21.0 on macOS arm64 passed the integrated build and 606 default tests, catalog validation,
and the synthetic local example. The dogfood.3 follow-up also recorded 27 Executor host tests.
The preceding adoption work recorded:

- Executor frozen installation, syntax checks, 22 client tests, and a dependency audit. A local
  Executor 1.6.8 process authenticated the client and exposed seven MCP tools. No tool or provider
  was invoked; the process stopped and temporary state was removed. The adoption client's exact
  GitHub callback still lacks a reviewed live binding.
- Eve frozen installation, typecheck, 13 source tests, native build, and dependency audit. A prepared
  app passed installation, typecheck, ten tests, and build. Its HTTP endpoints accepted synthetic
  caller/operator credentials, denied unauthenticated access and caller approvals, and rejected
  unknown-session sends without creating replacements. No model job ran; the process stopped.
- Origin checks that prevented credential transmission to missing or mismatched destinations.
  Twenty-four negative cases made zero fetch calls; valid bound calls reached the local HTTP
  endpoint. Credential rotation invalidates old gateway bindings; Eve rejects configuration changes
  during a turn.
- A read-only npm release check on 2026-09-16. Eve 0.55.0, Executor 1.6.8, MCP SDK 1.30.0,
  AI SDK 7.0.102, and just-bash 3.4.2 matched the reported latest releases then. New TypeScript and
  Node type majors were flagged for review; the tested TypeScript 5.9.3 and Node 24 pins remained.

Exact pins and Bun lockfiles support reviewed upgrades. `integrations status` reads local records;
`check-updates` queries public npm metadata without changing dependencies. The daily release watch
requires default-branch activation. Optional Actions jobs were not run on this local branch.
These checks do not establish Linux support for the optional hosts, provider access, model quality,
or durable crash recovery.

### Specialist execution and installation

Earlier master-agent work observed two specialist contexts, integration, and separate exact-artifact
review in BB. An earlier run requested revision; a later four-context run passed draft review.
A separate same-context run reported independent review false. One bounded public repository
metadata read succeeded through an Executor-bound Connection in candidate-verification mode.
These observations do not grant human acceptance, general output quality, sandboxed tools, or
maintained provider support.

The implementation review rechecked cancellation cleanup, child ownership, uncertain spawn outcomes,
and exact connection binding. That stage passed 595 default tests on Node 24.12.0, including
orchestration, stack, and graph checks, plus the 17-operation catalog check and synthetic example.
Graph tests preserved missing image, vision, and data connections as gaps.

Dogfood.2 recorded real private Git skills install/reinstall/list/remove and npm setup install/remove
in temporary projects. Spawned local MCP processes listed all 39 entries and passed contained reads,
protocol negotiation, and path refusal checks without runtime dependencies. Exact archive checks
and Linux CI passed. The release recorded 544 default tests. These were installer and protocol
checks, not native host activation or useful model execution.

Earlier guided setup checks exercised install/status/update/uninstall in a terminal, all 39 method
roots, and setup without runtime dependencies. Staged usage-guide checks cover all seven installer
mode families, contained links, and protection of edited guides. Earlier Lavish launcher checks
did not establish human annotation or useful model output.

### Optional hooks and domain restrictions

The Claude adapter registers SessionStart and Stop only. It removes owned legacy TaskCompleted
registrations and preserves unrelated hooks. Invalid or incomplete input suppresses advice;
configuration errors produce a redacted diagnostic and cannot block completion. The official event
reference was checked through web access, but verification through Executor and native delivery
remain unobserved. That review recorded a Node 24.19.0 build, 599 default tests, catalog validation,
the synthetic example, and a private-fingerprint scan with no matches.

The callable coordinator checks domain restrictions before loading or dispatching. Compact copies
filter staged methods but rely on the consuming host to enforce access. Domain MCP is unsupported.

## Remaining work

1. Complete a live BB operator-package run with at least two visible specialist children, one
   integration child, one exact-digest review, a receipt bound to the integrated digest, and
   observed cleanup. Two attempts from this worktree observed public titles and one Copy draft
   each; both stopped on a manual-stop before review and receipt (`thr_kx2g4ms545`,
   `thr_jw4jrhu9ar`). Protocol tests still do not substitute for that host result. Use the
   [dogfood checklist](docs/DOGFOOD.md).
2. Polish Executor setup and resumption with an authorized account operation. Observe permission,
   cancellation, and recovery behavior. Eve additionally needs an operator-owned service, selected
   model and budget, and a useful job.
3. Complete update identity and repair across source, package cache, Node, and host changes. Copies
   without Git still lack exact source identity; no full update-identity migration is implemented.
4. Verify optional native hooks, previews, domain enforcement, and connected model/vision/data
   paths only where needed. Ambiguous runtime dispatch pauses without automatic replay; a supported
   reconciliation API remains absent.

Human acceptance, rights disposition, and public release authority remain separate. Imported action
receipts are operator attestations unless observed evidence supports them. Automatic learning
promotion stays disabled; a separate persistence-consent API and cross-run retrieval are absent.
Keep public feedback sending and public distribution deferred during private dogfood.
