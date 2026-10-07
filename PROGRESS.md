# Product progress

## Unshipped

- **Onboarding v2, on branch `feat/onboarding-v2` (not merged).** `conquistador` on the first run,
  `conquistador add`, and every install flag go through one installer (`tools/onboard.mjs`):
  preflight (shadowed or stale `conquistador` on PATH, newer npm version), surfaces (coding agents,
  MCP apps, Hosted MCP, Executor, chat bots), details, review, install with a verify pass, project
  setup, first task, and summary. New flags: `--surface`, `--apps`, `--executor-name`, `--bot-out`,
  `--json`, `--plain`. Without a terminal and without `--yes`, the plan prints with exit 2. Old
  flags preselect a surface; with route options they keep the per-project route. `remove`, `update`,
  and `doctor` cover MCP app entries and the Executor source. Checked: `node tools/e2e/onboarding-v2.mjs`
  (fake agents and Executor in a pseudo-terminal, isolated HOME) and the Executor calls against
  real Executor 1.6.8 and 1.5.40 in throwaway data folders. Not observed: real MCP apps loading the
  entry, the Hosted MCP surface with the real `tools/login.mjs` (another branch), and Windows.
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
