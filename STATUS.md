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

npm accepted the main package with signed provenance. Registry visibility and CLI
alias publication are pending. The CLI job stopped because the accepted main version
was not yet visible; retry only that job once the version resolves. The previous
verified npm latest is 0.9.1. A GitHub release does not establish npm availability.

## Held and unverified

The hosted service has not received the 0.9.1 update. Existing authenticated
access returned HTTP 401 before deployment, so current authenticated hosted
acceptance remains blocked. Package publication does not close that gap.
Public health and OAuth metadata checks passed.

Native activation in additional clients, interactive Windows and ARM,
additional OAuth clients, linked-provider lifecycle, and broader model and
human task-quality acceptance remain unverified. Existing lint diagnostics
and the optional Promptfoo/node-forge findings remain open.

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
