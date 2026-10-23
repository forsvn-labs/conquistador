# Conquistador status

Updated 2026-10-23. Release evidence: [PR #90](https://github.com/forsvn-labs/conquistador/pull/90),
[v0.10.1](https://github.com/forsvn-labs/conquistador/releases/tag/v0.10.1), and
[publication run 39935303698](https://github.com/forsvn-labs/conquistador/actions/runs/39935303698).

## Shipped

Product 0.10.1 is tagged at `95aca7f2122d6dbd94937ac588646619e422cb11`.
The seven release assets bind the tagged source; all five downloaded archives match
SHA256SUMS. The release makes `npx conquistador@latest` the primary setup command,
adds the Executor-only MCP shortcut, and includes a runnable Composio Custom MCP
example. Standalone MCP does not activate skills or hooks.

Both `@forsvn/conquistador@0.10.1` and `conquistador@0.10.1` are verified as npm
latest. Their tarballs match the release bytes, have provenance and signatures,
and the alias pins the exact main-package version. Fresh registry installation
verifies the CLI, Executor-only plan, Composio preview, and standalone MCP handshake.
[Registry evidence](docs/release-0.10.1-verification.json) records identities and digests.
The CLI job was retried after the main package became visible in npm's registry.

All release-candidate CI checks pass, including installation on Linux and Windows.
The final release archive passes 38 app-integration checks. Local installation cases
pass 17/17; focused installation/hosted tests pass 63/63; Composio preview checks pass
5/5. Documentation build and link validation pass.

The hosted Worker serves 0.10.1 at `https://mcp.forsvn.com/mcp`. Existing secrets,
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

## Current work

A simpler installer is prepared for 0.10.2: Agents → Review → Install → Done, optional
extras, commands behind Details, and grouped management controls. This is not yet a
published release. The 68 installer E2E cases passed across the full run and focused
correction runs; 75 focused contract tests passed. These use isolated fixtures, not
live provider acceptance. Website changes are owned in the separate landing-page repository.

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
