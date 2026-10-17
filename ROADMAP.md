# Product roadmap

## Current handoff

2026-10-17: Hung authorized shipment. Version 0.8.0 is being prepared; the last verified
live npm release remains 0.7.0 below. No 0.8.0 publication or deployment is claimed yet.

- Four public methods: Skills, CLI, MCP, Plugins. `skills` installs project skills; `install`
  opens the current installer; `plugins` restricts its picker to native plugin clients;
  `mcp` serves stdio and `mcp install` configures chosen desktop clients. Explicit old operator
  routes remain; use `operator install` and `skills --list` for that workflow.
- `packages/conquistador` prepares the short npm name and pins the exact main-package version.
  No short-name package is published. Keep scoped commands until publication is verified.
- Hosted OAuth uses Cloudflare's provider 1.2.3 with browser-bound consent, GitHub identity,
  S256 PKCE, DCR/CIMD discovery, resource-bound tokens, refresh and revocation. API keys retain
  their own lifecycle. Both KV bindings use the existing approved namespace. The GitHub app
  callback stays `/signup/callback`. CIMD requires `global_fetch_strictly_public`.
- The sibling landing repository owns the bilingual four-choice page and browser evidence.
  Its deployment must follow the matching package and Worker deployment. No live OAuth or
  Executor acceptance is claimed from local fixtures.
- Repeatable checks and sources: [installation acceptance](docs/INSTALLATION-ACCEPTANCE.md).
  [Core PR #80](https://github.com/forsvn-labs/conquistador/pull/80) contains this source.
  The full product run passes 940 checks (416 tools, 294 runtime, 167 catalog, 63 evals).
  Later boundary/auth changes pass 12 isolated CLI cases, 24 workerd OAuth cases, and focused
  bootstrap/Worker regressions. Six real npm/Skills installs and all 19 docs checks pass.
  The 65-case terminal run passed 63; its doctor wait and compact prompt were corrected,
  and both failed scenarios pass on recheck. Builds, plugin contracts and Worker dry run pass.
  The OAuth identity provider in workerd is a labeled local fixture. Native client activation,
  live GitHub/Executor and Windows interactive acceptance retain their existing limits.
  Dated reports and Iris captures resolve through DRIVE.md.

Rollout in progress: merge the approved 0.8.0 release source, publish the main package,
configure and publish its exact-version short alias, deploy the MCP
Worker, and verify real GitHub sign-in and Executor import. Then update the landing version,
merge its [draft PR #29](https://github.com/forsvn-labs/conquistador-landing/pull/29), and deploy.
No npm publication, Worker deployment, or live account change was performed in this work.

Release preparation closes the PR review findings: both plugin pickers and select-all use
the native catalog; fixed methods reject ignored/legacy selection flags; refused GitHub codes
clear the upstream cookie and show the specific error. The regression cases reproduced each
failure before the fixes. Current checks pass 13 CLI cases, 25 workerd OAuth cases, and the
new real-terminal plugin boundary scenario. The full product run passes 940 checks. Packaging
now includes the paired alias tarball and its checksum. Wrangler is pinned, OAuth HTTP calls
are bounded, and runner cleanup terminates the whole test process group.

Live acceptance found and reproduced a browser CSP failure on the OAuth consent redirect.
The fix allows only GitHub and the provider-validated callback in the consent form policy.
The workerd runner now includes real Chromium Allow/Cancel flows and passes all 27 cases.
All 13 CI checks at `633e367` passed before this focused browser correction. The initial Worker
source is deployed at version `a0fa5787-c040-4ec6-a3c8-da0d3f7270c7`; discovery and the existing
API key work. Executor v2 imports the app at the hosted organization URL. GitHub app configuration now uses the exact HTTPS `/signup/callback` URI, replacing the
old HTTP `/signup` value. Real GitHub sign-in completed in hosted Executor v2. The account
shows Working, all eight tools are listed, and `conquistador_methods` returned the live library.
The installation page remains undeployed.

## Live release context

Last verified: 2026-10-14. Release 0.7.0 is available as `latest` on
[npm](https://www.npmjs.com/package/@forsvn/conquistador/v/0.7.0) and
[GitHub](https://github.com/forsvn-labs/conquistador/releases/tag/v0.7.0).
[PR #79](https://github.com/forsvn-labs/conquistador/pull/79) merged with Hung's approval.
The typed app dependency exposes all eight tools and Node/Fetch MCP handlers. The app can
mount MCP on its existing port. It supplies the model, context, access rules, and approval flow.
The CLI and TUI include **Use in an app**. Adding the app dependency and importing it start
no model or TUI.
See [the app contract](docs/APP-INTEGRATION.md) and
[its acceptance review](docs/REVIEW-2026-10-APP-INTEGRATION.md).

The published tarball matches the accepted candidate. All nine live registry checks, six
public npm/Bun dependency checks, and 36 installed-app checks on each of Node 22.18.0 and Bun
pass. They cover official MCP clients, app routes, signed receipts, context isolation, and
strict TypeScript. Final-source CI passes all ten functional jobs. Source validation passes
940 product checks and 65 terminal scenarios. [CHANGELOG.md](CHANGELOG.md) owns release identity
and the verification limits.

[Landing PR #28](https://github.com/forsvn-labs/conquistador-landing/pull/28) is merged and
live after verified npm delivery. The homepage has one command and a setup-page link.
`/install` and `/vi/install` keep all nine setup methods inside a collapsed disclosure.
All 16 agents and independent multiple-agent and MCP-client selections remain available. The chooser includes
the app dependency path. The landing suite passes 648 checks; live setup passes 224 and
production HTTP passes 63. The landing repository owns deployment identity and browser limits.

Use `npx @forsvn/conquistador@latest` when an older global install exists. An unversioned `npx`
can reuse that install; explicit `@latest` opens 0.7.0 in the live acceptance run.

After the installation rollout above, migrate the Executor source and capability adapters to v2, then run the live cases below.
The current TUI gives a manual setup handoff. See
[the control-center review](docs/REVIEW-2026-10-CONTROL-CENTER.md) for the accepted source work.

Open: interactive Windows installation, Linux/Windows ARM, native MCP client loading, the five
live Executor cases, marketplace listings, hosted OAuth, and real writing-quality acceptance.
Gemini CLI hooks are not built. Browser and Edge app runtimes are not verified.

## Social quality acceptance

Found on 2026-10-13 during a critique of the launch tweet. The `social` method rewrote Hung's draft
into copy with a colon label ("Conquistador: a free…"), negative parallelism ("a real playbook, not
vibes"), and a false range ("from positioning to launch posts"). It scored that copy "done with
concerns", and `conquistador check --channel x` passed it. The check also passed a deliberately weak
post. The session ran a stale global install (product 0.0.13, installed 2026-09-25), but the gaps
below are also in 0.5.1.

Run a real social task and correction with the new reads and critic gate. Confirm that the agent
keeps the supplied draft's voice, catches a weak draft, and does not treat deterministic checks
as proof of useful writing. The remaining third historical rewrite was not supplied; do not
claim the synthetic fixture reproduces its exact text.

## Public alpha follow-up

0. Migrate the Executor source and capability adapters to the current v2 apps/MCP contract.
   The present adapter supports Executor 1 and now gives a v2 handoff without removed CLI calls.
   Follow the official Connect flow: accounts in Executor, a scoped endpoint for the agent,
   skills and schema discovery, and per-operation approvals. Verify actual v2 install, read,
   approval, correction, update, and removal before advertising v2 support.
1. Run the five live Executor cases (first run and connect) that 0.3.0 shipped without. They need
   a responding Executor.app.
2. List the plugin in the agent marketplaces, then check each listing installs the current release.
3. Test the interactive installer on Windows (a pseudo-terminal harness), and Linux and Windows
   on ARM. `tools/e2e/installer.mjs` needs a Windows pseudo-terminal bridge first.
4. Keep the docs canonical and `og:url` check in release acceptance; its latest result is in the
   current handoff.
5. Open each MCP client (Claude Desktop, VS Code, Windsurf, Zed, Cursor) after the installer writes
   its entry, and check that the app lists the Conquistador tools. Only the config file and an MCP
   handshake are checked now.
6. Update the optional Promptfoo evaluation dependencies. On 2026-10-13, GitHub reports critical
   alerts [#50](https://github.com/forsvn-labs/conquistador/security/dependabot/50),
   [#49](https://github.com/forsvn-labs/conquistador/security/dependabot/49), and
   [#45](https://github.com/forsvn-labs/conquistador/security/dependabot/45) for
   `@simple-git/argv-parser`, `simple-git`, and `proxy-addr` in
   `evals/promptfoo-isolated/package-lock.json`. Verify patched versions and the evaluation
   adapter before enabling live evaluations. The published 0.6.0 npm tarball contains no `evals/`.

## Next acceptance

0. Rerun the Haiku-class gate test with run 3's exact context (no sender address) to exercise the
   rejection path live, and add a judgment check for invented backstory and stage changes, which the
   rule-based checker cannot see (run 4, 2026-10-07).
1. Add "Open in Claude Code" (`claude-cli://open?q=`) and "Open in Cursor" deep-link buttons with a
   "Copy prompt" fallback to the landing page. Test both links in a browser first.
2. Observe the plugin hooks in a real Codex session (after hook trust) and Cursor. Claude Code
   sessions, one Copilot CLI 1.0.78 prompt and one Grok CLI 1.0.50 prompt (2026-10-10) have been
   observed. Then turn on the read check for Copilot and Grok once their transcript formats are
   verified.
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

Public alpha began at `0.2.0`; the current release is recorded in CHANGELOG.md. The historical private
`0.1.0` tag is not the public-alpha milestone; see [version policy](VERSIONS.md).

Before the next release, repeat first-use installation, update, removal, task, and correction
acceptance on its exact candidate bytes. Keep CLI checks, native host observations, model outputs,
and human verdicts distinct. Publish the exact reviewed package only with explicit authorization;
then verify registry identity and the deployed landing page's release/access/setup/removal copy.
Source edits alone do not close a deployed-site finding. Marketplace listings and other external
distribution remain explicit decisions. See the [current handoff](#current-handoff) for unshipped work.
