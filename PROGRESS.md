# Product progress

## Unshipped

- **Self-serve tokens, server side: deployed and checked live.** Worker version
  `7d35662a-aa35-45f6-8ae6-6c14a58271bd` (2026-10-08 06:42 UTC) has the GitHub secrets and the
  `conquistador-tokens` KV namespace. `node tools/e2e/agent-loop.mjs --url https://mcp.forsvn.com/mcp`
  passes 11/11 with the admin token. After the OAuth App got **Enable Device Flow**,
  `node tools/e2e/signup.mjs --live --url https://mcp.forsvn.com` passed 7/7 with real GitHub
  (07:30 UTC): login saves a `cq_` token, `whoami` names the user, the token opens `/mcp`, unknown
  tokens get 401, and logout revokes. Not tried with a real account: browser sign-in at `/signup`.
  Open: the landing's "Get a token" link (`CQ_TOKEN_SIGNUP`) is not on in production.
- **Docs site** ([#58](https://github.com/forsvn-labs/conquistador/pull/58), merged; not live).
  `docs-site/` is a Mintlify site with 23 pages; `node tools/e2e/docs-site.mjs` checks it against
  the CLI, the MCP tools, and the check rules. Context7 indexes it as `/forsvn-labs/conquistador`
  (checked 2026-10-08). Open: the Mintlify project `forsvn` still serves its starter template and
  must serve `docs-site/` at base path `/docs`. The landing with the `/docs` rewrites is in
  production (0.4.0 page), so `/docs` returns Mintlify's 404 until then.

Shipped work, by date, is in [CHANGELOG.md](CHANGELOG.md). Ordered upcoming work is in
[ROADMAP.md](ROADMAP.md). Earlier progress records are retained in Git history.
