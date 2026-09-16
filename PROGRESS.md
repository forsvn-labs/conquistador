# Implementation status

The operator implementation and this independent review are unshipped. The proposed next private
channel is `private-alpha`; no channel branch, tag, version, release, push, or publication was made.
Product version remains 0.1.0 and parent method version remains 2.9.0. The npm private guard remains
true. Historical ships are recorded only in [CHANGELOG.md](CHANGELOG.md).

The default private-alpha install now uses the existing `conquistador` package executable
through `npm exec` and the private Git reference. This path installs the operator without adding a
dependency, `node_modules`, or a lockfile to the receiving project. The supplied npm tarball also
completed install, doctor, and uninstall through npm and Bun package runners in fresh projects.
The current dogfood Git package ran setup help through npm on Node 24.21.0. The unshipped operator
cannot be fetched from private Git until its channel exists. Bun 1.3.14 could execute the local
tarball, but its HTTPS Git form requested an unauthenticated GitHub API tarball and received 404.
The documentation therefore does not claim private Git Bun support. Source and ZIP remain recovery
paths. No curl-to-shell installer was added.

This review covers every changed file in `d2fc898..84f0008`, the complete 41-file operator diff on
`bb/implement-conquistador-operator-experience-with-thr_dx5zj6re7b`. It also audits the source and
installation paths those changes depend on. All work stays in the product worktree. The product
registry identifies Conquistador and PROGRESS.md as its handoff; no FORSVN workspace files were edited.

## Implemented and reviewed

- Request-time admission uses the manual/project/off operator profile. It starts no polling,
  daemon, background transcript collection, instruction-file edit, or external operation. Setup
  does not register the router in a host. Invalid overrides disable admission; ambiguous coding
  requests abstain. Missing old profiles default to manual; malformed profiles fail closed.
- Public role titles, engagement briefs, and execution receipts accompany explicit BB teams.
  Raw goals, knowledge, method text, prompts, model evidence and gaps stay out of the public receipt.
  Optional presentation text is caller-approved public input. Pattern checks cannot identify
  arbitrary confidential prose; the receipt contains fixed summaries and counts of observed results.
- Receipts retain specialist, integration, initial review, correction, and final-review rows. Each
  review retains its own exact digest. Blocked dependencies record not-run rows; same-context runs
  retain independentReview false. A receipt does not audit host tools, verify sources, or record
  human acceptance. The private result file retains substantive findings for the operator.
- The coordinator permits one targeted correction and one final re-review. It refuses digest
  mismatch and isolated context reuse. Accepted/ambiguous dispatches cannot retry, even when a host
  incorrectly sets preDispatch after reporting a dispatch. A second revise result remains unresolved.
- The team CLI reserves its private output before dispatch and emits a fixed failure diagnostic.
  It cannot run a team and then discover that its output file already exists.
- Managed setup adds --target operator --project ABS at PROJECT/.conquistador-operator. The harness
  target with --path remains compatible. The package includes the v1 compatibility agent, v2 master,
  operator and receipt schemas, methods and adapter. Doctor uses the same profile validator as the
  router and checks the complete operator executable inventory plus the rewritten master contract.
- README, INSTALL, reference guides, entry points, lifecycle help and CI name private-alpha as the
  proposed channel. The current acceptance checklist is docs/PRIVATE-ALPHA.md; docs/DOGFOOD.md remains
  a working historical redirect. Local source/ZIP installation is usable before a channel exists.
  Removal requires host detachment; uninstall does not promise to stop agents or delete host settings.
- Unshipped operator material was removed from CHANGELOG. VISION contains stable boundaries;
  ROADMAP contains remaining acceptance and distribution work. No historical shipped entry changed.

## Recorded operator evidence before this review

The implementation recorded 640 default tests on 999087e and 641 on c318bf0, on Node 24.21.0.
Those results were local contracts. They did not prove host activation or useful output.

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

## Independent review validation

No live host or provider task ran in this review. FOR-247 and FOR-248 remain
open; their remaining acceptance work is in ROADMAP.md.


Commands ran on macOS arm64 with Node v24.21.0 and npm 11.19.0. The shell used:

```sh
export PATH=/opt/homebrew/opt/node@24/bin:$PATH
export npm_config_cache=/private/tmp/conquistador-review-npm-cache
npm run bootstrap
npm run build
npm test
node --test tools/install.test.mjs tools/setup.test.mjs tools/setup-entry.test.mjs tools/installation-doctor.test.mjs hosts/coding-agent/operator.test.mjs hosts/coding-agent/operator-experience.test.mjs hosts/coding-agent/orchestrate.test.mjs
npm --prefix runtime exec -- vitest run tests/agent-packages.test.ts
node tools/plugin-contracts.mjs .
node tools/setup.mjs doctor --path "$PWD" --json
git diff --check
git diff --exit-code -- runtime/lib
```

Bootstrap, build and the full suite passed. The final full suite contains 659 tests: 136 tooling,
293 runtime, 167 catalog and 63 Eval Lab. Focused install/operator tests passed 85/85 and schema
checks passed 3/3. The final receipt/compatibility regression pass contains 25/25 tests. Catalog validation reported 17 valid operations. The local SDK example reported
synthetic-local-contract-example, executionAuthorized false, liveExecutions 0 and humanVerdicts 0.
Build left maintained runtime/lib unchanged. The first bootstrap failed on the unwritable default
npm cache; the task-owned cache above resolved it. An intermediate schema test caught a missing
JSON Schema array type; that was fixed before the passing schema and full-suite runs.

Doctor reported all 38 outcomes, manual activation, the complete adapter, and zero issues. The
manifest records 1,096 method resources and 16 operator resources. Plugin contract checks left
hostActivationVerified false. These are local checks, not activation or output-quality evidence.

Three fresh temporary lifecycle cycles used operator, harness and codex compact targets. For each,
the exact sequence was install, status, doctor --json, update, status, doctor --json, uninstall,
and status. Operator/codex used --project ABS; harness used --path ABS. All eight commands in each
cycle passed, for 24 successful CLI invocations. Every doctor reported 38 methods and manual
activation. Operator/harness included the adapter; compact omitted it. All copies were removed,
and the receiving project's AGENTS.md and draft.md remained unchanged. Direct admission-function
checks on the installed operator/harness confirmed manual abstention, project admission, and off
abstention. They did not call a host or start a background task.

The temporary lifecycle driver was run with:

```sh
node /private/tmp/conquistador-review-lifecycle.mjs "$PWD"
python3 /private/tmp/conquistador-review-links.py "$PWD"
node /private/tmp/conquistador-review-scan.mjs
```

The local Markdown audit checked 1,121 files and 1,539 links with zero unresolved links after
accounting for three entrypoint-template links that resolve after staging. Staged install tests
check those template links in their real destinations. The audit fixed one stale iOS reference
anchor without changing its method version. The source boundary scan checked 1,582 files against
three private path fingerprints and credential patterns: no matches and no tracked dependency,
state, credential or distribution artifacts. This is a pattern scan plus source review, not a
claim that regexes can classify all confidential material. No private-alpha remote link or native
host manager command was exercised; those channel references remain proposed. Historical dogfood
release names, tags and CI coverage remain; method examples using the ordinary word dogfooding are
not channel references. CHANGELOG is byte-identical to its d2fc898 contents.

Execution limits remain explicit: 1–4 concurrent contexts, 3–12 total dispatch attempts, 1–1,800
seconds per team, and 256–128,000 UTF-8 bytes per result. Ordinary assignments have at most two
attempts, only before accepted dispatch. Correction and final re-review each have one attempt.
Selected method/knowledge context is bounded to 196,608 bytes and 100 method files per assignment.
Receipts have at most 12 rows; public evidence/gap lists have at most 12 entries of 200 bytes.
Default cleanup waits at most 5 seconds; the BB adapter allows 80 seconds for its bounded cleanup.
These limits do not measure model tokens, billing, source use or host filesystem permissions.

## Supported findings and corrections

| Finding | Correction and affected implementation |
| --- | --- |
| Public fields copied arbitrary model prose; regex replacement could leave multiple secrets or private bodies | contracts.mjs and receipt.mjs omit raw goal/evidence/gap bodies, restrict identities and use public summaries and observed counts |
| The final review replaced the initial review, and receipt text inferred evidence and capability use from plans | orchestrate.mjs and receipt.mjs retain both reviews and digests, derive methods from completed assignments and report actual execution mode |
| Blocked dependencies threw before receipt creation | Downstream assignments now produce not-run rows without dispatch |
| A host could report a dispatch and still trigger a preDispatch retry; correction retries could consume the re-review slot | Accepted dispatches cannot retry; correction and final-review each have one attempt |
| Existing output files were discovered after host work | team.mjs reserves its private output before reading the plan or invoking BB |
| Profile handling could silently accept invalid overrides or missing link targets, and domain validation differed in doctor | operator.mjs fails closed, narrows coding admission, and shares profile validation with doctor |
| Operator installs omitted schemas and compatibility metadata; doctor could pass a missing runner module | install.mjs, operator-package.mjs and the completeness manifest share an exact operator inventory; doctor checks its hashes and transformed master contract |
| Setup and removal prose implied automatic host activation and shutdown | setup.mjs, host/agent manifests and installation guides state explicit file invocation, host-owned routing and detachment |
| Operator work appeared in shipped history and future commands targeted dogfood | Horsemen use their fact classes; current channel guidance names private-alpha and preserves historical facts |

Correction and re-review use coordinator-only operator:correct and operator:final-review IDs,
which cannot collide with valid user assignment IDs. Existing plans without presentation and user
assignments named correct or final-review remain valid; integrate and review stay reserved.
The portable v1 agent metadata and v2 master schema remain available. The unshipped receipt schema
keeps v1 and adds optional status/reviewedDigest fields plus not-run rows. Consumers must accept
those fields and retain every observed review row.

## Files corrected in this review

The review changes 52 product files. The source diff remains available through Git.

```text
.claude-plugin/marketplace.json
.claude-plugin/plugin.json
.codex-plugin/plugin.json
.github/workflows/checks.yml
AGENTS.md
CHANGELOG.md
CONTRIBUTING.md
INSTALL.md
PROGRESS.md
README.md
ROADMAP.md
SKILL.md
VERSIONS.md
VISION.md
agents/conquistador.md
agents/conquistador/agent.json
agents/execution-receipt.schema.json
docs/DOGFOOD.md
docs/INSTALL-REFERENCE.md
docs/MASTER-AGENT.md
docs/PLATFORMS.md
docs/PRIVATE-ALPHA.md
docs/SERVICES.md
docs/USAGE.md
hosts/coding-agent/README.md
hosts/coding-agent/contracts.mjs
hosts/coding-agent/host.json
hosts/coding-agent/operator-experience.test.mjs
hosts/coding-agent/operator.mjs
hosts/coding-agent/operator.test.mjs
hosts/coding-agent/orchestrate.mjs
hosts/coding-agent/receipt.mjs
hosts/coding-agent/team.mjs
package.json
plugin.json
release/completeness.json
runtime/tests/agent-packages.test.ts
skills/build-ios-app/references/api-reference.md
skills/conquistador/SKILL.md
skills/conquistador/adapters/single-agent.md
skills/conquistador/orchestration/specialist-team.md
skills/conquistador/specialists/roster.md
tools/entrypoint/SKILL.md
tools/install.mjs
tools/install.test.mjs
tools/installation-doctor.mjs
tools/installation-doctor.test.mjs
tools/operator-package.mjs
tools/setup-entry.test.mjs
tools/setup.mjs
tools/setup.test.mjs
tools/update-completeness.mjs
```


The first local assembly at f557d6d exposed one npm-only broken link: docs/INTEGRATIONS.md linked to
.github/workflows/integration-updates.yml, which the npm files list omitted. The package now includes
the referenced workflow directory. Those definitions do not execute from an installed package.
The final protocol check also rejects non-string, empty, and oversized host execution identities
before they can support an independence claim. These follow-up fixes remain unshipped.

## Exact local package verification

The corrected executable source is committed at
`98ea75679b704d15f27ad9b605ff1d54f60f2e79`, after the main review commit
`f557d6d4fbdf0f36990e955abbd74a526aa2e293`. From that clean commit, Node 24.21.0 ran:

```sh
npm run package
npm run package -- /private/tmp/conquistador-review-repack
python3 /private/tmp/conquistador-review-packages.py "$PWD" "$(git rev-parse HEAD)"
```

Both package commands passed. The ZIP contains 1,582 files; the npm tarball contains 1,580. Every
archive file's bytes matched the corresponding committed Git file. Both archives contain the
operator schemas, v1 compatibility metadata, adapter, completeness manifest, private-alpha guide,
historical checklist redirect and referenced workflow definitions. Neither contains dependencies,
private state, credentials, or committed distribution output. The npm private guard remains true.
The three-fingerprint source scan and semantic review also apply to those exact file bytes.

Both extracted archives passed doctor with 38 methods and host activation unverified, plus all
1,539 local links in 1,121 Markdown files. The three relocated template links are checked by the
staged installer tests. Each archive passed the operator, harness and compact lifecycle sequence,
24 CLI commands per archive. With the source cycles, this is 72 successful lifecycle CLI invocations
across nine fresh installs. Temporary installs and extracted copies were removed; user-file
sentinels were preserved. No host registration, model task or account operation was performed.

Repeated ZIP packaging of that commit was byte-identical. npm cross-toolchain reproducibility is
not claimed. Assembly records say UNBOUND, published false, liveExecutions 0 and humanVerdicts 0.
They are package identity evidence, not release acceptance or approval.

| Artifact at 98ea756 | SHA-256 |
| --- | --- |
| conquistador-0.1.0.zip | c7cfd60bac04864130f81a3135dea8343a0b4710bde8e47c086d80ab44c5f2f3 |
| forsvn-conquistador-0.1.0.tgz | 608604182fbb02a1fbc590d1f2c151eb9410970033ec4300873854c13fb047d4 |

This evidence is recorded in a separate documentation commit. Packaging that final commit produces
its own source identity and checksums without changing the tested executable files. Local output
stays under dist/<commit>/ and is not committed, pushed, signed or published. The proposed future
source acquisition remains `gh repo clone forsvn-labs/conquistador SOURCE -- --branch private-alpha
--single-branch`, followed by `node SOURCE/tools/setup.mjs install --target operator --project ABS`.
It installs at ABS/.conquistador-operator. Until the owner makes the channel available, use the
supplied complete source or local ZIP. FOR-247 and FOR-248 acceptance remains open.
