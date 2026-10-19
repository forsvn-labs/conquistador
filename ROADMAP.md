# Product roadmap

## Current handoff

2026-10-19 progress review: both npm packages still resolve to 0.8.0 as `latest`.
Reviewed source `e930af17a4ee616146b48ea1302742ab198b7b62` matches GitHub `main`; its only
change after the release tag records delivery. The latest
[product checks](https://github.com/forsvn-labs/conquistador/actions/runs/39012614307),
[installed-app integration](https://github.com/forsvn-labs/conquistador/actions/runs/39012614291),
and [installation methods](https://github.com/forsvn-labs/conquistador/actions/runs/39012614286)
pass. Dependency maintenance remains open in public-alpha follow-up items 6 and 7 below.
The next product acceptance is a real social task and correction with Hung's verdict, followed
by the Executor v2 adapter and live cases. This review checked existing CI, registry metadata,
and GitHub alerts; it did not rerun E2E tests or extend native-client, hosted, or writing-quality
acceptance. The verified 0.8.0 delivery record follows.

2026-10-17: Hung authorized and shipped product 0.8.0 through
[PR #80](https://github.com/forsvn-labs/conquistador/pull/80). The
[release](https://github.com/forsvn-labs/conquistador/releases/tag/v0.8.0) has seven checked assets.
Both `@forsvn/conquistador@0.8.0` and the exact-version `conquistador@0.8.0` CLI alias are public
as latest. All eight real registry/install checks pass against the tagged hashes. The main
publication has provenance. The first alias publication used npm security-key authentication;
both future GitHub trusted publishers now pass. Permanent global installs and app imports use
the scoped package. Run-once commands can use `npx conquistador@latest`.

Four public methods are Skills, CLI, MCP, and Plugins. `skills` installs project skills;
`install` opens the agent installer; `plugins` offers native plugin clients; `mcp` serves clean
stdio and `mcp install` configures chosen desktop clients. Explicit old operator routes remain
under `operator install` and `skills --list`. Client and package-manager options stay within
these methods. A bridge is optional client tooling, not a dependency.

The production Worker supports OAuth and existing API keys at `https://mcp.forsvn.com/mcp`.
Cloudflare's provider 1.2.3 supplies discovery, S256 PKCE, DCR/CIMD, resource-bound tokens,
refresh, and revocation. Consent is browser-bound. Access tokens last one hour; refresh
credentials last 30 days. API keys have a separate lifecycle. The existing approved KV
namespace serves both bindings with separate prefixes. The GitHub app uses the exact HTTPS
`/signup/callback` URI and public identity only. The browser handoff starts a new document
before the provider-validated redirect, preserving `form-action self` and a no-JavaScript link.

Real hosted Executor v2 import and GitHub sign-in pass. The account shows Working, lists all
eight tools, and `conquistador_methods` returns the live library. Cancel returns without a new
account. All five production discovery/API-key checks pass. This closes the MCP import failure;
the separate Executor source/capability adapter migration remains open.

Final merged-source CI passes Node 24/26 product checks, installed-app integration, and the
installation suite. Evidence includes 940 product checks, 13 CLI cases, six npm/Skills installs,
19 docs checks, and 27 workerd/OAuth/browser cases. Chromium Allow/Cancel runs without JavaScript
across separate callback/frontend origins. Complete earlier candidate CI also passed 66 terminal
scenarios and Linux/Windows package checks. The labeled identity fixture covers protocol failures;
real GitHub/Executor acceptance is recorded separately. [CHANGELOG.md](CHANGELOG.md) owns exact
release/Worker identity; [installation acceptance](docs/INSTALLATION-ACCEPTANCE.md) owns the
repeatable failure contract. DRIVE.md resolves reports, hashes, and Iris captures.

The bilingual four-choice page shipped through
[landing PR #29](https://github.com/forsvn-labs/conquistador-landing/pull/29), after both package
publications and the MCP deployment. Its repository owns the site deployment and live browser
acceptance. The page keeps app dependencies under CLI and OAuth/API keys under MCP.

## Remaining installation acceptance

Migrate the Executor source and capability adapters to v2, then run the five live cases below.
Native plugin activation in additional clients, native MCP loading, interactive Windows,
Linux/Windows ARM, marketplace listings, additional OAuth clients, and real writing-quality
acceptance remain open. Gemini CLI hooks are not built. Browser and Edge app runtimes are not
verified. The product and method versions remain independent; see [VERSIONS.md](VERSIONS.md).

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
6. Update the optional Promptfoo evaluation dependencies. On 2026-10-19, GitHub reports 52 open
   dependency alerts: 3 critical, 24 high, 21 medium, and 4 low. All are in
   `evals/promptfoo-isolated/package-lock.json`. The critical alerts are
   [#50](https://github.com/forsvn-labs/conquistador/security/dependabot/50),
   [#49](https://github.com/forsvn-labs/conquistador/security/dependabot/49), and
   [#45](https://github.com/forsvn-labs/conquistador/security/dependabot/45) for
   `@simple-git/argv-parser`, `simple-git`, and `proxy-addr`. Verify patched versions and the evaluation
   adapter before enabling live evaluations. The published 0.6.0 npm tarball contains no `evals/`.
7. Review optional Eve and Executor dependency updates. The
   [2026-10-18 release-watch report](https://github.com/forsvn-labs/conquistador/actions/runs/39113277632/artifacts/12131227490)
   marks seven pins `review-required`: `@types/node`, `ai`, `eve`, `just-bash`, `typescript`,
   `@modelcontextprotocol/sdk`, and `executor`. The watcher exits with code 1 when a pin differs
   from npm `latest`; this result requests review and does not test runtime compatibility.
   Review exact candidates against the deployed account, approval, cancellation, and recovery
   paths before changing pins. Repeat with `node tools/integration-releases.mjs check-updates`;
   it reads public metadata and changes no files. CI report artifacts expire after 14 days.

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

OAuth and API keys are live. Real hosted Executor v2 import, GitHub sign-in, read-only tool
execution, and Cancel pass. The workerd suite covers token refresh/replay, revocation, blocked
users, limits, and forged requests with a labeled local identity provider. These fixtures do
not establish native acceptance in other clients.

1. Verify the browser API-key sign-up page shows its one-time `cq_` token and client setup text.
   Terminal sign-in and an existing production key have passed; avoid rotating that key just
   to repeat OAuth acceptance.
2. Connect additional OAuth clients, including Claude connectors and Claude Code. Verify tools,
   expiry/refresh, client revocation, and return navigation in each native client.
3. Observe Cloudflare KV revocation propagation at multiple locations before making a stronger
   guarantee than the documented delay. Keep OAuth grants and personal API-key revocation separate.

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
