# Conquistador status

Updated 2026-10-27. Release evidence: [PR #109](https://github.com/forsvn-labs/conquistador/pull/109),
[release PR #110](https://github.com/forsvn-labs/conquistador/pull/110),
[v0.11.0](https://github.com/forsvn-labs/conquistador/releases/tag/v0.11.0), and
[publication run 40481863510](https://github.com/forsvn-labs/conquistador/actions/runs/40481863510).

## Release candidate 0.12.0

Prepared 2026-10-29 from [PR #112](https://github.com/forsvn-labs/conquistador/pull/112),
merged at `942b395`. This candidate adds the distillation workflow, the growth
playbook, broader routing, a facts-only SMS and WhatsApp channel file, corrected
search facts, and eleven post-draft checker rules. No method craft changed.

Before this version change, the product tests (one existing skip), 838 routing cases,
44 checker fixtures, app integration, and all PR checks passed. The release candidate
still requires its own package verification and publication evidence. These checks
establish loading and installation, not model output quality. The hosted Worker is a
separate deployment and is not part of this release.

The last verified public release remains 0.11.0 until publication is checked.

## Merged: distillation workflow (2026-10-29)

`tools/distill.mjs` pins permissively licensed sources at exact commits, maps their units to routes,
compares written requests with routes, and checks that public text shares no 8-word run or source
name with a source. [docs/DISTILL.md](docs/DISTILL.md) describes the workflow. Two public skill
libraries were distilled into private notes. This branch adds:

- [The growth playbook](docs/GROWTH-PLAYBOOK.md), a reference for people. Default briefs do not load it.
- Routing for 117 new cases, including 17 engineering look-alikes that stay silent. On 455 requests
  from the notes, misroutes fall from 323 to 214 and unrouted requests from 255 to 141, with none
  newly broken.
- A facts-only SMS and WhatsApp channel file that thin routes read when the request names it.
- Corrected search facts: retired FAQ and HowTo rich results, disavow scope, Apple keyword bytes.
- Eleven post-draft checker rules. The drafting guide is unchanged, so blind-tested context is unchanged.

All product tests (one existing skip), 838 routing cases, 44 checker fixtures, and app
integration pass. No method craft changed; craft candidates wait for human blind tests. The routing
contract is 24 bytes under its 90% safety budget. This is source verification, not a release.

## Shipped 0.11.0

Product 0.11.0 is tagged at `2dfa2a6362507e5c8a6796ecfc3c334557cb84a7`.
The seven downloaded assets bind that source. All five archives match the release
checksums and the tested candidate bytes. Start with `npx conquistador@latest`.

Both `@forsvn/conquistador@0.11.0` and `conquistador@0.11.0` are verified as npm
latest. Their registry tarballs match the release bytes, and the alias pins the
exact main-package version. `npm audit signatures` verifies the installed
registry signatures and attestations. A fresh registry install verifies the CLI,
MCP version, an entry-only pricing brief, and startup without Conquistador home
state. [Registry evidence](docs/release-0.11.0-verification.json) records the identities,
digests, and checks. The CLI publication job was retried after the main version
became readable in npm's registry.

Thin defaults now apply to CLI briefs, app prompts, installs, specialist
assignments and team composition, MCP discovery, and upload-only bot packs.
Outbound, social, sales-page and sales-letter copy, engineering, utilities, and
kept plays retain their methods. Detailed files remain available for explicit
reads and future tests. Deliverable and decision routing, shared method files,
and human blind-test tools are included.

Release-candidate build and 1,179 tests pass, with one existing skip. All 721
routing cases pass without command or play changes in the final loader work.
All 38 installed-app checks and 50 executed package checks pass, including 22
real-agent terminal checks on macOS ARM64. The optional local Node 22 CLI matrix
was not run. CI passes product checks on Node 24/26, installed-app checks on
Node 22.18/24/26 and Bun, and installation checks on Linux and Windows. CodeRabbit
reported no actionable findings. The tagged source tree and archive bytes match
the tested candidate. These checks establish loading and installation, not
model output quality or external chat-app retrieval acceptance.

The [loader inventory and repeatable checks](docs/performance/thin-surfaces.md)
describe the entry-point behavior and its limits. This release does not redeploy
the hosted Worker.

## Earlier performance verification (2026-10-23)

The performance branch added a portable search snapshot with source-digest checks,
per-query scoring setup, and short-entry catalog routing for all 41 commands.
[Review and repeatable evidence](docs/performance/REVIEW.md) cover the API, CLI,
hooks, skills/plugins, stdio, HTTP, packaging, and hosted configuration.
At that time, build/type checks, 980 product tests, 142 routing cases,
38 installed-app checks, and 11 loopback HTTP workflow steps passed.
The cleanup removed unused selection fields, redundant retries, stale comments,
and duplicate rendered reports; raw verification JSON remains.
This was source verification before the 0.11.0 release. It did not establish a
deployment or live model-quality verdict.

## Earlier release 0.10.2 (2026-10-23)

Product 0.10.2 is tagged at `bd0f4c279650ca2eb14a2d32016d4d2cef80f323`.
The seven release assets bind the tagged source; all five downloaded archives match
SHA256SUMS. Start with `npx conquistador@latest`.

The first-run TUI follows Agents → Review → Install → Done. Options are available
from Review; detected desktop apps, Executor, and permanent CLI installation are
opt-in. Found agents appear first; the full catalog and keyboard shortcuts remain
available. Review leads with a plain summary and puts commands behind Details.
Home groups advanced controls under Settings and extra integrations under Connect apps.

The 0.10.2 publication verified both npm packages as latest at that time. Their
tarballs matched the release bytes, had provenance and signatures, and the
alias pinned the exact main-package version. Fresh registry installation
verifies the CLI, Executor-only plan, Composio preview, and standalone MCP handshake.
[Registry evidence](docs/release-0.10.2-verification.json) records identities and digests.
The CLI job was retried after the main package became visible in npm's registry.

Release-candidate CI passed on Linux and Windows, with product checks on Node 24/26
and installed app checks on Node 22.18/24/26 and Bun. Local installed-package checks
passed 50/50 executed cases, including 22 interactive checks with real agent plugin
managers in isolated homes. The tagged archive passes 38 app-integration checks.
Three tagged-source transcript scenarios pass. Fixture tests do not establish live
provider acceptance. The installed-package Expect driver now verifies the direct
Agents → Review flow; failed fixture assertions close their terminal processes.

## Hosted MCP, last verified 2026-10-23

The last verified hosted Worker was 0.10.1 at `https://mcp.forsvn.com/mcp`.
The 0.11.0 package release did not redeploy it. Existing secrets,
OAuth settings, and token storage were retained. Public health and OAuth metadata
returned 200; unauthenticated MCP requests returned 401. Authenticated Executor
calls verified that email-system engineering received no marketing brief, while
outreach copy received its 552-byte command entry within the 8,000-byte compact budget.
[Hosted evidence](docs/hosted-0.10.1-verification.json) records the deployment and results.

The 0.10.0 task-scoped behavior remains included: bounded current-stage guidance,
advisory hooks, verified context reuse, and scoped edit checks. See the
[behavior review](docs/BEHAVIOR-REVIEW-2026-10.md) for its evidence and limits.

## Verification limits

Composio follows its documented API v3.1 and pinned SDK 0.27.0. At the user's request,
this release includes a runnable setup example and offline checks, without creating
or testing a live Composio account. The example distinguishes registration, consent,
discovery, sync, and tool execution. Local checks are not live account acceptance.

The hosted check used an existing Executor account. Fresh OAuth consent in additional
clients, native activation in additional clients, interactive Windows and additional
ARM targets,
linked-provider lifecycle, and broader model/human task-quality acceptance remain
unverified. Existing lint diagnostics and optional Promptfoo/node-forge findings
remain open. They are not represented as release verification.

## Next steps

1. Complete additional native-client, OAuth, ARM, and linked-provider acceptance
   before extending support claims.
2. Evaluate real tasks and corrections across methods. Keep deterministic checks,
   model judgments, human verdicts, and audience outcomes distinct.
3. Verify marketplace listings when those distribution actions are approved.

Gemini CLI hooks are not built. Browser and Edge app runtimes are not certified.
Consent-bound memory and expanded method-quality evaluations remain planned work.
The [public-alpha checklist](docs/PUBLIC-ALPHA.md),
[installation acceptance](docs/INSTALLATION-ACCEPTANCE.md), and
[version policy](VERSIONS.md) supply technical detail.
