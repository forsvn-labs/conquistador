# Product progress

## Unshipped

- **0.4.0 is prepared, not published.** Manifests say 0.4.0 and the entry is in
  [CHANGELOG.md](CHANGELOG.md). The tag, the npm publish, and the registry check come next.
- **Self-serve tokens, server side.** The CLI commands (`login`, `whoami`, `logout`) ship in 0.4.0;
  the Worker that answers them is not deployed. Done on 2026-10-08: the GitHub OAuth App exists and
  the KV namespace `conquistador-tokens` is created, with its id in `wrangler.toml`. Still to do:
  set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` on the Worker, deploy, and run
  `node tools/e2e/signup.mjs --live --url https://mcp.forsvn.com`, which has not happened. Until
  then `conquistador login` against mcp.forsvn.com fails and the admin token still works.
- **Docs site** ([#58](https://github.com/forsvn-labs/conquistador/pull/58), open). Mintlify site in
  `docs-site/`; not live. It needs the Mintlify project, the `/docs` rewrites on the landing site,
  and Context7 registration.

Shipped work, by date, is in [CHANGELOG.md](CHANGELOG.md). Ordered upcoming work is in
[ROADMAP.md](ROADMAP.md). Earlier progress records are retained in Git history.
