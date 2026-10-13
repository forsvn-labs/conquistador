# Product roadmap

## Current handoff

Last verified: 2026-10-13. Source merged; 0.6.0 release preparation is active.

[PR #77](https://github.com/forsvn-labs/conquistador/pull/77) updates the product and plugin identities, npm metadata, and the shared npm/GitHub
README. It moves install commands and the full agent list above the catalog, links the live docs,
and uses a capture of the verified 0.6.0 npm installation. Validate the exact clean package, obtain approval
for the version-bump merge, then tag the merged source and publish its release assets through
OIDC. Verify registry bytes and both public pages before recording shipment.

[PR #75](https://github.com/forsvn-labs/conquistador/pull/75) merged at `0cefef32ae734bc6199efd1d08fe8b4310d73e59` on 2026-10-13. The accepted source implements the full agent catalog and search, permanent npm/Bun
CLI installation, project skills, explicit MCP client selection, hook controls, in-TUI maintenance,
and individual install update/removal. Plugin and Executor operations run in child processes so
the progress animation remains responsive. MCP-only installs reopen the manager. Installation
status reports damaged project and global skill copies.

The design follow-up keeps the orange/yellow identity and adds wide detail columns, explicit
multi-selection checkboxes, live selection counts, and consistent focus rows. Both agent and
MCP client pickers have select-all and clear controls. Toggling detected agents preserves a manual
choice, and shrinking an unfiltered catalog to 60×24 keeps the controls visible.

The MCP flow review corrects "MCP apps" to "MCP clients" and the manager action to "MCP
connections". Public flags and saved state stay compatible. Executor 2 detection and source
operations now show a setup handoff instead of calling removed Executor 1 commands or claiming
a connection. Native v2 integration and capability discovery remain pending; the official flow
and implementation gap are recorded in the review document.

Social 2.4.0 makes the writing references required, preserves a supplied draft in edit mode, and
fails banned writing patterns regardless of score. Shared core references remain inside the
owned library and survive contract regeneration. Exact original/rewrite fixtures are in
`tools/e2e/fixtures/social-style.json`. `doctor` also reports older registry releases.

Verified locally on macOS arm64, Node 26.9.0:

- Product checks: 940 pass, including build and type checks.
- Terminal installer: 64/64 scenarios pass, including multi-selection, resize, live progress, per-item removal,
  MCP-only state, Executor 2 handoff, npm/Bun contracts, failure recovery, old flags, and non-interactive defaults.
- Review regressions cover copied npm/Bun choices, failed CLI records and first use, version
  detection failures, and Executor versions printed to stderr. Existing host/launch checks: 19 pass.
- Iris captures cover the picker, manager, MCP multi-selection, and 60×24 layout.
- Copy-check E2E: 44/44 pass. Social-style E2E: 15/15 pass. Original tweet passes unchanged.
- New installer modules pass their configured lint checks.
- Exact-package installation at `c4175ff` passes 50/50 applicable checks, including 21 native
  terminal checks. The Node 22.18 run is explicitly not run. A real Bun global install of the
  same reviewed candidate passes 7/7 checks. The package integrity hashes match.
- Project context: 6/6 checks pass. The live handoff is here; STRUCTURE maps source and commands,
  and DRIVE resolves approved materials. Root INDEX and PROGRESS are retired. Historical links
  point to dated Git records. This branch includes the context migration from PR #76.
- Node 24/26 product CI, Linux/Windows package CI, optional integration checks, and CodeRabbit
  pass at `c4175ff`. All four inline review threads are resolved.
- Live docs canonical and `og:url` both point to `https://conquistador.app/docs`.

Clean-package verification and PR evidence are recorded in
[REVIEW-2026-10-CONTROL-CENTER.md](docs/REVIEW-2026-10-CONTROL-CENTER.md).
The source is merged; npm release remains pending. Tests use synthetic host fixtures where stated and do
not establish model quality, native MCP client loading, or human acceptance.

Merged, not released: [#72](https://github.com/forsvn-labs/conquistador/pull/72) (`9b2acca`, 2026-10-12) moves
every link to `conquistador.app`. Four changed files ship in the npm package (`INSTALL.md`, `docs/CHECK.md`,
`hooks/README.md`, `skills/conquistador/commands/check/COMMAND.md`) and two release manifests; npm users get them
with the next release. 0.5.1 is `latest` on npm (2026-10-10); see [CHANGELOG.md](CHANGELOG.md).
Gemini CLI hooks are not built.

Open: interactive Windows installation and Linux/Windows ARM remain untested. Native MCP client
loading, the five live Executor cases, marketplace listings, hosted OAuth, and real writing
quality acceptance remain on the roadmap. The spinner and resize gaps are fixed on the review branch.


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
2. List the plugin in the agent marketplaces, then check each listing installs 0.4.x.
3. Test the interactive installer on Windows (a pseudo-terminal harness), and Linux and Windows
   on ARM. `tools/e2e/installer.mjs` needs a Windows pseudo-terminal bridge first.
4. Keep the docs canonical and `og:url` check in release acceptance; its latest result is in the
   current handoff.
5. Open each MCP client (Claude Desktop, VS Code, Windsurf, Zed, Cursor) after the installer writes
   its entry, and check that the app lists the Conquistador tools. Only the config file and an MCP
   handshake are checked now.

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

Public alpha began at `0.2.0`; `0.5.1` is the current release. The historical private
`0.1.0` tag is not the public-alpha milestone; see [version policy](VERSIONS.md).

Before the next release, repeat first-use installation, update, removal, task, and correction
acceptance on its exact candidate bytes. Keep CLI checks, native host observations, model outputs,
and human verdicts distinct. Publish the exact reviewed package only with explicit authorization;
then verify registry identity and the deployed landing page's release/access/setup/removal copy.
Source edits alone do not close a deployed-site finding. Marketplace listings and other external
distribution remain explicit decisions. See the [current handoff](#current-handoff) for unshipped work.
