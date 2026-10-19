# Installation acceptance

The public entry points are Skills, CLI, MCP, and Plugins. Client names and package managers
are options inside those paths. ROADMAP.md owns delivery state.

## Failure modes to verify before implementation

- A documented command selects the old operator or skill browser instead of installation.
- A skill-only install adds hooks, an MCP server, or an unselected client.
- A dry run changes files; an unknown option silently changes the selected method.
- An existing unowned folder is overwritten, or uninstall removes another tool's files.
- The external Skills CLI discovers multiple Conquistador skills or loses linked resources.
- A package alias downloads an unrelated package, resolves a different release, or starts a UI on import.
- MCP stdio writes setup text into protocol output or requires a bridge that it does not need.
- Anonymous MCP has no discoverable sign-in; disabled OAuth advertises a working flow.
- OAuth accepts an unregistered redirect, missing/wrong PKCE, wrong resource, expired/replayed code,
  forged consent, missing browser state, unknown scope, blocked user, or revoked token.
- A failed or cancelled upstream sign-in issues a token, leaks GitHub credentials, or rotates an API key.
- API keys stop working after OAuth is enabled; rate limits or request limits can be bypassed.
- OAuth secrets, token bodies, private playbooks, or screenshots enter Git or test reports.
- The four choices are hidden, cannot be selected with a keyboard, break direct links, or overflow a phone.
- English, Vietnamese, Markdown, README, and CLI instructions disagree.
- Plugin metadata claims universal compatibility without a documented client contract.
- The plain plugin picker or its terminal select-all action includes a skill-only client.
- A method accepts a client-selection flag it ignores, or lets a legacy flag change its fixed type.
- GitHub refuses a code and leaves the upstream browser cookie active or hides the specific failure.
- A real browser blocks the consent form's redirect to GitHub or the validated client callback.
  Verify both Allow and Cancel with browser CSP enforcement; HTTP-only checks do not cover it.
- A validated OAuth callback redirects to a second client origin and the original form's CSP
  blocks that navigation. Keep a no-JavaScript fallback for the browser handoff.
- Release packaging omits the paired CLI tarball or records a stale version or checksum.
- The OAuth runner leaves child processes or fixture connections open, hangs on HTTP, or
  exits before it writes a failure report. CI must have a bounded run time.

## Dependency and Executor v2 failure modes (2026-10-19)

A configured v2 API must take precedence over an unrelated v1 binary on PATH. A
tracked v2 app must never fall back to v1 source commands after credentials are removed.
Version discovery must not invoke a legacy CLI that writes a cache. Full-account
access must explicitly bind the selected organization on both app and MCP requests.
Source-only v2 setup must not stage a local plugin or treat a local stdio handshake
as evidence that the hosted account's tools work. Test both generated app variants.

Record these cases before changing the adapters or dependency pins:

- The v2 path calls removed v1 CLI commands or starts a folder-scoped daemon.
- Setup advertises the v1 port, install command, authentication model, or source format for v2.
- A valid scoped or organization MCP URL is rejected, or an unsafe URL leaks a credential.
- A cross-origin UI, redirected transport, wrong organization, or changed credential gains access.
- The adapter assumes v1 tool names, account selection, schemas, or result envelopes on v2.
- A schema or identity change turns the fixed repository read into arbitrary code or a write.
- A source is registered twice, an unowned app is overwritten, or removal deletes another app.
- A cancelled or denied operation changes a live account or leaves an approval unresolved.
- An update loses the app identity, selected account, policies, or verified removal path.
- An unsupported client is labeled verified after only a protocol fixture passes.
- An upgraded dependency breaks the supported Node floor, build output, evaluation adapter,
  approval handling, cancellation, or saved-state recovery.
- The evaluation installation retains known high or critical advisories, or an override hides
  a version mismatch that prevents the real Promptfoo runtime from loading.
- A release watcher treats the intentionally selected v2 beta channel as the v1 stable channel.
- A social draft changes the supplied voice or facts, invents outcomes, or treats a clean
  deterministic check as human acceptance. A correction must preserve the other accepted facts.

Native runtime observations, protocol fixtures, and Hung's writing verdict require separate
records. Save repeatable reports and private account captures through DRIVE.md.

## Repeatable evidence

Use `node tools/e2e/installation-methods.mjs` for command dispatch and skill ownership.
Use `node tools/e2e/installation-packages.mjs` for real npm tarballs, the short-name alias,
and the pinned external Skills CLI. Use `node tools/e2e/oauth.mjs` for the real Worker, OAuth provider, local KV, and MCP calls.
The OAuth runner labels its local GitHub identity fixture; it does not prove real GitHub or
Executor acceptance. Each runner writes a JSON report with source hashes outside Git.
The landing repository owns browser checks and before/after captures. DRIVE.md locates evidence.

## Sources checked on 2026-10-17

- [MCP authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
- [Cloudflare OAuth provider](https://github.com/cloudflare/workers-oauth-provider), pinned to 1.2.3
- [Skills CLI](https://www.skills.sh/docs/cli)
- [OpenAI plugins](https://learn.chatgpt.com/docs/plugins)
- [Grok plugins](https://docs.x.ai/build/features/skills-plugins-marketplaces)

MCP stdio needs no HTTP bridge. `mcporter` is a client option, not an installation dependency.
