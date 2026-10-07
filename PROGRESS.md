# Product progress

## Unshipped

- **Tools for deployed agents.** The MCP server adds `conquistador_check` (the rule-based checker
  for text the caller sends) and an optional `context` input on `conquistador_brief`, so an agent
  without a repository gets a self-contained work order. Every brief now requires the check before
  handover. The email `cta-missing` rule accepts a short direct question that asks for a reply.
  The HTTP image now copies `tools/context-files.mjs`; before, a hosted brief failed. The server
  runs as a Cloudflare Worker (`worker.mjs`, `wrangler.toml`) that reads the library from its
  bundle and refuses requests until its token is set. The agent-loop E2E passes in workerd through
  `wrangler dev`, including methods, files, read, and search. It is not deployed yet. `tools/e2e/agent-loop.mjs` checks the loop over HTTP.
- **Briefs inline each command's Core list.** A brief included only the top three lexical matches,
  so it could leave out files that `COMMAND.md` says to read in full. A Claude agent that used only
  the HTTP endpoint found this on 2026-10-07: the outreach brief carried 2 of its 5 core files.
  The check now returns structured results with a `blocking` count, accepts natural-length action
  lines and reply questions in email, and every brief states that a clean check does not verify facts.
- **Default branch is `main`.** It was `private-alpha`; GitHub redirects old branch links. CI,
  the release steps in CONTRIBUTING, and documentation links now use `main`. The acceptance
  checklist is now `docs/PUBLIC-ALPHA.md`. The `jobs` and Eve export messages link to `main`.
  CHANGELOG and dated review records keep the old name where it was true.

Shipped work, by date, is in [CHANGELOG.md](CHANGELOG.md). Ordered upcoming work is in
[ROADMAP.md](ROADMAP.md). Earlier progress records are retained in Git history.
