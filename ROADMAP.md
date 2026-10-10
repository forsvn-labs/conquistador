# Product roadmap

## Public alpha follow-up

1. Run the five live Executor cases (first run and connect) that 0.3.0 shipped without. They need
   a responding Executor.app.
2. List the plugin in the agent marketplaces, then check each listing installs 0.4.x.
3. Test the interactive installer on Windows (a pseudo-terminal harness), and Linux and Windows
   on ARM. `tools/e2e/installer.mjs` needs a Windows pseudo-terminal bridge first.
4. Optional: add `conquistador.forsvn.com` as the Mintlify custom domain with base path `/docs`, so the
   Mintlify dashboard and canonical links name it. The landing rewrite serves `/docs` without it.
5. Open each MCP app (Claude Desktop, VS Code, Windsurf, Zed, Cursor) after the installer writes
   its entry, and check that the app lists the Conquistador tools. Only the config file and an MCP
   handshake are checked now.

## Next acceptance

0. Rerun the Haiku-class gate test with run 3's exact context (no sender address) to exercise the
   rejection path live, and add a judgment check for invented backstory and stage changes, which the
   rule-based checker cannot see (run 4, 2026-10-07).
1. Add "Open in Claude Code" (`claude-cli://open?q=`) and "Open in Cursor" deep-link buttons with a
   "Copy prompt" fallback to the landing page. Test both links in a browser first.
2. Observe the plugin hooks in a real Codex session (after hook trust), Cursor, Copilot CLI, and
   Grok CLI. Only Claude Code sessions have been observed.
3. Repeat `node tools/e2e/knowledge-use.mjs` with more runs and more tasks after the plan limit
   resets, across all nine areas (`--set breadth`), and add a quality comparison (blind review
   of before and after answers), not only reads.
4. Seek Hung's verdict on a real task in his own agent: playbook relevance, clarity, and usefulness.
   Tune the briefing engine and the vault playbook threshold from those corrections.
5. Submit the Muse connector for the hosted server at `https://mcp.forsvn.com/mcp`, then check that
   a Muse task reaches the brief and the check.

## Hosted server access

1. Sign in once at `https://mcp.forsvn.com/signup` in a browser with a real GitHub account, and
   check that the page shows a `cq_` token and the client setup text. Only terminal sign-in
   (`conquistador login`) has passed live.
2. Phase 2: MCP authorization, so claude.ai, Claude Desktop connectors, and other MCP clients sign
   in without a copied token. Design:
   - The Worker becomes an OAuth 2.1 authorization server for MCP clients, with
     `@cloudflare/workers-oauth-provider`. It serves `/.well-known/oauth-authorization-server`,
     `/.well-known/oauth-protected-resource`, dynamic client registration (`/register`),
     `/authorize`, and `/token`, with PKCE required.
   - `/authorize` sends the person to GitHub (the same OAuth App, a second callback path on the
     same host) and then shows a consent page that names the MCP client.
   - The provider stores grants and tokens in KV (`OAUTH_KV`). Each grant carries the GitHub id, so
     the per-token rate limit, the blocked status, and `conquistador logout` apply to OAuth grants
     too.
   - `cq_` tokens and the admin token keep working as plain bearer tokens beside OAuth, for CLIs,
     bots, and tests.
   - Acceptance: claude.ai adds `https://mcp.forsvn.com/mcp` as a custom connector and calls the
     brief and the check; Claude Code connects with `/mcp` and no header; a revoked grant stops
     working; the sign-up E2E gains an OAuth client that registers, authorizes, and refreshes.
   - Open questions: consent-page wording; whether to keep the 365-day expiry for OAuth refresh
     tokens; whether a GitHub org allowlist is needed if abuse appears.

## Private-alpha follow-up

1. Obtain the human verdict for the observed six-context BB run and record concrete task feedback.
   The run completed specialists, integration, exact-digest review, one correction and re-review.
   FOR-247 and FOR-248 retain their remaining acceptance scope until the required verdict exists.
2. Observe a host adapter calling request admission in project, manual and off modes. Check
   unrelated coding requests, removal and same-context fallback. Setup prepares files but does not
   register routing or start a watcher. Native automatic activation remains unverified.
3. Extend native parent-first discovery acceptance to fresh Claude, Copilot and Cursor sessions. Confirm
   one entry, selected-method loading, capability disclosure, cache refresh, update and removal.
   A fresh Codex CLI 0.154.0 launch task and correction on the 0.0.11 tree read the native parent,
   full selected method, required standards and relevant resources. That earlier observation does
   not establish v0.0.13 behavior, the other hosts, all methods, independent review or human acceptance.
4. Verify native Windows/Linux installation and host execution before claiming those platforms.
   macOS transports and Linux CI results do not certify native Windows or Linux host activation.

Use the [public-alpha acceptance checklist](docs/PUBLIC-ALPHA.md), with historical prerelease
checks kept separate from the default plugin route. Installed files, provider observations,
human acceptance and release authority remain separate evidence classes.

## Later product work

- Report live capability readiness with installed, permitted, connected, executable and verified
  states. Resolve project context with provenance, freshness, precedence and explicit conflicts.
- Add consent-bound project memory and retrieval. A review pass does not authorize persistence.
  Unify product context, voice, style, audience and channel contracts with clear overrides.
- Add method-specific quality evaluations that separate deterministic validity, model review,
  human verdict and observed outcomes. Do not imply quality coverage for all 38 methods.
- Verify Executor setup and task resumption with a separately authorized account operation.
  Observe permissions, cancellation and recovery. Discovery or login alone does not prove a task.
- Check local MCP repair after Node replacement and native Windows path and file-lock behavior.
  Exercise optional previews, Claude hooks and domain restrictions in the consuming host.
- Exercise requested Eve jobs with a named owner, selected model and budget, approval, cancellation
  and saved-state recovery. Keep optional dependency pins until upgrades are reviewed.

## Release follow-through

Public alpha began at `0.2.0`; `0.5.0` is the current release. The historical private
`0.1.0` tag is not the public-alpha milestone; see [version policy](VERSIONS.md).

Before the next release, repeat first-use installation, update, removal, task, and correction
acceptance on its exact candidate bytes. Keep CLI checks, native host observations, model outputs,
and human verdicts distinct. Publish the exact reviewed package only with explicit authorization;
then verify registry identity and the deployed landing page's release/access/setup/removal copy.
Source edits alone do not close a deployed-site finding. Marketplace listings and other external
distribution remain explicit decisions. See [PROGRESS.md](PROGRESS.md) for unshipped work.
