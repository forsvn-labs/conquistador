# Conquistador status

Updated 2026-10-23. Release evidence comes from [PR #86](https://github.com/forsvn-labs/conquistador/pull/86),
[v0.10.0](https://github.com/forsvn-labs/conquistador/releases/tag/v0.10.0),
and [publication run 39926746714](https://github.com/forsvn-labs/conquistador/actions/runs/39926746714).

## Shipped

Product 0.10.0 is tagged at `ba4d0782b67a17d89dd58c57dbe8a28e9ea695c9`.
The GitHub release has seven assets. All five downloaded archives match SHA256SUMS.
The release adds task-aware admission, bounded current-stage briefs, advisory hooks,
verified context reuse, and scoped edit checks. Installed skill entries no longer
require every Core reference or an appendix.

All twelve candidate CI checks and all seven merged-source jobs pass. Six direct release-archive checks verify the
version, engineering silence, assist mode and total budget, and both npm and staged
skill entry points. The [behavior review](docs/BEHAVIOR-REVIEW-2026-10.md) contains
local regression evidence and its limits.

Both `@forsvn/conquistador@0.10.0` and `conquistador@0.10.0` are verified as npm
latest. Registry tarball bytes match the checked release archives; both packages have
provenance and signatures, and the CLI alias pins the exact main-package version.
Fresh registry installs pass the API routing smoke checks and CLI version check.
[The registry evidence](docs/release-0.10.0-verification.json) records source identity,
archive digests, and provenance links. The initial CLI publication retry was needed
because npm had accepted the main package before making it visible in the registry.

## Held and unverified

The hosted service has not received the 0.9.1 update. Existing authenticated
access returned HTTP 401 before deployment, so current authenticated hosted
acceptance remains blocked. Package publication does not close that gap.
Public health and OAuth metadata checks passed.

Native activation in additional clients, interactive Windows and ARM,
additional OAuth clients, linked-provider lifecycle, and broader model and
human task-quality acceptance remain unverified. Existing lint diagnostics
and the optional Promptfoo/node-forge findings remain open.

## Current installation work

The installation candidate makes `npx conquistador@latest` the primary entry,
adds an Executor-only MCP setup shortcut, and documents standalone MCP in coding
agents, desktop clients, Executor, and Composio. It is not a new npm release.
Local process checks pass 17/17, packaged installation checks pass 6/6, and
focused setup/MCP/Executor checks pass 28/28. Another 29 onboarding checks pass. Documentation build and link validation pass.
[Installation acceptance](docs/INSTALLATION-ACCEPTANCE.md) records repeatable commands
and the limits of this evidence. Live remote account acceptance remains open.

## Planned and next steps

1. Resolve the existing hosted-access blocker through its authorized owner,
   then verify the exact candidate and hosted behavior.
2. Complete native client, Windows/ARM, OAuth, and linked-provider
   acceptance before extending support claims.
3. Evaluate real tasks and corrections across methods. Keep deterministic
   checks, model judgments, human verdicts, and audience outcomes distinct.
4. Verify marketplace listings and current-release installation when those
   distribution actions are approved.

Gemini CLI hooks are not built. Browser and Edge app runtimes are not
certified. Consent-bound memory, expanded capability readiness, and
method-specific quality evaluations remain planned work. The
[public-alpha checklist](docs/PUBLIC-ALPHA.md),
[installation acceptance](docs/INSTALLATION-ACCEPTANCE.md), and
[version policy](VERSIONS.md) supply the technical detail.
