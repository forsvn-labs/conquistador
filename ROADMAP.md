# conquistador roadmap

## Current handoff

Record consolidation: 13 October 2026. Delivery dates below retain the source record's dates. This migration does not verify a new release.

State: Ready to ship, recorded 12 October.

PR #72 merged documentation-link changes at 9b2acca. The handoff records them as unreleased. Package version remains 0.5.1.

Next action: Preserve the new social-copy priorities below. Verify the merged link changes in the next package release. Gemini hooks, synchronous prompt work, resize checks, and untested platform builds remain open.

## Implemented, awaiting review and release

The control-center work now lists all 16 supported agents, supports search, manages project
skills and MCP apps, changes hooks, installs the permanent CLI with npm or Bun, and keeps
update, repair, and removal inside the TUI. Each installed item has a scope and path. Slow
plugin managers leave progress responsive. Resize and MCP-only first-use checks are covered.
The CLI and install docs include one-command npm and Bun installation followed by TUI launch.
Package lifecycle scripts remain non-interactive.

The social fixes below are implemented locally. Exact fixtures contain Hung's original tweet
and the two supplied rewrites. A third negative-parallelism case is explicitly synthetic.
The original passes unchanged; the rewrites fail. Core reads include the shared AI-pattern
reference and human writing stylebook. A banned pattern overrides the self-score, and a
supplied draft defaults to edit mode. `doctor` warns about older registry versions when online.

See [PROGRESS.md](PROGRESS.md) and [the review record](docs/REVIEW-2026-10-CONTROL-CENTER.md).
Release acceptance still needs the exact candidate package and approval. A real-agent task and
human verdict remain separate from deterministic style checks.

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

1. Run the five live Executor cases (first run and connect) that 0.3.0 shipped without. They need
   a responding Executor.app.
2. List the plugin in the agent marketplaces, then check each listing installs 0.4.x.
3. Test the interactive installer on Windows (a pseudo-terminal harness), and Linux and Windows
   on ARM. `tools/e2e/installer.mjs` needs a Windows pseudo-terminal bridge first.
4. Docs canonical verified on 2026-10-13: `/docs` now declares `https://conquistador.app/docs`
   in both the canonical link and `og:url`. Keep this check in release acceptance.
5. Open each MCP app (Claude Desktop, VS Code, Windsurf, Zed, Cursor) after the installer writes
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
distribution remain explicit decisions. See [ROADMAP.md](ROADMAP.md) for unshipped work.

## Earlier implementation evidence

The exact dated handoff and its verification details remain in [Git history](https://github.com/forsvn-labs/conquistador/blob/8b0d40011e07da4996642f883dbe4ab3613db3d3/PROGRESS.md). Recheck recorded branch work before promoting it to active or shipped.
