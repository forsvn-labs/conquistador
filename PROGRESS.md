# Product progress

## Unshipped

- **Tools for deployed agents.** The MCP server adds `conquistador_check` (the rule-based checker
  for text the caller sends) and an optional `context` input on `conquistador_brief`, so an agent
  without a repository gets a self-contained work order. Every brief now requires the check before
  handover. The email `cta-missing` rule accepts a short direct question that asks for a reply.
  The HTTP image now copies `tools/context-files.mjs`; before, a hosted brief failed. The server
  can run as a Vercel function (`api/mcp.mjs`) that refuses requests until its token is set. It is
  not deployed yet. `tools/e2e/agent-loop.mjs` checks the loop over HTTP.
- **Default branch is `main`.** It was `private-alpha`; GitHub redirects old branch links. CI,
  the release steps in CONTRIBUTING, and documentation links now use `main`. The acceptance
  checklist is now `docs/PUBLIC-ALPHA.md`. The `jobs` and Eve export messages link to `main`.
  CHANGELOG and dated review records keep the old name where it was true.

Shipped work, by date, is in [CHANGELOG.md](CHANGELOG.md). Ordered upcoming work is in
[ROADMAP.md](ROADMAP.md). Earlier progress records are retained in Git history.
