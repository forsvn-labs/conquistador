# Product progress

## Unshipped

- **Self-serve tokens, server side: deployed, terminal sign-in blocked.** Worker version
  `7d35662a-aa35-45f6-8ae6-6c14a58271bd` (2026-10-08 06:42 UTC) has the GitHub secrets and the
  `conquistador-tokens` KV namespace. `node tools/e2e/agent-loop.mjs --url https://mcp.forsvn.com/mcp`
  passes 11/11 with the admin token. The live sign-up run passed 4/7: `/signup` answers, `/api/login`
  returns the client id, unknown tokens get 401, and logout works; `conquistador login` fails because
  GitHub answers `device_flow_disabled`. Next: turn on **Enable Device Flow** in the OAuth App, then
  run `node tools/e2e/signup.mjs --live --url https://mcp.forsvn.com` again. Browser sign-in at
  `/signup` has not been tried with a real account.
- **Docs site** ([#58](https://github.com/forsvn-labs/conquistador/pull/58), merged; not live).
  `docs-site/` is a Mintlify site with 23 pages; `node tools/e2e/docs-site.mjs` checks it against
  the CLI, the MCP tools, and the check rules. Context7 indexes it as `/forsvn-labs/conquistador`
  (checked 2026-10-08). Open: the Mintlify project `forsvn` still serves its starter template and
  must serve `docs-site/` at base path `/docs`; the landing with the `/docs` rewrites is merged but
  not in production.

Shipped work, by date, is in [CHANGELOG.md](CHANGELOG.md). Ordered upcoming work is in
[ROADMAP.md](ROADMAP.md). Earlier progress records are retained in Git history.
