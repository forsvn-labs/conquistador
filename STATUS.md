# Conquistador status

## Release candidate 0.11.0

Prepared 2026-10-27 from [PR #109](https://github.com/forsvn-labs/conquistador/pull/109),
merged at `b717e00`. This candidate includes the merged performance, routing,
method, and evaluation changes since 0.10.2. Thin defaults now apply to the CLI,
app prompts, installs, specialist assignments, MCP discovery, and bot exports.
Outbound, social, sales-page copy, engineering, utilities, and kept plays retain
their methods. Detailed files remain available for explicit reads and future tests.

Before this version change, 1,179 tests, 721 routing cases, 38 installed-app checks,
50 executed package checks, and all executable PR checks passed. The release
candidate still requires its own package verification and publication evidence.
These checks establish loading and installation, not model output quality.
The hosted Worker is a separate deployment and is not part of this release.

The last verified public release remains 0.10.2 until publication is checked.

Updated 2026-10-23. Release evidence: [PR #92](https://github.com/forsvn-labs/conquistador/pull/92),
[v0.10.2](https://github.com/forsvn-labs/conquistador/releases/tag/v0.10.2), and
[publication run 39944022729](https://github.com/forsvn-labs/conquistador/actions/runs/39944022729).

## In review: agent surface performance

The performance branch adds a portable search snapshot with source-digest checks,
per-query scoring setup, and short-entry catalog routing for all 41 commands.
[Review and repeatable evidence](docs/performance/REVIEW.md) cover the API, CLI,
hooks, skills/plugins, stdio, HTTP, packaging, and hosted configuration.
Local validation: build/type checks, 980 product tests, 142 routing cases,
38 installed-app checks, and 11 loopback HTTP workflow steps pass.
The cleanup removes unused selection fields, redundant retries, stale comments,
and duplicate rendered reports; raw verification JSON remains.
This is source verification, not a new release, deployment, or live model-quality verdict.

## Shipped

Product 0.10.2 is tagged at `bd0f4c279650ca2eb14a2d32016d4d2cef80f323`.
The seven release assets bind the tagged source; all five downloaded archives match
SHA256SUMS. Start with `npx conquistador@latest`.

The first-run TUI follows Agents → Review → Install → Done. Options are available
from Review; detected desktop apps, Executor, and permanent CLI installation are
opt-in. Found agents appear first; the full catalog and keyboard shortcuts remain
available. Review leads with a plain summary and puts commands behind Details.
Home groups advanced controls under Settings and extra integrations under Connect apps.

Both `@forsvn/conquistador@0.10.2` and `conquistador@0.10.2` are verified as npm
latest. Their tarballs match the release bytes, have provenance and signatures,
and the alias pins the exact main-package version. Fresh registry installation
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

The hosted Worker remains on 0.10.1 at `https://mcp.forsvn.com/mcp`.
This installer release does not redeploy it. Existing secrets,
OAuth settings, and token storage were retained. Public health and OAuth metadata
return 200; unauthenticated MCP requests return 401. Real authenticated Executor
calls verify that email-system engineering gets no marketing brief, while outreach
copy gets its 552-byte command entry within the 8,000-byte compact budget.
[Hosted evidence](docs/hosted-0.10.1-verification.json) records the deployment and results.

The 0.10.0 task-scoped behavior remains included: bounded current-stage guidance,
advisory hooks, verified context reuse, and scoped edit checks. See the
[behavior review](docs/BEHAVIOR-REVIEW-2026-10.md) for its evidence and limits.

## Verification limits

Composio follows its documented API v3.1 and pinned SDK 0.27.0. At the user's request,
this release includes a runnable setup example and offline checks, without creating
or testing a live Composio account. The example distinguishes registration, consent,
discovery, sync, and tool execution. Local checks are not live account acceptance.

The hosted check uses an existing Executor account. Fresh OAuth consent in additional
clients, native activation in additional clients, interactive Windows and ARM,
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
