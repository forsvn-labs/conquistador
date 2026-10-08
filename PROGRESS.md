# Product progress

## Unshipped

- **Self-serve tokens, server side: deployed and checked live.** Worker version
  `7d35662a-aa35-45f6-8ae6-6c14a58271bd` (2026-10-08 06:42 UTC) has the GitHub secrets and the
  `conquistador-tokens` KV namespace. `node tools/e2e/agent-loop.mjs --url https://mcp.forsvn.com/mcp`
  passes 11/11 with the admin token. After the OAuth App got **Enable Device Flow**,
  `node tools/e2e/signup.mjs --live --url https://mcp.forsvn.com` passed 7/7 with real GitHub
  (07:30 UTC): login saves a `cq_` token, `whoami` names the user, the token opens `/mcp`, unknown
  tokens get 401, and logout revokes. Not tried with a real account: browser sign-in at `/signup`.
- **Docs site: live at <https://conquistador.forsvn.com/docs>** (2026-10-08). The Mintlify project
  `forsvn` builds `forsvn-labs/conquistador` `main`, folder `docs-site`, base path `/docs`; the landing
  proxies `/docs` to it. `node tools/e2e/docs-site.mjs --live https://conquistador.forsvn.com/docs`
  passes 20/20, and a browser load shows no CSP errors or broken images. Context7 indexes it as
  `/forsvn-labs/conquistador`. Open: the landing's "Docs" and "Get a token" links are in a checked
  preview, not yet in production; Mintlify has no custom-domain entry for `conquistador.forsvn.com`
  (the rewrite works without it).

Shipped work, by date, is in [CHANGELOG.md](CHANGELOG.md). Ordered upcoming work is in
[ROADMAP.md](ROADMAP.md). Earlier progress records are retained in Git history.
