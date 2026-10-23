# Conquistador status

Updated 2026-10-23. Release evidence comes from [PR #84](https://github.com/forsvn-labs/conquistador/pull/84),
[v0.9.1](https://github.com/forsvn-labs/conquistador/releases/tag/v0.9.1),
and [publication run 39899101398](https://github.com/forsvn-labs/conquistador/actions/runs/39899101398).
This documentation update does not repeat product acceptance.

## Shipped

Product 0.9.1 is tagged at `d812ca5a2b46f17e05aab8058141b3ac14c45ef6`.
Both `@forsvn/conquistador@0.9.1` and the paired `conquistador@0.9.1`
package are published with checked release bytes and provenance.
The release contains bounded brief reads, linear stdio frame assembly,
and streamed-upload failure and cancellation fixes.

Recorded checks pass: eleven candidate CI jobs, seven merged-source jobs,
963 tagged-source tests, 38 npm and 38 Bun consumer checks, eight
release/registry checks, and six registry-install checks.
[The MCP review](docs/MCP-REVIEW-2026-10.md) owns exact commands,
measurements, and coverage limits. Frame benchmarks do not establish a
general task-speed improvement.

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

The [2026-10 behavior review](docs/BEHAVIOR-REVIEW-2026-10.md) reproduces unrelated
engineering-task activation, fallback bypass of an off profile, and excessive required
reading. Its offline audit records five admission failures in thirteen synthetic prompts;
83 existing focused tests pass. Fix shared admission and automatic hook enforcement before
expanding proactive guidance. The review changes no runtime behavior or release status.

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
