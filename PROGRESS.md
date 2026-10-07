# Product progress

## Unshipped

- **The 2026-10-07 hosted changes, for installed users.** Everything in the 2026-10-07 hosted
  deployment ([CHANGELOG.md](CHANGELOG.md)) is merged on `main` but not in an npm release (0.3.0 is
  current). For installed users that is: the distilled playbooks and `outreach` 2.4.0; rubric gates;
  briefs that start with the route and inline each command's Core list; the new email rules
  (`email-presumed-pain`, `email-relative-time`, `email-merge-tag`) and the reply-question call to
  action in `conquistador check`; and the local MCP server's new tools (`conquistador_check`,
  `conquistador_verify`, `conquistador_score`). Receipts from a local server without
  `CONQUISTADOR_RECEIPT_KEY` are unsigned.
- **MCP SDK security bump for the Executor host.** `hosts/executor` pins
  `@modelcontextprotocol/sdk` 1.31.0 instead of 1.30.0 for
  [GHSA-6qxp-vccf-f47h](https://github.com/advisories/GHSA-6qxp-vccf-f47h)
  ([#46](https://github.com/forsvn-labs/conquistador/pull/46)). It ships with the next npm release.
- **Default branch is `main`.** It was `private-alpha`; GitHub redirects old branch links. CI,
  the release steps in CONTRIBUTING, and documentation links now use `main`. The acceptance
  checklist is now `docs/PUBLIC-ALPHA.md`. The `jobs` and Eve export messages link to `main`.
  CHANGELOG and dated review records keep the old name where it was true.

Shipped work, by date, is in [CHANGELOG.md](CHANGELOG.md). Ordered upcoming work is in
[ROADMAP.md](ROADMAP.md). Earlier progress records are retained in Git history.
